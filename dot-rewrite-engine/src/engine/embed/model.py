"""Lazy-loaded sentence-transformer wrapper.

We keep the import lazy because `sentence-transformers` pulls in torch +
tokenizers. Tests that don't touch the semantic layer never pay that cost.

If the dependency is unavailable at runtime, `available()` returns False
and the pipeline falls back to the legacy algorithmic signals (still
written to the DB). This keeps local-dev cheap without breaking anything.
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache

log = logging.getLogger("engine.embed.model")

DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def model_name() -> str:
    return os.environ.get("ENGINE_EMBED_MODEL", DEFAULT_MODEL)


def enabled() -> bool:
    return os.environ.get("ENGINE_FLAG_EMBEDDINGS", "1") != "0"


@lru_cache(maxsize=1)
def _load(name: str):
    try:
        from sentence_transformers import SentenceTransformer
    except Exception as e:  # pragma: no cover
        log.warning("sentence-transformers unavailable: %s", e)
        return None
    try:
        return SentenceTransformer(name)
    except Exception as e:  # pragma: no cover
        log.warning("failed to load %s: %s", name, e)
        return None


def get():
    """Return a SentenceTransformer or None if unavailable."""
    if not enabled():
        return None
    return _load(model_name())


def available() -> bool:
    return get() is not None


def embedding_dim() -> int:
    m = get()
    if m is None:
        return 0
    for attr in ("get_embedding_dimension", "get_sentence_embedding_dimension"):
        fn = getattr(m, attr, None)
        if callable(fn):
            try:
                return int(fn())
            except Exception:  # pragma: no cover
                continue
    return 0
