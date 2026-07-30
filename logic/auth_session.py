"""JWT session cookies for authenticated users."""

from __future__ import annotations

import os
import time
from typing import Any, Optional

import jwt

SESSION_COOKIE = "ct_session"
SESSION_DAYS = 7


def auth_secret() -> str:
    secret = (os.environ.get("AUTH_SECRET") or "").strip()
    if not secret:
        secret = "dev-insecure-auth-secret-change-me"
    return secret


def create_session_token(account_id: str, email: str) -> str:
    now = int(time.time())
    payload = {
        "sub": account_id,
        "email": email,
        "iat": now,
        "exp": now + SESSION_DAYS * 24 * 3600,
    }
    return jwt.encode(payload, auth_secret(), algorithm="HS256")


def decode_session_token(token: str) -> Optional[dict[str, Any]]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, auth_secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    account_id = str(payload.get("sub") or "").strip()
    email = str(payload.get("email") or "").strip()
    if not account_id or not email:
        return None
    return {"account_id": account_id, "email": email}


def session_cookie_kwargs() -> dict[str, Any]:
    secure = (os.environ.get("AUTH_COOKIE_SECURE") or "").strip() in ("1", "true", "yes")
    return {
        "httponly": True,
        "samesite": "lax",
        "max_age": SESSION_DAYS * 24 * 3600,
        "path": "/",
        "secure": secure,
    }
