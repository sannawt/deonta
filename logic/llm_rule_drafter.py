"""
Offline LLM drafting of Soufflé/Datalog scope rules for catalog instruments.
Drafts are written to rules/drafts/ and are NOT auto-loaded by the engine.
"""

from __future__ import annotations

import json
import os
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from logic.legal_db import law_by_code

REPO = Path(__file__).resolve().parents[1]
DRAFTS_DIR = REPO / "rules" / "drafts"
GOLDEN_SCOPE = REPO / "rules" / "golden" / "scope_applicability.dl"
PREDICATE_DECLS = REPO / "rules" / "predicate_decls.dl"


def _env(name: str, default: str | None = None) -> str | None:
    val = os.environ.get(name)
    if val is None:
        return default
    val = val.strip()
    return val or default


def drafting_enabled() -> bool:
    if (_env("ALLOW_RULE_DRAFT", "0") or "0").lower() in ("0", "false", "no", "off"):
        return False
    if (_env("LLM_RULE_DRAFT", "1") or "1").lower() in ("0", "false", "no", "off"):
        return False
    provider = (_env("LLM_PROVIDER", "") or "").lower()
    if provider and provider != "openai":
        return False
    return bool((_env("OPENAI_API_KEY") or "").strip())


def _parse_json(text: str) -> dict[str, Any] | None:
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _read_sample(path: Path, *, limit: int = 80) -> str:
    if not path.is_file():
        return ""
    lines = path.read_text(encoding="utf-8").splitlines()
    return "\n".join(lines[:limit])


def _sample_predicate_names(limit: int = 40) -> list[str]:
    if not PREDICATE_DECLS.is_file():
        return []
    names: list[str] = []
    for line in PREDICATE_DECLS.read_text(encoding="utf-8").splitlines():
        m = re.match(r"\.decl\s+([a-z0-9_]+)", line.strip())
        if m:
            names.append(m.group(1))
        if len(names) >= limit:
            break
    return names


def _call_openai_draft(payload: dict[str, Any]) -> dict[str, Any] | None:
    api_key = _env("OPENAI_API_KEY")
    if not api_key:
        return None

    model = _env("OPENAI_MODEL", "gpt-4o-mini") or "gpt-4o-mini"
    base_url = _env("OPENAI_BASE_URL", "https://api.openai.com/v1") or "https://api.openai.com/v1"
    url = base_url.rstrip("/") + "/chat/completions"

    system = (
        "You draft Soufflé/Datalog scope applicability rules for EU legal instruments. "
        "Use predicates from the provided vocabulary where possible. "
        "Model material, territorial, temporal, and exclusion gates. "
        "Return ONLY JSON:\n"
        "{\n"
        '  "datalog": "// full .dl content as a single string with \\n newlines",\n'
        '  "provisions_cited": ["article or provision id", ...],\n'
        '  "warnings": ["human review note", ...],\n'
        '  "summary": "one sentence what the draft covers"\n'
        "}\n"
        "Include .decl/.input/.output as needed. Do not reference predicates not in vocabulary "
        "unless you declare them. This is a DRAFT for human review — prefer conservative scope gates."
    )

    req_payload: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
        "temperature": 0.15,
        "response_format": {"type": "json_object"},
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(req_payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None

    choices = data.get("choices") or []
    if not choices:
        return None
    content = (choices[0].get("message") or {}).get("content")
    if not content:
        return None
    return _parse_json(str(content))


def draft_scope_rules(
    code: str,
    *,
    provisions: list[dict[str, Any]] | None = None,
    write_files: bool = True,
) -> dict[str, Any]:
    """
    Generate a draft Soufflé scope rules file for a catalog law code.
    Returns metadata; optionally writes rules/drafts/{code}_scope.dl and sidecar JSON.
    """
    key = (code or "").strip().lower().replace("-", "_")
    law = law_by_code(key)
    if not law:
        return {"ok": False, "error": f"Unknown law code: {code}"}

    if not drafting_enabled():
        return {"ok": False, "error": "Rule drafting disabled (set ALLOW_RULE_DRAFT=1 and OPENAI_API_KEY)"}

    payload = {
        "law": {
            "code": key,
            "label": law.get("label"),
            "number": law.get("number"),
            "ui_label": law.get("ui_label"),
        },
        "predicate_vocabulary_sample": _sample_predicate_names(),
        "golden_scope_harness": _read_sample(GOLDEN_SCOPE),
        "legal_provisions": [
            {
                "title": str(p.get("title") or p.get("label") or "")[:120],
                "snippet": str(p.get("snippet") or p.get("summary") or p.get("text") or "")[:500],
            }
            for p in (provisions or [])[:12]
        ],
    }

    parsed = _call_openai_draft(payload)
    if not parsed:
        return {"ok": False, "error": "LLM draft request failed"}

    datalog = str(parsed.get("datalog") or "").strip()
    if not datalog or ".decl" not in datalog:
        return {"ok": False, "error": "LLM returned invalid datalog draft"}

    meta = {
        "ok": True,
        "code": key,
        "label": law.get("label"),
        "provisions_cited": parsed.get("provisions_cited") or [],
        "warnings": parsed.get("warnings") or [],
        "summary": parsed.get("summary") or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "draft_path": None,
        "sidecar_path": None,
    }

    if write_files:
        DRAFTS_DIR.mkdir(parents=True, exist_ok=True)
        dl_path = DRAFTS_DIR / f"{key}_scope.dl"
        json_path = DRAFTS_DIR / f"{key}_scope.meta.json"
        header = (
            f"// DRAFT scope rules for {law.get('label')} ({key})\n"
            f"// Generated {meta['created_at']} — NOT loaded by engine until reviewed.\n\n"
        )
        dl_path.write_text(header + datalog + "\n", encoding="utf-8")
        json_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        meta["draft_path"] = str(dl_path)
        meta["sidecar_path"] = str(json_path)

    return meta
