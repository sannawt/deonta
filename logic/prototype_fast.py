"""
Prototype/demo fast paths: catalog law scan, heuristic scope, response cache.

Enable with PROTOTYPE_MODE=1 (or FAST_PROTOTYPE=1) for repeat demos on the same
product description without Neo4j embedding latency or per-law OpenAI calls.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
from typing import Any

from logic.law_title_format import catalog_codes_from_description, format_legal_instrument, format_product_ui_label
from logic.legal_db import engine_mode_for, law_by_code

_DIM_ORDER = ("temporal", "territorial", "material", "exclusions")
_DIM_LABELS = {
    "temporal": "Temporal scope",
    "territorial": "Territorial scope",
    "material": "Material scope",
    "exclusions": "Exclusions",
}

_HARDWARE_CODES = frozenset(
    {
        "gpsr",
        "red",
        "cra",
        "rohs",
        "weee",
        "reach",
        "product_liability",
        "market_surveillance",
    }
)
_CONNECTIVITY_CODES = frozenset({"cra", "nis2", "data_act", "red", "eecc"})
_PRIVACY_CODES = frozenset({"gdpr", "eprivacy", "data_act"})

_SCAN_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_ASSESS_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_CACHE_MAX = 32


def _env(name: str, default: str | None = None) -> str | None:
    val = os.environ.get(name)
    if val is None:
        return default
    val = val.strip()
    return val or default


def is_prototype_mode() -> bool:
    for key in ("PROTOTYPE_MODE", "FAST_PROTOTYPE"):
        val = (_env(key, "") or "").lower()
        if val in ("1", "true", "yes", "on"):
            return True
        if val in ("0", "false", "no", "off"):
            return False
    return False


def cache_ttl() -> int:
    try:
        return int(_env("PROTOTYPE_CACHE_TTL", "86400") or "86400")
    except ValueError:
        return 86400


def normalize_description(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def fingerprint(*parts: Any) -> str:
    blob = json.dumps(parts, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _cache_get(store: dict[str, tuple[float, dict[str, Any]]], key: str) -> dict[str, Any] | None:
    ttl = cache_ttl()
    if ttl <= 0:
        return None
    entry = store.get(key)
    if not entry:
        return None
    ts, payload = entry
    if time.time() - ts > ttl:
        store.pop(key, None)
        return None
    return json.loads(json.dumps(payload))


def _cache_put(store: dict[str, tuple[float, dict[str, Any]]], key: str, payload: dict[str, Any]) -> None:
    if cache_ttl() <= 0:
        return
    if len(store) >= _CACHE_MAX:
        oldest = min(store.items(), key=lambda item: item[1][0])[0]
        store.pop(oldest, None)
    store[key] = (time.time(), payload)


def scan_cache_key(
    description: str,
    *,
    limit: int,
    min_score: float,
    include_secondary: bool,
    full_scan: bool,
) -> str:
    return fingerprint(
        "scan",
        normalize_description(description),
        limit,
        round(min_score, 3),
        include_secondary,
        full_scan,
    )


def assess_cache_key(
    description: str,
    regulations: list[str],
    kg_facts: list[dict[str, Any]] | None,
) -> str:
    codes = sorted(str(c).strip().lower() for c in regulations)
    kg = [
        {"p": f.get("predicate"), "a": f.get("args")}
        for f in (kg_facts or [])[:24]
        if f.get("predicate")
    ]
    return fingerprint("assess", normalize_description(description), codes, kg)


def get_cached_scan(key: str) -> dict[str, Any] | None:
    return _cache_get(_SCAN_CACHE, key)


def put_cached_scan(key: str, payload: dict[str, Any]) -> None:
    _cache_put(_SCAN_CACHE, key, payload)


def get_cached_assess(key: str) -> dict[str, Any] | None:
    return _cache_get(_ASSESS_CACHE, key)


def put_cached_assess(key: str, payload: dict[str, Any]) -> None:
    _cache_put(_ASSESS_CACHE, key, payload)


def _catalog_score(code: str, position: int) -> float:
    base = 0.96 - min(position, 12) * 0.012
    if code in _HARDWARE_CODES:
        base = max(base, 0.9)
    return round(max(min_score_default(), min(0.98, base)), 4)


def min_score_default() -> float:
    try:
        return float(_env("PROTOTYPE_SCAN_MIN_SCORE", "0.78") or "0.78")
    except ValueError:
        return 0.78


def catalog_scan_row(code: str, score: float, position: int) -> dict[str, Any]:
    catalog = law_by_code(code) or {}
    label = catalog.get("label") or code
    short = catalog.get("short") or label
    number = catalog.get("number") or "—"
    ui_label = catalog.get("ui_label") or label
    title = label
    legal_instrument = format_legal_instrument(
        title,
        official_number=number,
        catalog_code=code,
        document_tier="primary",
        catalog_row=catalog,
    )
    product_ui = format_product_ui_label(
        title,
        official_number=number,
        catalog_code=code,
        document_tier="primary",
        catalog_row=catalog,
        provision_excerpt="",
    )
    return {
        "code": code,
        "short": short,
        "number": number,
        "summary": ui_label,
        "keywords": [short.lower(), code],
        "description": ui_label,
        "score": score,
        "reg_id": f"catalog:{code}",
        "label": label,
        "ui_label": product_ui or ui_label,
        "legal_instrument": legal_instrument or label,
        "catalog_code": code,
        "document_tier": "primary",
        "engine_mode": engine_mode_for(code),
        "hit_count": 0,
        "match_rationale": "Matched from EU law catalog for your product profile",
        "rank_method": "prototype_catalog",
    }


def catalog_scan_response(
    description: str,
    *,
    limit: int = 15,
    min_score: float = 0.75,
    include_secondary: bool = True,
) -> dict[str, Any] | None:
    """Build a law-scan response from catalog keyword inference only (no Neo4j)."""
    codes = catalog_codes_from_description(description)
    if len(codes) < 3:
        return None

    rows: list[dict[str, Any]] = []
    for idx, code in enumerate(codes):
        score = _catalog_score(code, idx)
        if score < min_score:
            continue
        rows.append(catalog_scan_row(code, score, idx))

    if not rows:
        return None

    rows.sort(key=lambda r: r["score"], reverse=True)
    if limit > 0:
        rows = rows[:limit]

    scan_query = description.strip()[:2000]
    return {
        "version": 1,
        "scan_query": scan_query,
        "backend": "prototype_catalog",
        "regulation_count": len(codes),
        "corpus_chars": 0,
        "total_ranked": len(codes),
        "match_count": len(rows),
        "total_match_count": len(codes),
        "min_score": min_score,
        "include_secondary": include_secondary,
        "full_scan": False,
        "display_limit": limit,
        "total_hits": 0,
        "total_vector_hits": 0,
        "results": rows,
        "rank_method": "prototype_catalog",
        "embedding_search": {
            "has_neo4j_embeddings": False,
            "vector_search_used": False,
            "dimensions": 0,
            "vector_property": "",
            "vector_index": "",
            "query_provider": "",
            "query_model": "",
        },
    }


def _signal(spec: dict[str, Any], key: str) -> str:
    camel = {
        "eu_link": "euLink",
        "personal_data": "processesPersonalData",
        "ai_system": "aiSystem",
    }.get(key, key)
    return str(spec.get(camel) or spec.get(key) or "unknown").strip().lower()


def _markets_include_eu(spec: dict[str, Any]) -> bool:
    markets = spec.get("markets") or []
    if not isinstance(markets, list):
        return False
    return any(str(m).strip().lower() in ("eu", "eea", "europe", "european union") for m in markets)


def _dim_result(pass_likely: bool, fail_likely: bool) -> str:
    if fail_likely:
        return "FAIL"
    if pass_likely:
        return "PASS"
    return "UNKNOWN"


def _build_dimension(dim_id: str, result: str, evidence: str) -> dict[str, Any]:
    return {
        "id": dim_id,
        "label": _DIM_LABELS[dim_id],
        "result": result,
        "evidence": evidence,
        "decisive_facts": [],
        "citations": [],
        "rules_invoked": [],
        "proof_lines": [],
    }


def _heuristic_verdict(code: str, spec: dict[str, Any], dimensions: list[dict[str, Any]]) -> str:
    results = {d["id"]: d["result"] for d in dimensions}
    if results.get("material") == "FAIL":
        return "does_not_apply"
    if results.get("exclusions") == "FAIL":
        return "does_not_apply"
    if results.get("material") == "PASS" and results.get("territorial") == "PASS":
        return "applies"
    if results.get("material") == "PASS":
        return "cannot_determine"
    if code in _HARDWARE_CODES and results.get("territorial") == "UNKNOWN":
        return "cannot_determine"
    return "cannot_determine"


def _dimensions_for_law(code: str, spec: dict[str, Any]) -> list[dict[str, Any]]:
    eu = _signal(spec, "eu_link")
    pd = _signal(spec, "personal_data")
    ai = _signal(spec, "ai_system")
    eu_market = _markets_include_eu(spec)
    territorial_unknown = eu == "unknown" and not eu_market

    temporal = _build_dimension(
        "temporal",
        "PASS",
        "The instrument is treated as in force for this assessment period.",
    )

    if territorial_unknown:
        territorial = _build_dimension(
            "territorial",
            "UNKNOWN",
            "EU establishment or placement on the EU market is not confirmed on the facts provided.",
        )
    elif eu == "yes" or eu_market:
        territorial = _build_dimension(
            "territorial",
            "PASS",
            "An EU territorial link appears present from markets or establishment signals.",
        )
    else:
        territorial = _build_dimension(
            "territorial",
            "UNKNOWN",
            "Territorial link to the EU cannot be confirmed yet.",
        )

    if code in _PRIVACY_CODES:
        material_pass = pd == "yes"
        material = _build_dimension(
            "material",
            _dim_result(material_pass, pd == "no"),
            "Material scope depends on whether personal data is processed."
            if pd == "unknown"
            else "Personal data processing signal supports material scope."
            if material_pass
            else "Personal data processing does not appear present.",
        )
    elif code == "ai_act":
        material_pass = ai in ("yes", "likely")
        material = _build_dimension(
            "material",
            _dim_result(material_pass, ai == "no"),
            "Material scope depends on whether the product is an AI system."
            if ai == "unknown"
            else "AI system signal supports material scope."
            if material_pass
            else "The product does not appear to be an AI system on these facts.",
        )
    elif code in _HARDWARE_CODES or code in _CONNECTIVITY_CODES:
        material = _build_dimension(
            "material",
            "PASS",
            "Product type and connectivity characteristics align with this instrument's material scope on a provisional reading.",
        )
    else:
        material = _build_dimension(
            "material",
            "UNKNOWN",
            "Material scope cannot be confirmed without more product-specific facts.",
        )

    exclusions = _build_dimension(
        "exclusions",
        "UNKNOWN",
        "No exclusion or carve-out has been confirmed on the facts provided.",
    )

    return [temporal, territorial, material, exclusions]


def heuristic_retrieval_instruments(
    laws: list[dict[str, Any]],
    *,
    spec: dict[str, Any],
) -> list[dict[str, Any]]:
    """Build full scope instruments without OpenAI (prototype / offline)."""
    from logic.llm_scope_assess import catalog_to_instrument_id

    out: list[dict[str, Any]] = []
    for law in laws:
        code = str(law.get("code") or "").strip().lower().replace("-", "_")
        if not code:
            continue
        catalog = law_by_code(code) or {}
        label = str(law.get("label") or catalog.get("label") or code)
        dimensions = _dimensions_for_law(code, spec)
        verdict = _heuristic_verdict(code, spec, dimensions)
        verdict_display = {
            "applies": "Indicates in scope",
            "does_not_apply": "Indicates out of scope",
            "cannot_determine": "Cannot conclude yet",
        }.get(verdict, "Cannot conclude yet")

        if verdict == "applies":
            headline = f"{label} appears likely in scope on the current facts."
        elif verdict == "does_not_apply":
            headline = f"{label} does not appear in scope on the current facts."
        else:
            headline = f"{label} may apply; territorial or material facts need confirmation."

        missing = []
        if _signal(spec, "eu_link") == "unknown" and not _markets_include_eu(spec):
            missing.append("Is the product placed on or offered in the EU market?")
        if code in _PRIVACY_CODES and _signal(spec, "personal_data") == "unknown":
            missing.append("Does the product process personal data?")

        out.append(
            {
                "id": catalog_to_instrument_id(code),
                "label": label,
                "full_name": str(law.get("legal_instrument") or catalog.get("label") or label),
                "reg_key": code,
                "verdict": verdict,
                "verdict_display": verdict_display,
                "headline": headline,
                "llm_summary": headline,
                "risk_category": None,
                "missing_atoms": missing,
                "dimensions": dimensions,
                "legal_tests": [
                    {
                        "label": f"Does {label} apply to this product type?",
                        "answer": "yes" if verdict == "applies" else "unknown",
                    }
                ],
                "facts_used": [str(spec.get("summary") or spec.get("name") or "Product description")[:200]],
                "missing_facts": missing,
                "assessment_source": "heuristic",
                "confidence": "medium" if verdict == "cannot_determine" else "high",
            }
        )
    return out
