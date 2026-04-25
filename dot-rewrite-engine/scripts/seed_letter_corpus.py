"""Seed the letter_corpus table from the bootstrap manifest.

Reads engine/letters/seeds/bootstrap.jsonl, embeds each passage with
the same sentence-transformer used for note embeddings, and upserts
into letter_corpus keyed by (discipline, content_hash, corpus_version).
Idempotent — re-running with the same content + version is a no-op.

Run:
  uv run python scripts/seed_letter_corpus.py [--version v1]

Prereqs:
  * SUPABASE_DB_URL set in .env (or shell)
  * sentence-transformers installed (engine default)
  * letter_corpus table exists (run web migration first)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import sys
from pathlib import Path

import numpy as np

# allow running from repo root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from engine import config as cfg_mod  # noqa: E402
from engine.db import connect  # noqa: E402
from engine.embed import model as embed_model  # noqa: E402

log = logging.getLogger("seed_letter_corpus")
logging.basicConfig(level="INFO", format="%(asctime)s %(levelname)s %(message)s")


def _content_hash(discipline: str, source_url: str, content: str) -> str:
    h = hashlib.sha1()
    h.update(discipline.encode("utf-8"))
    h.update(b"\x00")
    h.update(source_url.encode("utf-8"))
    h.update(b"\x00")
    h.update(content.encode("utf-8"))
    return h.hexdigest()


def _load_passages(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def _embed_all(passages: list[dict]) -> list[list[float]]:
    m = embed_model.get()
    if m is None:
        raise RuntimeError(
            "Embedding model unavailable. Install sentence-transformers and "
            "ensure ENGINE_FLAG_EMBEDDINGS is not set to 0.",
        )
    texts = [p["content"] for p in passages]
    arr = m.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    if isinstance(arr, np.ndarray):
        return arr.tolist()
    return [list(v) for v in arr]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", default="v1")
    parser.add_argument(
        "--source",
        default=str(
            Path(__file__).resolve().parent.parent
            / "src"
            / "engine"
            / "letters"
            / "seeds"
            / "bootstrap.jsonl"
        ),
    )
    args = parser.parse_args()

    src = Path(args.source)
    if not src.exists():
        log.error("seed source not found: %s", src)
        sys.exit(1)

    passages = _load_passages(src)
    if not passages:
        log.warning("no passages to seed; nothing to do")
        return

    log.info("loaded %d passages from %s", len(passages), src)
    vectors = _embed_all(passages)
    dim = len(vectors[0]) if vectors else 0
    model_name = embed_model.model_name()
    log.info("embedded with model=%s dim=%d", model_name, dim)

    cfg = cfg_mod.load()
    inserted = 0
    skipped = 0
    with connect(cfg) as conn:
        with conn.cursor() as cur:
            for passage, vec in zip(passages, vectors):
                discipline = passage.get("discipline")
                if discipline not in {"M", "S", "C", "P", "H"}:
                    log.warning("skip: invalid discipline %r", discipline)
                    skipped += 1
                    continue
                content = passage.get("content", "")
                source_url = passage.get("source_url", "")
                if not content or not source_url:
                    skipped += 1
                    continue
                ch = _content_hash(discipline, source_url, content)
                cur.execute(
                    """
                    INSERT INTO letter_corpus
                      (discipline, source_kind, source_url, license, title,
                       section, content, content_hash, vector, dim, model,
                       corpus_version)
                    VALUES (%s, 'seed', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (discipline, content_hash, corpus_version)
                    DO UPDATE SET
                        source_url = EXCLUDED.source_url,
                        license    = EXCLUDED.license,
                        title      = EXCLUDED.title,
                        section    = EXCLUDED.section,
                        content    = EXCLUDED.content,
                        vector     = EXCLUDED.vector,
                        dim        = EXCLUDED.dim,
                        model      = EXCLUDED.model
                    """,
                    (
                        discipline,
                        source_url,
                        passage.get("license", ""),
                        passage.get("title", ""),
                        passage.get("section", ""),
                        content,
                        ch,
                        list(vec),
                        dim,
                        model_name,
                        args.version,
                    ),
                )
                inserted += 1
    log.info("seed complete: upserted=%d skipped=%d version=%s", inserted, skipped, args.version)


if __name__ == "__main__":
    main()
