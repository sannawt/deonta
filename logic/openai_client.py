"""
Shared OpenAI chat-completions helper (stdlib urllib, no extra deps).
"""

from __future__ import annotations

import json
import os
import urllib.request
from typing import Any


def _env(name: str, default: str | None = None) -> str | None:
    val = os.environ.get(name)
    if val is None:
        return default
    val = val.strip()
    return val or default


def openai_configured() -> bool:
    provider = (_env("LLM_PROVIDER", "openai") or "openai").lower()
    if provider and provider != "openai":
        return False
    return bool((_env("OPENAI_API_KEY") or "").strip())


def openai_model(override: str | None = None) -> str:
    if override:
        return override
    return _env("OPENAI_MODEL", "gpt-4o-mini") or "gpt-4o-mini"


def openai_base_url() -> str:
    return _env("OPENAI_BASE_URL", "https://api.openai.com/v1") or "https://api.openai.com/v1"


def openai_status() -> dict[str, Any]:
    return {
        "provider": (_env("LLM_PROVIDER") or "openai").strip() or "openai",
        "openai_configured": openai_configured(),
        "model": openai_model(),
        "base_url": openai_base_url(),
    }


def chat_completion(
    *,
    messages: list[dict[str, str]],
    model: str | None = None,
    temperature: float = 0.2,
    json_object: bool = False,
    timeout: int = 60,
) -> str | None:
    """Return assistant text, or None if OpenAI is unavailable or the call fails."""
    api_key = _env("OPENAI_API_KEY")
    if not api_key or not openai_configured():
        return None

    url = openai_base_url().rstrip("/") + "/chat/completions"
    payload: dict[str, Any] = {
        "model": openai_model(model),
        "messages": messages,
        "temperature": temperature,
    }
    if json_object:
        payload["response_format"] = {"type": "json_object"}

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
    except Exception:
        return None

    choices = data.get("choices") or []
    if not choices:
        return None
    msg = choices[0].get("message") or {}
    content = msg.get("content")
    if not content:
        return None
    return str(content).strip()
