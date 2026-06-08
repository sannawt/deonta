"""
LLM-assisted per-law scope assessment for instruments without Soufflé rules.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from logic.legal_db import engine_mode_for, law_by_code

_DIM_ORDER = ("temporal", "territorial", "material", "exclusions")
_DIM_LABELS = {
    "temporal": "Temporal scope",
    "territorial": "Territorial scope",
    "material": "Material scope",
    "exclusions": "Exclusions",
}

_VERDICT_DISPLAY = {
    "applies": "Indicates in scope",
    "does_not_apply": "Indicates out of scope",
    "cannot_determine": "Cannot conclude yet",
}

_RESULT_MAP = {
    "pass": "PASS",
    "fail": "FAIL",
    "cannot_determine": "UNKNOWN",
    "unknown": "UNKNOWN",
    "not_reached": "NOT_REACHED",
}


def _env(name: str, default: str | None = None) -> str | None:
    val = os.environ.get(name)
    if val is None:
        return default
    val = val.strip()
    return val or default


def _enabled() -> bool:
    if (_env("LLM_SCOPE_ASSESS", "1") or "1").lower() in ("0", "false", "no", "off"):
        return False
    provider = (_env("LLM_PROVIDER", "") or "").lower()
    if provider and provider != "openai":
        return False
    return bool((_env("OPENAI_API_KEY") or "").strip())


def _batch_enabled() -> bool:
    return (_env("LLM_SCOPE_BATCH", "1") or "1").lower() not in ("0", "false", "no", "off")


_SCOPE_CACHE: dict[str, tuple[float, list[dict[str, Any]]]] = {}
_SCOPE_CACHE_MAX = 64


def _cache_ttl() -> int:
    try:
        return int(_env("LLM_SCOPE_CACHE_TTL", "3600") or "3600")
    except ValueError:
        return 3600


def _scope_model() -> str:
    return _env("LLM_SCOPE_MODEL") or _env("OPENAI_MODEL", "gpt-4o-mini") or "gpt-4o-mini"


def _product_snapshot(spec: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": spec.get("name") or "",
        "summary": (spec.get("summary") or "")[:1200],
        "markets": spec.get("markets") or [],
        "processes_personal_data": spec.get("processesPersonalData") or "unknown",
        "eu_link": spec.get("euLink") or "unknown",
        "ai_system": spec.get("aiSystem") or "unknown",
    }


def _cache_key(
    laws: list[dict[str, Any]],
    spec: dict[str, Any],
    kg_facts: list[dict[str, Any]] | None,
) -> str:
    codes = sorted(str(l.get("code") or "").strip().lower() for l in laws)
    blob = {
        "codes": codes,
        "product": _product_snapshot(spec),
        "kg": _compact_kg_facts(kg_facts or [], limit=24),
    }
    raw = json.dumps(blob, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _cache_get(key: str) -> list[dict[str, Any]] | None:
    ttl = _cache_ttl()
    if ttl <= 0:
        return None
    entry = _SCOPE_CACHE.get(key)
    if not entry:
        return None
    ts, payload = entry
    if time.time() - ts > ttl:
        _SCOPE_CACHE.pop(key, None)
        return None
    return [dict(x) for x in payload]


def _cache_put(key: str, instruments: list[dict[str, Any]]) -> None:
    if _cache_ttl() <= 0:
        return
    if len(_SCOPE_CACHE) >= _SCOPE_CACHE_MAX:
        oldest = min(_SCOPE_CACHE.items(), key=lambda item: item[1][0])[0]
        _SCOPE_CACHE.pop(oldest, None)
    _SCOPE_CACHE[key] = (time.time(), [dict(x) for x in instruments])


def catalog_to_instrument_id(code: str) -> str:
    key = (code or "").strip().lower().replace("-", "_")
    if key == "ai_act":
        return "EU_AI_ACT"
    return key.upper()


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


def _compact_kg_facts(kg_facts: list[dict[str, Any]], *, limit: int = 20) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for f in kg_facts[:limit]:
        label = str(f.get("label") or f.get("predicate") or "fact").strip()
        value = str(f.get("value") or "").strip()
        if not value and f.get("args"):
            value = f"{f.get('predicate', '')}({', '.join(str(a) for a in f['args'])})"
        if label or value:
            out.append({"label": label[:80], "value": value[:220]})
    return out


def _provisions_for_law(
    legal_matches: list[dict[str, Any]],
    law_code: str,
    law_label: str,
    *,
    limit: int = 8,
) -> list[dict[str, str]]:
    code = (law_code or "").lower()
    label_lower = (law_label or "").lower()
    tokens = {t for t in re.split(r"[\s_/]+", code) if len(t) > 2}
    tokens.update(t for t in re.split(r"[\s_/]+", label_lower) if len(t) > 3)

    scored: list[tuple[int, dict[str, Any]]] = []
    for m in legal_matches:
        text = " ".join(
            str(m.get(k) or "")
            for k in ("title", "summary", "label", "regulation", "document_id", "provision_long_id")
        ).lower()
        score = sum(1 for t in tokens if t in text)
        if score:
            scored.append((score, m))

    scored.sort(key=lambda x: x[0], reverse=True)
    pool = [m for _, m in scored] if scored else list(legal_matches)

    out: list[dict[str, str]] = []
    for m in pool[:limit]:
        title = str(m.get("title") or m.get("label") or m.get("provision_long_id") or "").strip()
        snippet = str(m.get("summary") or m.get("text") or m.get("snippet") or "").strip()
        if len(snippet) > 400:
            snippet = snippet[:397] + "…"
        if title or snippet:
            out.append({"title": title[:120], "snippet": snippet})
    return out


def _normalize_dimension(dim: dict[str, Any]) -> dict[str, Any]:
    dim_id = str(dim.get("id") or "material").strip().lower()
    if dim_id not in _DIM_ORDER:
        dim_id = "material"
    result_raw = str(dim.get("result") or "cannot_determine").strip().lower()
    result = _RESULT_MAP.get(result_raw, "UNKNOWN")
    decisive: list[dict[str, Any]] = []
    for fact in dim.get("decisive_facts") or []:
        if isinstance(fact, str):
            decisive.append({"label": fact[:200], "kind": "used"})
        elif isinstance(fact, dict):
            decisive.append(
                {
                    "label": str(fact.get("label") or fact.get("text") or "")[:200],
                    "kind": str(fact.get("kind") or "used"),
                }
            )
    citations: list[dict[str, Any]] = []
    for c in dim.get("citations") or []:
        if isinstance(c, str):
            citations.append({"label": c[:120]})
        elif isinstance(c, dict):
            citations.append({"label": str(c.get("label") or c.get("title") or "")[:120]})
    return {
        "id": dim_id,
        "label": _DIM_LABELS.get(dim_id, dim_id.title()),
        "result": result,
        "evidence": str(dim.get("evidence") or "")[:500],
        "decisive_facts": decisive[:6],
        "citations": citations[:4],
        "rules_invoked": [],
        "proof_lines": [],
    }


def _build_instrument_from_llm(
    law_meta: dict[str, Any],
    parsed: dict[str, Any],
) -> dict[str, Any]:
    code = str(law_meta.get("code") or "").strip().lower()
    iid = catalog_to_instrument_id(code)
    label = str(law_meta.get("label") or law_meta.get("short") or code).strip()
    full_name = str(
        law_meta.get("legal_instrument") or law_meta.get("ui_label") or label
    ).strip()

    verdict = str(parsed.get("verdict") or "cannot_determine").strip().lower()
    if verdict not in ("applies", "does_not_apply", "cannot_determine"):
        verdict = "cannot_determine"

    dims_raw = parsed.get("dimensions") or []
    dim_by_id = {str(d.get("id") or ""): d for d in dims_raw if isinstance(d, dict)}
    dimensions = [
        _normalize_dimension(dim_by_id.get(dim_id) or {"id": dim_id, "result": "cannot_determine"})
        for dim_id in _DIM_ORDER
        if dim_id in dim_by_id or dims_raw
    ]
    if not dimensions and dims_raw:
        dimensions = [_normalize_dimension(d) for d in dims_raw[:4]]

    legal_tests = []
    for t in parsed.get("legal_tests") or []:
        if isinstance(t, dict):
            legal_tests.append(
                {
                    "label": str(t.get("label") or t.get("question") or "")[:160],
                    "answer": str(t.get("answer") or t.get("result") or "")[:120],
                }
            )

    facts_used = [str(x)[:200] for x in (parsed.get("facts_used") or [])[:8] if str(x).strip()]
    missing_facts = [
        str(x)[:200] for x in (parsed.get("missing_facts") or [])[:8] if str(x).strip()
    ]

    confidence = str(parsed.get("confidence") or "medium").strip().lower()
    if confidence not in ("high", "medium", "low"):
        confidence = "medium"

    headline = str(parsed.get("headline") or parsed.get("summary") or "")[:400]
    llm_summary = str(parsed.get("llm_summary") or parsed.get("summary") or headline)[:400]

    return {
        "id": iid,
        "label": label,
        "full_name": full_name,
        "reg_key": code,
        "verdict": verdict,
        "verdict_display": _VERDICT_DISPLAY.get(verdict, "Cannot conclude yet"),
        "headline": headline,
        "llm_summary": llm_summary,
        "risk_category": None,
        "missing_atoms": missing_facts,
        "dimensions": dimensions,
        "legal_tests": legal_tests,
        "facts_used": facts_used,
        "missing_facts": missing_facts,
        "assessment_source": "llm_assisted",
        "confidence": confidence,
    }


def pending_instrument(law_meta: dict[str, Any]) -> dict[str, Any]:
    code = str(law_meta.get("code") or "").strip().lower()
    label = str(law_meta.get("label") or law_meta.get("short") or code).strip()
    return {
        "id": catalog_to_instrument_id(code),
        "label": label,
        "full_name": str(law_meta.get("legal_instrument") or label).strip(),
        "reg_key": code,
        "verdict": "cannot_determine",
        "verdict_display": "Scope assessment pending",
        "headline": "",
        "risk_category": None,
        "missing_atoms": [],
        "dimensions": [],
        "legal_tests": [],
        "facts_used": [],
        "missing_facts": [],
        "assessment_source": "pending",
        "confidence": "low",
    }


def _openai_json_completion(
    *,
    system: str,
    user_payload: dict[str, Any],
    timeout: int = 60,
) -> dict[str, Any] | None:
    api_key = _env("OPENAI_API_KEY")
    if not api_key:
        return None

    model = _scope_model()
    base_url = _env("OPENAI_BASE_URL", "https://api.openai.com/v1") or "https://api.openai.com/v1"
    url = base_url.rstrip("/") + "/chat/completions"

    req_payload: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
        ],
        "temperature": 0.2,
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
        with urllib.request.urlopen(req, timeout=timeout) as resp:
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


_SINGLE_SCOPE_SYSTEM = (
    "You are a EU regulatory scope analyst. Assess whether the legal instrument applies "
    "to the product on the facts given. Use ONLY the product facts and legal provisions "
    "provided — do not invent citations. Use provisional language. "
    "Return ONLY valid JSON:\n"
    "{\n"
    '  "verdict": "applies|does_not_apply|cannot_determine",\n'
    '  "confidence": "high|medium|low",\n'
    '  "headline": "one sentence scope conclusion",\n'
    '  "summary": "2-3 sentence explanation",\n'
    '  "dimensions": [\n'
    "    {\n"
    '      "id": "temporal|territorial|material|exclusions",\n'
    '      "result": "pass|fail|cannot_determine",\n'
    '      "evidence": "brief rationale",\n'
    '      "decisive_facts": ["plain English fact", ...],\n'
    '      "citations": ["provision title from input only", ...]\n'
    "    }\n"
    "  ],\n"
    '  "legal_tests": [{"label": "instrument-specific question?", "answer": "yes|no|unknown|likely yes"}],\n'
    '  "facts_used": ["plain English", ...],\n'
    '  "missing_facts": ["plain English question needed", ...]\n'
    "}\n"
    "legal_tests must be specific to THIS instrument (e.g. GPSR: consumer product on EU market), "
    "not generic GDPR/AI questions unless assessing GDPR/AI Act."
)

_BATCH_SCOPE_SYSTEM = (
    "You are a EU regulatory scope analyst. For EACH law in the input, assess whether it "
    "applies to the product on the shared facts. Use ONLY provided facts and provisions — "
    "do not invent citations. Use provisional language. "
    "Return ONLY valid JSON:\n"
    "{\n"
    '  "instruments": [\n'
    "    {\n"
    '      "law_code": "catalog code from input",\n'
    '      "verdict": "applies|does_not_apply|cannot_determine",\n'
    '      "confidence": "high|medium|low",\n'
    '      "headline": "one sentence",\n'
    '      "summary": "2 sentences max",\n'
    '      "dimensions": [{"id": "temporal|territorial|material|exclusions", '
    '"result": "pass|fail|cannot_determine", "evidence": "brief", '
    '"decisive_facts": ["..."], "citations": ["..."]}],\n'
    '      "legal_tests": [{"label": "instrument-specific question?", "answer": "yes|no|unknown"}],\n'
    '      "facts_used": ["..."],\n'
    '      "missing_facts": ["..."]\n'
    "    }\n"
    "  ]\n"
    "}\n"
    "Return one entry per law. legal_tests must be specific to each instrument."
)


def _call_openai_scope(payload: dict[str, Any]) -> dict[str, Any] | None:
    return _openai_json_completion(system=_SINGLE_SCOPE_SYSTEM, user_payload=payload, timeout=45)


def _law_payload_row(
    law_meta: dict[str, Any],
    *,
    legal_matches: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    code = str(law_meta.get("code") or "").strip().lower()
    catalog = law_by_code(code) or {}
    label = str(law_meta.get("label") or catalog.get("label") or code)
    return {
        "code": code,
        "label": label,
        "number": law_meta.get("number") or catalog.get("number") or "",
        "ui_label": law_meta.get("ui_label") or catalog.get("ui_label") or "",
        "legal_instrument": law_meta.get("legal_instrument") or label,
        "legal_provisions": _provisions_for_law(legal_matches or [], code, label, limit=5),
    }


def _call_openai_scope_batch(
    laws: list[dict[str, Any]],
    *,
    spec: dict[str, Any],
    kg_facts: list[dict[str, Any]] | None,
    legal_matches: list[dict[str, Any]] | None,
) -> dict[str, dict[str, Any]]:
    if not laws:
        return {}

    payload = {
        "product": _product_snapshot(spec),
        "kg_facts": _compact_kg_facts(kg_facts or [], limit=16),
        "laws": [_law_payload_row(law, legal_matches=legal_matches) for law in laws],
    }
    parsed = _openai_json_completion(
        system=_BATCH_SCOPE_SYSTEM,
        user_payload=payload,
        timeout=max(60, min(120, 30 + 8 * len(laws))),
    )
    if not parsed:
        return {}

    by_code: dict[str, dict[str, Any]] = {}
    for row in parsed.get("instruments") or []:
        if not isinstance(row, dict):
            continue
        code = str(row.get("law_code") or row.get("code") or "").strip().lower().replace("-", "_")
        if code:
            by_code[code] = row
    return by_code


def assess_single_law(
    law_meta: dict[str, Any],
    *,
    spec: dict[str, Any],
    kg_facts: list[dict[str, Any]] | None = None,
    legal_matches: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Return a ScopeInstrument-shaped dict for one retrieval-only law."""
    if not _enabled():
        return pending_instrument(law_meta)

    law_row = _law_payload_row(law_meta, legal_matches=legal_matches)
    payload = {
        "law": {k: v for k, v in law_row.items() if k != "legal_provisions"},
        "product": _product_snapshot(spec),
        "kg_facts": _compact_kg_facts(kg_facts or []),
        "legal_provisions": law_row["legal_provisions"],
    }

    parsed = _call_openai_scope(payload)
    if not parsed:
        return pending_instrument(law_meta)
    return _build_instrument_from_llm(law_meta, parsed)


def _assess_laws_parallel(
    laws: list[dict[str, Any]],
    *,
    spec: dict[str, Any],
    kg_facts: list[dict[str, Any]] | None,
    legal_matches: list[dict[str, Any]] | None,
    max_workers: int,
) -> list[dict[str, Any]]:
    workers = min(max_workers, len(laws))
    results: list[dict[str, Any]] = []

    if workers <= 1:
        for law in laws:
            results.append(
                assess_single_law(
                    law,
                    spec=spec,
                    kg_facts=kg_facts,
                    legal_matches=legal_matches,
                )
            )
        return results

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(
                assess_single_law,
                law,
                spec=spec,
                kg_facts=kg_facts,
                legal_matches=legal_matches,
            ): law
            for law in laws
        }
        for fut in as_completed(futures):
            try:
                results.append(fut.result())
            except Exception:
                law = futures[fut]
                results.append(pending_instrument(law))
    return results


def assess_retrieval_laws(
    selected_laws: list[dict[str, Any]],
    *,
    spec: dict[str, Any],
    kg_facts: list[dict[str, Any]] | None = None,
    legal_matches: list[dict[str, Any]] | None = None,
    symbolic_codes: set[str] | frozenset[str] | None = None,
    max_workers: int = 8,
) -> list[dict[str, Any]]:
    """
    Run LLM scope assessment for retrieval-only selected laws.
    Uses one batched OpenAI call when possible; falls back to parallel singles.
    Skips laws already covered by the symbolic engine.
    """
    symbolic = {str(c).strip().lower() for c in (symbolic_codes or set())}
    to_assess: list[dict[str, Any]] = []
    seen: set[str] = set()

    for row in selected_laws:
        code = str(row.get("code") or "").strip().lower().replace("-", "_")
        if not code or code in seen:
            continue
        seen.add(code)
        if code in symbolic:
            continue
        mode = str(row.get("engine_mode") or engine_mode_for(code))
        if mode == "symbolic":
            continue
        to_assess.append(row)

    if not to_assess:
        return []

    cache_key = _cache_key(to_assess, spec, kg_facts)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    from logic.prototype_fast import heuristic_retrieval_instruments, is_prototype_mode

    if is_prototype_mode():
        results = heuristic_retrieval_instruments(to_assess, spec=spec)
        _cache_put(cache_key, results)
        return results

    if not _enabled():
        from logic.prototype_fast import heuristic_retrieval_instruments as _heuristic

        results = _heuristic(to_assess, spec=spec)
        _cache_put(cache_key, results)
        return results

    results: list[dict[str, Any]] = []
    missing = list(to_assess)
    batch_size = 6
    try:
        batch_size = int(_env("LLM_SCOPE_BATCH_SIZE", "6") or "6")
    except ValueError:
        batch_size = 6
    batch_size = max(2, min(batch_size, 8))

    if _batch_enabled() and len(to_assess) >= 2:
        for offset in range(0, len(to_assess), batch_size):
            chunk = to_assess[offset : offset + batch_size]
            batch_parsed = _call_openai_scope_batch(
                chunk,
                spec=spec,
                kg_facts=kg_facts,
                legal_matches=legal_matches,
            )
            for law in chunk:
                code = str(law.get("code") or "").strip().lower()
                parsed = batch_parsed.get(code)
                if parsed:
                    results.append(_build_instrument_from_llm(law, parsed))
        got_codes = {str(i.get("reg_key") or "") for i in results}
        missing = [
            law
            for law in to_assess
            if str(law.get("code") or "").strip().lower() not in got_codes
        ]

    if missing:
        results.extend(
            _assess_laws_parallel(
                missing,
                spec=spec,
                kg_facts=kg_facts,
                legal_matches=legal_matches,
                max_workers=max_workers,
            )
        )

    got_codes = {str(i.get("reg_key") or "") for i in results}
    still_missing = [
        law
        for law in to_assess
        if str(law.get("code") or "").strip().lower() not in got_codes
    ]
    if still_missing:
        from logic.prototype_fast import heuristic_retrieval_instruments as _heuristic

        results.extend(_heuristic(still_missing, spec=spec))

    _cache_put(cache_key, results)
    return results
