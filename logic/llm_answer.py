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


def generate_openai_chat_completion(*, question: str, sources: str) -> str:
    """
    Minimal OpenAI chat-completions caller using urllib (no new deps).

    Env vars:
      - OPENAI_API_KEY (required)
      - OPENAI_MODEL (optional, default: gpt-4o-mini)
      - OPENAI_BASE_URL (optional, default: https://api.openai.com/v1)
    """
    api_key = _env("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    model = _env("OPENAI_MODEL", "gpt-4o-mini") or "gpt-4o-mini"
    base_url = _env("OPENAI_BASE_URL", "https://api.openai.com/v1") or "https://api.openai.com/v1"

    url = base_url.rstrip("/") + "/chat/completions"

    system = (
        "You are a compliance-law explanation assistant. "
        "Use the provided legal corpus excerpts as the only source of legal content. "
        "Explain in clear, lawyer-friendly prose what the question asks, then summarize "
        "the most relevant excerpts and what they imply. "
        "When you are uncertain, say so explicitly."
    )

    user = (
        f"User question:\n{question}\n\n"
        f"Legal corpus excerpts (quoted from the local rule catalog):\n{sources}\n\n"
        "Answer the question in a structured way (short paragraphs + bullet points). "
        "Do not invent legal citations not present in the excerpts."
    )

    payload: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.2,
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
        data = json.loads(raw)

    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("OpenAI response had no choices")
    msg = choices[0].get("message") or {}
    content = msg.get("content")
    if not content:
        raise RuntimeError("OpenAI response had empty content")
    return str(content).strip()


def generate_general_answer_with_llm(*, question: str, sources: str) -> str | None:
    """
    Attempt LLM generation when provider is configured; return None to fall back.

    Controlled by:
      - LLM_PROVIDER=openai (optional)
      - OPENAI_API_KEY (required if provider is openai)
    """
    provider = (_env("LLM_PROVIDER", "") or "").lower()
    if provider and provider != "openai":
        return None
    try:
        return generate_openai_chat_completion(question=question, sources=sources)
    except Exception:
        return None

