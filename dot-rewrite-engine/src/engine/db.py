"""Supabase Postgres connection helper (psycopg3)."""
from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

import psycopg
from psycopg.rows import dict_row

from .config import Config


@contextmanager
def connect(cfg: Config) -> Iterator[psycopg.Connection]:
    conn = psycopg.connect(cfg.db_url, row_factory=dict_row)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
