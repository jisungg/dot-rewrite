"""Pluggable LLM backend — Anthropic (default) or local Ollama.

The engine only ever calls `complete_json(...)`; the choice of provider
is decided by the `ENGINE_LLM_BACKEND` env var so the same labeler code
runs unchanged against either.

Backends:
- `anthropic` (default): cloud Claude API. Needs `ANTHROPIC_API_KEY`.
  Uses the structured-output `output_config.format.json_schema` path and
  prompt-caches the system message.
- `ollama`: OpenAI-compatible endpoint served by a local Ollama daemon
  (`ollama serve`). Needs the `openai` Python package (optional extra:
  `uv sync --extra ollama`). No API key required; no network calls
  leave the machine.

Both return the same shape: a parsed JSON object that conforms to the
supplied JSON-Schema, or `None` on any failure. Callers are expected to
handle `None` fail-soft.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any

log = logging.getLogger("engine.llm.backend")


ANTHROPIC = "anthropic"
OLLAMA = "ollama"

DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5"
DEFAULT_OLLAMA_MODEL = "qwen2.5:7b-instruct"


def backend_name() -> str:
    return os.environ.get("ENGINE_LLM_BACKEND", ANTHROPIC).lower()


def available() -> bool:
    """True if the configured backend has everything it needs to run."""
    name = backend_name()
    if name == OLLAMA:
        try:
            import openai  # noqa: F401
        except Exception:  # pragma: no cover
            return False
        return True
    # anthropic
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return False
    try:
        import anthropic  # noqa: F401
    except Exception:  # pragma: no cover
        return False
    return True


def resolve_model(
    task: str,
    anthropic_default: str = DEFAULT_ANTHROPIC_MODEL,
    ollama_default: str = DEFAULT_OLLAMA_MODEL,
) -> str:
    """Choose a model for the task, respecting per-task env overrides.

    `task` is a short string ("labeler", "summarizer"). It is upper-cased
    and used as part of the env var name so you can pick different local
    models for different jobs, e.g. a tiny 3B for labeling and a 7B for
    summaries.
    """
    name = backend_name()
    if name == OLLAMA:
        return (
            os.environ.get(f"OLLAMA_{task.upper()}_MODEL")
            or os.environ.get("OLLAMA_MODEL")
            or ollama_default
        )
    return (
        os.environ.get(f"ANTHROPIC_{task.upper()}_MODEL")
        or anthropic_default
    )


def complete_json(
    *,
    system: str,
    user: str,
    schema: dict[str, Any],
    task: str,
    max_tokens: int = 2000,
    anthropic_default_model: str = DEFAULT_ANTHROPIC_MODEL,
    ollama_default_model: str = DEFAULT_OLLAMA_MODEL,
) -> dict[str, Any] | None:
    """Call the configured backend and return parsed JSON matching schema.

    Returns None on any failure so callers can fail-soft.
    """
    name = backend_name()
    model = resolve_model(task, anthropic_default_model, ollama_default_model)
    if name == OLLAMA:
        return _call_ollama(system, user, schema, model, max_tokens)
    return _call_anthropic(system, user, schema, model, max_tokens)


# ----------------------------------------------------------------------
# Backends
# ----------------------------------------------------------------------


def _call_anthropic(
    system: str, user: str, schema: dict[str, Any], model: str, max_tokens: int
) -> dict[str, Any] | None:
    try:
        import anthropic
    except Exception as e:  # pragma: no cover
        log.warning("anthropic SDK import failed: %s", e)
        return None

    client = anthropic.Anthropic()
    try:
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=[{
                "type": "text",
                "text": system,
                "cache_control": {"type": "ephemeral"},
            }],
            output_config={
                "format": {"type": "json_schema", "schema": schema},
            },
            messages=[{"role": "user", "content": user}],
        )
    except Exception as e:
        log.warning("anthropic call failed: %s", e)
        return None

    text = next(
        (b.text for b in response.content if getattr(b, "type", None) == "text"),
        None,
    )
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        log.warning("anthropic JSON parse failed: %s", e)
        return None


def _call_ollama(
    system: str, user: str, schema: dict[str, Any], model: str, max_tokens: int
) -> dict[str, Any] | None:
    try:
        from openai import OpenAI
    except Exception as e:  # pragma: no cover
        log.warning("openai SDK import failed: %s", e)
        return None

    base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1")
    # Ollama ignores the api key but the OpenAI SDK requires something non-empty.
    api_key = os.environ.get("OLLAMA_API_KEY", "ollama")
    client = OpenAI(base_url=base_url, api_key=api_key)

    # Even when the server advertises structured outputs, small open-source
    # models benefit from seeing the schema inline. Both belts: we ask for
    # `json_object` response format AND print the schema in the system msg.
    schema_json = json.dumps(schema, separators=(",", ":"))
    augmented_system = (
        f"{system}\n\n"
        "Return ONLY a single JSON object matching this schema. No prose, "
        "no markdown fences, no explanation. Omit any field not described.\n"
        f"Schema:\n{schema_json}"
    )

    try:
        response = client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": augmented_system},
                {"role": "user", "content": user},
            ],
        )
    except Exception as e:
        log.warning("ollama call failed (model=%s url=%s): %s", model, base_url, e)
        return None

    text: str | None = None
    try:
        text = response.choices[0].message.content
    except Exception:
        text = None
    if not text:
        return None

    # Some small models still wrap JSON in a code fence. Strip it.
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`").lstrip("json").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        log.warning("ollama JSON parse failed: %s", e)
        return None
