"""
LLM compression of assessment facts for the UI (presentation only; does not change engine facts).
"""

from __future__ import annotations

import json
import os
import re
import urllib.request
from typing import Any


def _env(name: str, default: str | None = None) -> str | None:
    val = os.environ.get(name)
    if val is None:
        return default
    val = val.strip()
    return val or default


def _facts_summary_enabled() -> bool:
    if (_env("LLM_FACTS_SUMMARY", "1") or "1").lower() in ("0", "false", "no", "off"):
        return False
    provider = (_env("LLM_PROVIDER", "") or "").lower()
    if provider and provider != "openai":
        return False
    return bool((_env("OPENAI_API_KEY") or "").strip())


def _compact_rows(rows: list[dict[str, Any]], *, limit: int) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for r in rows[:limit]:
        field = str(r.get("field") or "Fact").strip()
        value = str(r.get("value") or "").strip()
        if len(value) > 220:
            value = value[:217] + "…"
        rel = str(r.get("relevance") or "").strip()
        item: dict[str, str] = {"field": field, "value": value}
        if rel:
            item["relevance"] = rel
        out.append(item)
    return out


def _parse_json_object(text: str) -> dict[str, Any] | None:
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _normalize_bullets(items: Any, *, max_items: int) -> list[dict[str, str]]:
    if not isinstance(items, list):
        return []
    out: list[dict[str, str]] = []
    for item in items[:max_items]:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or item.get("field") or "").strip()
        detail = str(item.get("detail") or item.get("value") or "").strip()
        if not label:
            continue
        if len(detail) > 280:
            detail = detail[:277] + "…"
        row: dict[str, str] = {"label": label, "detail": detail}
        rel = str(item.get("relevance") or "").strip().lower()
        if rel in ("used", "related", "background"):
            row["relevance"] = rel
        out.append(row)
    return out


def _normalize_summary(data: dict[str, Any]) -> dict[str, Any]:
    gist = str(data.get("scenario_gist") or data.get("gist") or "").strip()
    if len(gist) > 320:
        gist = gist[:317] + "…"
    note = str(data.get("note") or "").strip()
    if len(note) > 200:
        note = note[:197] + "…"
    return {
        "scenario_gist": gist,
        "from_question": _normalize_bullets(
            data.get("from_question") or data.get("question_bullets"), max_items=6
        ),
        "from_playbook": _normalize_bullets(
            data.get("from_playbook") or data.get("playbook_bullets"), max_items=6
        ),
        "note": note,
        "source": "llm",
    }


def summarize_facts_for_display(
    *,
    question: str,
    from_question: list[dict[str, Any]],
    from_playbook: list[dict[str, Any]],
    playbook_company_label: str = "",
    playbook_extended_count: int = 0,
) -> dict[str, Any] | None:
    """
    Return a compact facts summary for the assessment panel, or None to use the raw table.

    Does not modify symbolic facts — UI presentation only.
    """
    if not _facts_summary_enabled():
        return None
    if not from_question and not from_playbook:
        return None

    api_key = _env("OPENAI_API_KEY")
    if not api_key:
        return None

    model = _env("OPENAI_MODEL", "gpt-4o-mini") or "gpt-4o-mini"
    base_url = _env("OPENAI_BASE_URL", "https://api.openai.com/v1") or "https://api.openai.com/v1"
    url = base_url.rstrip("/") + "/chat/completions"

    q_rows = _compact_rows(from_question, limit=10)
    p_rows = _compact_rows(from_playbook, limit=8)

    user_payload = {
        "user_question": (question or "")[:1200],
        "playbook_company": playbook_company_label or "unknown",
        "facts_from_question": q_rows,
        "facts_from_playbook": p_rows,
        "additional_playbook_matches_not_listed": playbook_extended_count,
    }

    system = (
        "You help compliance officers scan a scope assessment. "
        "Compress the fact lists into a short UI summary. "
        "Use provisional language (e.g. 'on these facts', 'appears to'). "
        "Do NOT change legal conclusions or invent facts not in the input. "
        "Return ONLY valid JSON with this shape:\n"
        "{\n"
        '  "scenario_gist": "one sentence scenario overview",\n'
        '  "from_question": [{"label": "short title", "detail": "one line"}],\n'
        '  "from_playbook": [{"label": "short title", "detail": "one line", "relevance": "used|related|background"}],\n'
        '  "note": "optional short note if many facts were omitted"\n'
        "}\n"
        "Max 5 items per array. Merge duplicates. Prefer plain English over predicate syntax."
    )

    payload: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
        ],
        "temperature": 0.15,
        "response_format": {"type": "json_object"},
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

    try:
        with urllib.request.urlopen(req, timeout=35) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            data = json.loads(raw)
    except Exception:
        return None

    choices = data.get("choices") or []
    if not choices:
        return None
    content = (choices[0].get("message") or {}).get("content")
    if not content:
        return None

    parsed = _parse_json_object(str(content))
    if not parsed:
        return None

    summary = _normalize_summary(parsed)
    if not summary["scenario_gist"] and not summary["from_question"] and not summary["from_playbook"]:
        return None
    return summary
