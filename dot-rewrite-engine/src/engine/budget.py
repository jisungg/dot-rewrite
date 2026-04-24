"""Stage budgets + fail-soft orchestration.

Each pipeline stage declares a budget (time_ms, optional mem). The runner
wraps calls in `run_stage`. On overrun or exception, the stage degrades
gracefully: the caller receives a partial or fallback value and the stage
name is recorded in budget_degraded_stages so drift sees it and the run
still completes with status=ok-degraded rather than crashing.

Budgets are intentionally loose — they exist to stop pathological cases,
not to micromanage. Raise them by setting ENGINE_BUDGET_X env vars.
"""
from __future__ import annotations

import logging
import signal
import time
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Callable, TypeVar

log = logging.getLogger("engine.budget")
T = TypeVar("T")


@dataclass(frozen=True)
class StageBudget:
    name: str
    time_ms: int = 60_000          # hard ceiling
    soft_ms: int = 15_000          # warn at this point


DEFAULT_BUDGETS: dict[str, StageBudget] = {
    "ingest":           StageBudget("ingest",           time_ms=45_000, soft_ms=10_000),
    "represent":        StageBudget("represent",        time_ms=30_000, soft_ms=5_000),
    "similarity":       StageBudget("similarity",       time_ms=60_000, soft_ms=10_000),
    "graph":            StageBudget("graph",            time_ms=45_000, soft_ms=8_000),
    "subcluster":       StageBudget("subcluster",       time_ms=30_000, soft_ms=5_000),
    "studystate":       StageBudget("studystate",       time_ms=30_000, soft_ms=5_000),
    "diagnose":         StageBudget("diagnose",         time_ms=60_000, soft_ms=10_000),
    "confusion":        StageBudget("confusion",        time_ms=45_000, soft_ms=8_000),
    "signatures":       StageBudget("signatures",       time_ms=15_000, soft_ms=3_000),
}


class StageTimeout(Exception):
    pass


@contextmanager
def _timeout(seconds: int):
    if seconds <= 0 or not hasattr(signal, "SIGALRM"):
        yield
        return

    def _handler(signum, frame):
        raise StageTimeout()

    prev = signal.signal(signal.SIGALRM, _handler)
    signal.alarm(int(seconds))
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, prev)


def run_stage(
    name: str,
    fn: Callable[[], T],
    fallback: T,
    budgets: dict[str, StageBudget],
    stage_timings: dict[str, float],
    degraded: list[str],
    enforce_timeout: bool = True,
) -> T:
    budget = budgets.get(name) or StageBudget(name)
    start = time.perf_counter()
    try:
        if enforce_timeout:
            with _timeout(int(budget.time_ms / 1000) + 1):
                result = fn()
        else:
            result = fn()
    except StageTimeout:
        log.warning("stage %s exceeded hard budget %dms — degrading", name, budget.time_ms)
        degraded.append(name + ":timeout")
        result = fallback
    except Exception as e:
        log.warning("stage %s failed (%s) — degrading", name, repr(e))
        degraded.append(f"{name}:error:{type(e).__name__}")
        result = fallback
    elapsed_ms = (time.perf_counter() - start) * 1000
    stage_timings[name] = elapsed_ms
    if elapsed_ms > budget.soft_ms:
        log.info("stage %s exceeded soft budget: %.0fms > %dms", name, elapsed_ms, budget.soft_ms)
    return result
