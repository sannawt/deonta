"""SQLite-backed users and magic-link tokens."""

from __future__ import annotations

import hashlib
import os
import secrets
import sqlite3
import time
from pathlib import Path
from typing import Any, Optional

from logic.account_store import ensure_account, new_account_id

REPO = Path(__file__).resolve().parent.parent
DEFAULT_DB = REPO / "data" / "app.db"

MAGIC_LINK_TTL_SEC = 15 * 60


def auth_db_path() -> Path:
    raw = (os.environ.get("AUTH_DB_PATH") or "").strip()
    if raw:
        return Path(raw).expanduser().resolve()
    return DEFAULT_DB


def _connect() -> sqlite3.Connection:
    path = auth_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_auth_db() -> None:
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                account_id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                created_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS magic_links (
                token_hash TEXT PRIMARY KEY,
                email TEXT NOT NULL COLLATE NOCASE,
                expires_at REAL NOT NULL,
                used_at REAL
            );
            CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links(email);
            """
        )
        conn.commit()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_magic_link(email: str) -> tuple[str, float]:
    """Returns (raw_token, expires_at)."""
    init_auth_db()
    normalized = normalize_email(email)
    if not normalized or "@" not in normalized:
        raise ValueError("Invalid email")
    token = secrets.token_urlsafe(32)
    token_hash = hash_token(token)
    expires_at = time.time() + MAGIC_LINK_TTL_SEC
    with _connect() as conn:
        conn.execute(
            "INSERT INTO magic_links (token_hash, email, expires_at, used_at) VALUES (?, ?, ?, NULL)",
            (token_hash, normalized, expires_at),
        )
        conn.commit()
    return token, expires_at


def consume_magic_link(token: str) -> Optional[str]:
    """Validate token, mark used, return email if valid."""
    init_auth_db()
    token_hash = hash_token(token.strip())
    now = time.time()
    with _connect() as conn:
        row = conn.execute(
            "SELECT email, expires_at, used_at FROM magic_links WHERE token_hash = ?",
            (token_hash,),
        ).fetchone()
        if not row:
            return None
        if row["used_at"] is not None:
            return None
        if row["expires_at"] < now:
            return None
        conn.execute(
            "UPDATE magic_links SET used_at = ? WHERE token_hash = ?",
            (now, token_hash),
        )
        conn.commit()
        return str(row["email"])


def get_user_by_email(email: str) -> Optional[dict[str, Any]]:
    init_auth_db()
    normalized = normalize_email(email)
    with _connect() as conn:
        row = conn.execute(
            "SELECT account_id, email, created_at FROM users WHERE email = ?",
            (normalized,),
        ).fetchone()
    if not row:
        return None
    return {
        "account_id": row["account_id"],
        "email": row["email"],
        "created_at": row["created_at"],
    }


def get_user_by_account_id(account_id: str) -> Optional[dict[str, Any]]:
    init_auth_db()
    with _connect() as conn:
        row = conn.execute(
            "SELECT account_id, email, created_at FROM users WHERE account_id = ?",
            (account_id,),
        ).fetchone()
    if not row:
        return None
    return {
        "account_id": row["account_id"],
        "email": row["email"],
        "created_at": row["created_at"],
    }


def upsert_user(email: str) -> dict[str, Any]:
    init_auth_db()
    normalized = normalize_email(email)
    existing = get_user_by_email(normalized)
    if existing:
        ensure_account(existing["account_id"])
        return existing
    account_id = new_account_id()
    ensure_account(account_id)
    created_at = time.time()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO users (account_id, email, created_at) VALUES (?, ?, ?)",
            (account_id, normalized, created_at),
        )
        conn.commit()
    return {"account_id": account_id, "email": normalized, "created_at": created_at}
