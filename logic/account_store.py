"""Account identity (v1: client-supplied UUID, no login yet)."""

from __future__ import annotations

import re
import secrets
from pathlib import Path
from typing import Optional

REPO = Path(__file__).resolve().parent.parent
DEFAULT_ACCOUNTS_ROOT = REPO / "data" / "accounts"

_ACCOUNT_ID_RE = re.compile(r"^[a-f0-9]{32}$")


def accounts_root() -> Path:
    import os

    raw = (os.environ.get("ACCOUNTS_DATA_DIR") or "").strip()
    if raw:
        return Path(raw).expanduser().resolve()

    candidates: list[Path] = [DEFAULT_ACCOUNTS_ROOT]
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        candidates.insert(0, Path("/tmp/ct-accounts"))

    for root in candidates:
        try:
            root.mkdir(parents=True, exist_ok=True)
            probe = root / ".write_probe"
            probe.write_text("ok", encoding="utf-8")
            probe.unlink(missing_ok=True)
            return root
        except OSError:
            continue

    fallback = Path("/tmp/ct-accounts")
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback


def new_account_id() -> str:
    return secrets.token_hex(16)


def normalize_account_id(account_id: str | None) -> Optional[str]:
    if not account_id:
        return None
    key = account_id.strip().lower()
    if not _ACCOUNT_ID_RE.match(key):
        return None
    return key


def account_dir(account_id: str) -> Path:
    return accounts_root() / account_id


def ensure_account(account_id: str) -> Path:
    path = account_dir(account_id)
    path.mkdir(parents=True, exist_ok=True)
    (path / "playbooks").mkdir(exist_ok=True)
    return path
