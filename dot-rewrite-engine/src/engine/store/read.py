"""Read notes for a space from Supabase Postgres.

Matches Next.js Note type: id, user_id, space_id, title, content, tags,
pinned, processed, created_at, last_modified_at, archived.
Skip archived. Tags surface as structural hints.
"""
from __future__ import annotations

from datetime import datetime

import psycopg

from ..models import NoteRecord


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


def _as_dt(v) -> datetime:
    if isinstance(v, datetime):
        return v
    return datetime.fromisoformat(str(v))
