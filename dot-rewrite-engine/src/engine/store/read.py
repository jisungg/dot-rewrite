"""Read notes for a space from Supabase Postgres.

Matches Next.js Note type: id, user_id, space_id, title, content, tags,
pinned, processed, created_at, last_modified_at, archived.
Skip archived. Tags surface as structural hints.
"""
from __future__ import annotations

from datetime import datetime

import psycopg

from ..models import NoteEmbedding, NoteRecord


FETCH_SQL = """
SELECT
  id::text           AS id,
  space_id::text     AS space_id,
  user_id::text      AS user_id,
  title,
  content,
  tags,
  pinned,
  processed,
  created_at,
  last_modified_at
FROM notes
WHERE space_id = %s
  AND COALESCE(archived, false) = false
ORDER BY created_at ASC
"""


def fetch_space_notes(conn: psycopg.Connection, space_id: str) -> list[NoteRecord]:
    with conn.cursor() as cur:
        cur.execute(FETCH_SQL, (space_id,))
        rows = cur.fetchall()
    out: list[NoteRecord] = []
    for r in rows:
        out.append(NoteRecord(
            id=r["id"],
            space_id=r["space_id"],
            title=r["title"] or "",
            raw_text=r["content"] or "",
            created_at=_as_dt(r["created_at"]),
            updated_at=_as_dt(r["last_modified_at"]),
            tags=list(r.get("tags") or []),
            pinned=bool(r.get("pinned")),
            processed=bool(r.get("processed")),
            user_id=r.get("user_id") or "",
        ))
    return out


def fetch_cached_embeddings(
    conn: psycopg.Connection, space_id: str
) -> dict[str, NoteEmbedding]:
    """Return cached embeddings keyed by note_id. Empty if the table is missing."""
    out: dict[str, NoteEmbedding] = {}
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT note_id::text AS note_id, model, dim, vector, content_hash
                  FROM note_embeddings
                 WHERE space_id = %s
                """,
                (space_id,),
            )
            rows = cur.fetchall()
    except Exception:
        conn.rollback()
        return {}
    for r in rows:
        out[r["note_id"]] = NoteEmbedding(
            space_id=space_id,
            note_id=r["note_id"],
            model=r["model"] or "",
            dim=int(r["dim"] or 0),
            vector=list(r["vector"] or []),
            content_hash=r["content_hash"] or "",
        )
    return out


def _as_dt(v) -> datetime:
    if isinstance(v, datetime):
        return v
    return datetime.fromisoformat(str(v))
