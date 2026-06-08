"""
LLM plain-English interpretation of scope analysis (presentation only).
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


def _enabled() -> bool:
    if (_env("LLM_SCOPE_SUMMARY", "1") or "1").lower() in ("0", "false", "no", "off"):
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


def _compact_instrument(inst: dict[str, Any]) -> dict[str, Any]:
    dims = []
    for d in inst.get("dimensions") or []:
        dims.append(
            {
                "id": d.get("id"),
                "label": d.get("label"),
                "result": d.get("result"),
                "evidence": (d.get("evidence") or "")[:400],
                "decisive_facts": [
                    {"label": f.get("label"), "kind": f.get("kind")}
                    for f in (d.get("decisive_facts") or [])[:6]
                ],
                "rules": [
                    {
                        "provision": (r.get("citation") or {}).get("label")
                        or r.get("provision_long_id"),
                        "head": (r.get("head_atom") or "")[:120],
                    }
                    for r in (d.get("rules_invoked") or [])[:4]
                ],
                "citations": [
                    (c.get("label") or c.get("provision_long_id"))
                    for c in (d.get("citations") or [])[:6]
                ],
            }
        )
    return {
        "id": inst.get("id"),
        "label": inst.get("label"),
        "verdict": inst.get("verdict"),
        "headline": (inst.get("headline") or "")[:300],
        "dimensions": dims,
    }


def summarize_scope_analysis(scope_analysis: dict[str, Any]) -> dict[str, Any] | None:
    """Return LLM summaries keyed by instrument id and dimension id."""
    if not _enabled():
        return None
    instruments = scope_analysis.get("instruments") or []
    symbolic_only = [
        i
        for i in instruments
        if str(i.get("assessment_source") or "")
        not in ("llm_assisted", "heuristic", "pending")
    ]
    if not symbolic_only:
        return None

    api_key = _env("OPENAI_API_KEY")
    if not api_key:
        return None

    model = _env("OPENAI_MODEL", "gpt-4o-mini") or "gpt-4o-mini"
    base_url = _env("OPENAI_BASE_URL", "https://api.openai.com/v1") or "https://api.openai.com/v1"
    url = base_url.rstrip("/") + "/chat/completions"

    payload_in = {"instruments": [_compact_instrument(i) for i in symbolic_only]}

    system = (
        "You explain regulatory scope analysis to compliance officers. "
        "The symbolic engine is authoritative — do NOT change PASS/FAIL/UNKNOWN results. "
        "Use provisional language (appears to, on these facts, cannot conclude yet). "
        "Return ONLY JSON:\n"
        "{\n"
        '  "instruments": [\n'
        "    {\n"
        '      "id": "GDPR|EU_AI_ACT",\n'
        '      "instrument_summary": "one sentence",\n'
        '      "dimensions": [\n'
        "        {\n"
        '          "id": "temporal|territorial|material|exclusions",\n'
        '          "interpretation": "max 2 sentences",\n'
        '          "why_result": "one sentence linking facts to result",\n'
        '          "key_facts": ["short phrase", "..."]\n'
        "        }\n"
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "Only reference citations and rules present in the input."
    )

    req_payload: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(payload_in, ensure_ascii=False)},
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
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None

    choices = data.get("choices") or []
    if not choices:
        return None
    content = (choices[0].get("message") or {}).get("content")
    if not content:
        return None
    parsed = _parse_json(str(content))
    if not parsed:
        return None
    return {"instruments": parsed.get("instruments") or [], "source": "llm"}


def merge_scope_llm(
    scope_analysis: dict[str, Any],
    llm_payload: dict[str, Any] | None,
) -> dict[str, Any]:
    """Attach llm block to each instrument and dimension."""
    if not llm_payload:
        return scope_analysis

    by_id: dict[str, dict[str, Any]] = {}
    for inst in llm_payload.get("instruments") or []:
        iid = str(inst.get("id") or "")
        if iid:
            by_id[iid] = inst

    for inst in scope_analysis.get("instruments") or []:
        iid = str(inst.get("id") or "")
        llm_inst = by_id.get(iid) or {}
        if llm_inst.get("instrument_summary"):
            inst["llm_summary"] = str(llm_inst["instrument_summary"])[:400]

        dim_map = {str(d.get("id") or ""): d for d in llm_inst.get("dimensions") or []}
        for dim in inst.get("dimensions") or []:
            did = str(dim.get("id") or "")
            ld = dim_map.get(did)
            if not ld:
                continue
            dim["llm"] = {
                "interpretation": str(ld.get("interpretation") or "")[:500],
                "why_result": str(ld.get("why_result") or "")[:300],
                "key_facts": [str(x)[:120] for x in (ld.get("key_facts") or [])[:5]],
            }

    scope_analysis["llm_enriched"] = True
    return scope_analysis
