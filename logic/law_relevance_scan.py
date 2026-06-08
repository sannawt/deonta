"""Semantic / term relevance scan over structured legal DB (Neo4j legal Aura, twin_p corpus)."""

from __future__ import annotations

import re
from typing import Any, Callable

from logic.law_title_format import (
    _CATALOG_TOPICS,
    catalog_codes_from_description,
    catalog_for_primary_document,
    classify_document_tier,
    format_legal_instrument,
    format_product_ui_label,
    infer_catalog_code,
    infer_related_catalog_code,
    is_noise_document,
    is_uuid_slug,
    parse_document_display,
    should_exclude_tier,
    tier_score_penalty,
    title_summary,
)
from logic.legal_db import LAW_CATALOG, engine_mode_for, law_by_code, neo4j_legal_configured
from logic.local_legal_store import legal_graph_backend
from logic.neo4j_embedding_config import load_embedding_profile
from logic.neo4j_vector_search import (
    aggregate_hits_by_regulation,
    fetch_document_metadata,
    fetch_document_metadata_for_ids,
    fetch_legal_entity_metadata,
    merge_vector_hits_into_regulations,
    vector_search_hits,
)
from logic.query_embedder import embed_query
from logic.reg_id_map import reg_id_to_code
from logic.terms import terms_from_question

_NUMBER_RE = re.compile(
    r"(?:Regulation\s*\(EU\)\s*)?(\d{4}/\d+(?:/\d+)?)|(?:Directive\s*\(EU\)\s*)?(\d{4}/\d+)",
    re.I,
)

REGULATIONS_CYPHER = """
MATCH (r:Regulation)
RETURN
  coalesce(r.id, r.regulation_id, elementId(r)) AS reg_id,
  coalesce(r.name, r.title, '') AS name,
  coalesce(r.short_name, r.shortName, '') AS short_name,
  coalesce(r.number, r.official_number, r.celex, '') AS official_number,
  coalesce(r.description, r.summary, '') AS description
"""

DOCUMENTS_REGULATIONS_CYPHER = """
MATCH (d:Document)
RETURN
  coalesce(d.id, elementId(d)) AS reg_id,
  coalesce(d.title, d.name, '') AS name,
  '' AS short_name,
  '' AS official_number,
  '' AS description
"""

CATALOG_DOCUMENT_CANDIDATES_CYPHER = """
UNWIND $patterns AS pattern
MATCH (d:Document)
WHERE toLower(d.title) CONTAINS toLower(pattern.text)
RETURN
  pattern.code AS catalog_code,
  pattern.text AS pattern_text,
  coalesce(d.id, elementId(d)) AS reg_id,
  coalesce(d.title, d.name, '') AS name
LIMIT 300
"""

DOCUMENTS_BY_IDS_CYPHER = """
UNWIND $ids AS doc_id
MATCH (d:Document)
WHERE d.id = doc_id
RETURN
  coalesce(d.id, elementId(d)) AS reg_id,
  coalesce(d.title, d.name, '') AS name,
  '' AS short_name,
  '' AS official_number,
  '' AS description
"""

# All provision-like nodes with body text (label-agnostic for twin_p schema drift)
CORPUS_BY_REG_CYPHER = """
MATCH (n)
WHERE n.text IS NOT NULL AND size(toString(n.text)) > 35
WITH coalesce(n.doc_id, n.regulation_id, n.regulationId) AS reg_id, n
WHERE reg_id IS NOT NULL
WITH reg_id,
     collect(toString(n.text))[0..20] AS texts,
     collect(coalesce(n.name, n.title, n.long_id, ''))[0] AS sample_name
RETURN reg_id, texts, sample_name
"""

# Query-driven: provisions whose text matches product terms
SEARCH_BY_TERMS_CYPHER = """
MATCH (n)
WHERE n.text IS NOT NULL AND size(toString(n.text)) > 25
  AND any(t IN $terms WHERE toLower(toString(n.text)) CONTAINS t
       OR toLower(coalesce(n.name, '')) CONTAINS t
       OR toLower(coalesce(n.title, '')) CONTAINS t)
WITH coalesce(n.doc_id, n.regulation_id, n.regulationId) AS reg_id, n
WHERE reg_id IS NOT NULL
WITH reg_id,
     count(n) AS hit_count,
     collect(toString(n.text))[0..6] AS texts,
     collect(coalesce(n.name, n.title, ''))[0] AS sample_name
RETURN reg_id, hit_count, texts, sample_name
ORDER BY hit_count DESC
LIMIT 40
"""

FALLBACK_REGULATIONS_CYPHER = """
MATCH (n)
WHERE n.regulation_id IS NOT NULL OR n.regulationId IS NOT NULL
WITH coalesce(n.regulation_id, n.regulationId) AS reg_id, n
WITH reg_id, collect(n)[0..1] AS nodes
UNWIND nodes AS n
RETURN DISTINCT reg_id,
  coalesce(n.regulation_name, '') AS name,
  '' AS short_name,
  '' AS official_number,
  '' AS description
LIMIT 50
"""

MIN_RANK_BLOB_CHARS = 60


def build_scan_query(
    description: str,
    kg_facts: list[dict[str, Any]] | None = None,
    *,
    max_chars: int = 6000,
) -> str:
    lines = [(description or "").strip()]
    predicate_terms: list[str] = []
    for f in kg_facts or []:
        pred = str(f.get("predicate") or f.get("label") or "").strip()
        args = f.get("args")
        if pred and isinstance(args, list) and args:
            atom = f"{pred}({', '.join(str(a) for a in args)})"
            lines.append(atom)
            predicate_terms.append(pred.replace("_", " "))
            continue
        val = f.get("value") or f.get("text") or ""
        if pred or val:
            lines.append(f"{pred}: {val}".strip(": "))
    if predicate_terms:
        lines.append(" ".join(dict.fromkeys(predicate_terms)))
    return "\n".join(lines).strip()[:max_chars]


def _predicate_terms_from_kg(kg_facts: list[dict[str, Any]] | None) -> set[str]:
    terms: set[str] = set()
    for f in kg_facts or []:
        pred = str(f.get("predicate") or f.get("label") or "").strip().lower()
        if pred:
            terms.add(pred)
            terms.update(t for t in pred.split("_") if len(t) >= 3)
    return terms



def _tokenize(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-zA-Z][a-zA-Z0-9_]{2,}", (text or "").lower()) if len(t) >= 3]


def _excerpt(text: str, n: int = 220) -> str:
    s = re.sub(r"\s+", " ", (text or "").strip())
    if len(s) <= n:
        return s
    return s[: n - 1].rstrip() + "…"


def _extract_number(*blobs: str) -> str:
    for blob in blobs:
        if not blob:
            continue
        m = _NUMBER_RE.search(blob)
        if m:
            return next(g for g in m.groups() if g)
        m2 = re.search(r"\b(20\d{2}/\d+)\b", blob)
        if m2:
            return m2.group(1)
    return ""


def _merge_regulation_rows(
    reg_rows: list[dict[str, Any]],
    prov_rows: list[dict[str, Any]],
    *,
    hit_counts: dict[str, int] | None = None,
) -> list[dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    for row in reg_rows:
        rid = str(row.get("reg_id") or "").strip()
        if not rid:
            continue
        by_id[rid] = {
            "reg_id": rid,
            "name": str(row.get("name") or ""),
            "short_name": str(row.get("short_name") or ""),
            "official_number": str(row.get("official_number") or ""),
            "description": str(row.get("description") or ""),
            "texts": [],
            "hit_count": int((hit_counts or {}).get(rid, 0)),
        }
    for row in prov_rows:
        rid = str(row.get("reg_id") or "").strip()
        if not rid:
            continue
        entry = by_id.setdefault(
            rid,
            {
                "reg_id": rid,
                "name": "",
                "short_name": "",
                "official_number": "",
                "description": "",
                "texts": [],
                "hit_count": 0,
            },
        )
        texts = row.get("texts") or []
        if isinstance(texts, list):
            for t in texts:
                s = str(t).strip()
                if s and s not in entry["texts"]:
                    entry["texts"].append(s)
        hc = row.get("hit_count")
        if hc is not None:
            entry["hit_count"] = max(entry["hit_count"], int(hc))
        sn = row.get("sample_name")
        if sn and not entry["name"]:
            entry["name"] = str(sn)
    return list(by_id.values())


def _fetch_documents_by_ids(driver: Any, database: str, ids: list[str]) -> list[dict[str, Any]]:
    keys = [str(i).strip() for i in ids if str(i).strip()]
    if not keys:
        return []
    try:
        with driver.session(database=database) as session:
            rows = [r.data() for r in session.run(DOCUMENTS_BY_IDS_CYPHER, ids=keys)]
    except Exception:  # noqa: BLE001
        return []
    return [
        {
            "reg_id": str(row.get("reg_id") or ""),
            "name": str(row.get("name") or ""),
            "short_name": str(row.get("short_name") or ""),
            "official_number": str(row.get("official_number") or ""),
            "description": str(row.get("description") or ""),
            "texts": [],
            "hit_count": 0,
        }
        for row in rows
    ]


def _catalog_search_patterns(catalog_code: str) -> list[str]:
    row = law_by_code(catalog_code) or {}
    patterns: list[str] = []
    if row.get("number"):
        patterns.append(str(row["number"]))
    if row.get("label"):
        patterns.append(str(row["label"]))
    for topic in _CATALOG_TOPICS.get(catalog_code, ())[:3]:
        patterns.append(topic)
    out: list[str] = []
    seen: set[str] = set()
    for raw in patterns:
        text = re.sub(r"\s+", " ", str(raw).strip())
        if len(text) >= 4 and text.lower() not in seen:
            seen.add(text.lower())
            out.append(text)
    return out[:4]


_SECONDARY_ANCHOR_PATTERNS: dict[str, tuple[str, ...]] = {
    "red": ("2022/30",),
}

_ALLOWED_SECONDARY_ACTS: frozenset[tuple[str, str]] = frozenset(
    {
        ("red", "2022/30"),
    }
)


def _title_matches_catalog_number(title: str, number: str) -> bool:
    num = (number or "").strip()
    if not num:
        return False
    if re.search(
        rf"(?:Regulation|Directive)\s*\((?:EU|EC)\)\s*{re.escape(num)}\b",
        title,
        re.I,
    ):
        return True
    return bool(re.search(rf"\b{re.escape(num)}\b", title))


def _score_catalog_document_candidate(
    title: str,
    *,
    catalog_code: str,
    pattern_text: str,
) -> int:
    if is_noise_document(title):
        return -1
    if catalog_code == "reach":
        if not _title_matches_catalog_number(title, "1907/2006"):
            return 0
    primary_code, _, primary_row = catalog_for_primary_document(title)
    if primary_code == catalog_code:
        return 1000
    if primary_row and primary_row.get("code") == catalog_code:
        return 950
    tier = classify_document_tier(title)
    related = infer_related_catalog_code(title)
    if related == catalog_code and tier in {"delegated", "implementing"}:
        return 850
    if (
        tier == "primary"
        and related == catalog_code
        and primary_code != catalog_code
    ):
        return 150
    expected = law_by_code(catalog_code) or {}
    if expected.get("number"):
        if _title_matches_catalog_number(title, expected["number"]):
            if catalog_code == primary_code:
                return 1000
            if re.search(r"\bderogation from\b|\bamending directive\b", title, re.I):
                return 100
            return 400
        if tier in {"primary", "council", "commission"}:
            return 0
    if pattern_text and pattern_text.lower() in title.lower():
        return 200
    return 0


def _matches_description_catalog(
    title: str,
    reg: dict[str, Any],
    desc_catalog: set[str],
) -> bool:
    if reg.get("catalog_anchor"):
        return str(reg.get("anchor_catalog_code") or "") in desc_catalog
    mapped = reg_id_to_code(str(reg.get("reg_id") or ""))
    tier = classify_document_tier(title)
    code = infer_catalog_code(title, str(reg.get("official_number") or ""))
    if re.search(r"\bderogation from\b", title, re.I):
        return False
    if tier == "primary" and (code in desc_catalog or mapped in desc_catalog):
        if re.search(r"\bamending directive\b", title, re.I) and code in desc_catalog:
            return False
        return True
    if tier in {"delegated", "implementing"}:
        parent = infer_related_catalog_code(title)
        number = _extract_number(title, str(reg.get("official_number") or ""))
        if (parent, number) in _ALLOWED_SECONDARY_ACTS:
            return True
        return False
    return mapped in desc_catalog or code in desc_catalog


def _fetch_catalog_anchor_documents(
    driver: Any,
    database: str,
    catalog_codes: list[str],
    *,
    include_secondary: bool = False,
) -> list[dict[str, Any]]:
    patterns: list[dict[str, str]] = []
    seen_codes: set[str] = set()
    for code in catalog_codes:
        if code in seen_codes:
            continue
        seen_codes.add(code)
        for text in _catalog_search_patterns(code):
            patterns.append({"code": code, "text": text})
        if include_secondary:
            for text in _SECONDARY_ANCHOR_PATTERNS.get(code, ()):
                patterns.append({"code": code, "text": text})
    if not patterns:
        return []

    rows: list[dict[str, Any]] = []
    with driver.session(database=database) as session:
        try:
            for code in catalog_codes:
                code_patterns = [p for p in patterns if p["code"] == code]
                if not code_patterns:
                    continue
                rows.extend(
                    r.data()
                    for r in session.run(
                        CATALOG_DOCUMENT_CANDIDATES_CYPHER,
                        patterns=code_patterns,
                    )
                )
        except Exception:  # noqa: BLE001
            return []

    best_by_code: dict[str, tuple[int, dict[str, Any]]] = {}
    for row in rows:
        catalog_code = str(row.get("catalog_code") or "")
        title = str(row.get("name") or "")
        reg_id = str(row.get("reg_id") or "")
        if not catalog_code or not reg_id or not title:
            continue
        score = _score_catalog_document_candidate(
            title,
            catalog_code=catalog_code,
            pattern_text=str(row.get("pattern_text") or ""),
        )
        if score < 200:
            continue
        tier = classify_document_tier(title)
        doc_number = _extract_number(title, title)
        if tier in {"delegated", "implementing"}:
            if (catalog_code, doc_number) not in _ALLOWED_SECONDARY_ACTS:
                continue
            anchor_key = f"{catalog_code}:{tier}:{doc_number}"
        else:
            anchor_key = catalog_code
        prev = best_by_code.get(anchor_key)
        if not prev or score > prev[0]:
            best_by_code[anchor_key] = (
                score,
                {
                    "reg_id": reg_id,
                    "name": title,
                    "catalog_code": catalog_code,
                },
            )

    anchored: list[dict[str, Any]] = []
    for _anchor_key, (_score, picked) in best_by_code.items():
        catalog_code = picked["catalog_code"]
        anchored.append(
            {
                "reg_id": picked["reg_id"],
                "name": picked["name"],
                "short_name": "",
                "official_number": "",
                "description": "",
                "texts": [],
                "hit_count": 0,
                "vector_hit_count": 1,
                "max_vector_score": 0.54,
                "catalog_anchor": True,
                "anchor_catalog_code": catalog_code,
            }
        )
    anchored_codes = {str(a.get("anchor_catalog_code") or "") for a in anchored}
    for code in catalog_codes:
        if code in anchored_codes:
            continue
        row = law_by_code(code)
        if not row:
            continue
        rid = "REG_" + code.upper().replace("AI_ACT", "AIACT")
        anchored.append(
            {
                "reg_id": rid,
                "name": row.get("label") or row.get("short") or code,
                "short_name": row.get("short") or "",
                "official_number": row.get("number") or "",
                "description": row.get("ui_label") or row.get("label") or "",
                "texts": [],
                "hit_count": 0,
                "vector_hit_count": 1,
                "max_vector_score": 0.52,
                "catalog_anchor": True,
                "anchor_catalog_code": code,
                "catalog_synthetic": True,
            }
        )
    return anchored


def _merge_regulation_lists(
    primary: list[dict[str, Any]],
    extra: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    seen = {str(r.get("reg_id") or "") for r in primary}
    merged = list(primary)
    for reg in extra:
        reg_id = str(reg.get("reg_id") or "")
        if reg_id and reg_id not in seen:
            seen.add(reg_id)
            merged.append(reg)
    return merged


def _vector_search_top_k(*, limit: int, full_scan: bool, regulation_count: int) -> int:
    if full_scan:
        return min(200, max(regulation_count, 80))
    if limit > 0:
        return max(limit * 12, 60)
    return min(200, max(regulation_count, 80))


def fetch_regulations_from_neo4j(
    driver: Any,
    database: str,
    *,
    query: str = "",
    allow_catalog_fallback: bool = False,
    skip_corpus: bool = False,
) -> list[dict[str, Any]]:
    terms = terms_from_question(query) if query.strip() else []
    reg_rows: list[dict[str, Any]] = []
    corpus_rows: list[dict[str, Any]] = []
    search_rows: list[dict[str, Any]] = []
    hit_counts: dict[str, int] = {}
    neo4j_errors: list[str] = []

    with driver.session(database=database) as session:
        try:
            reg_rows = [r.data() for r in session.run(REGULATIONS_CYPHER)]
        except Exception as exc:  # noqa: BLE001
            neo4j_errors.append(f"regulations: {exc}")
            reg_rows = []
        if not reg_rows:
            try:
                reg_rows = [r.data() for r in session.run(FALLBACK_REGULATIONS_CYPHER)]
            except Exception as exc:  # noqa: BLE001
                neo4j_errors.append(f"regulations_fallback: {exc}")
                reg_rows = []
        if not reg_rows:
            try:
                reg_rows = [r.data() for r in session.run(DOCUMENTS_REGULATIONS_CYPHER)]
            except Exception as exc:  # noqa: BLE001
                neo4j_errors.append(f"documents: {exc}")
                reg_rows = []
        if not skip_corpus:
            try:
                corpus_rows = [r.data() for r in session.run(CORPUS_BY_REG_CYPHER)]
            except Exception as exc:  # noqa: BLE001
                neo4j_errors.append(f"corpus: {exc}")
                corpus_rows = []
        if terms:
            try:
                search_rows = [r.data() for r in session.run(SEARCH_BY_TERMS_CYPHER, terms=terms)]
                for row in search_rows:
                    rid = str(row.get("reg_id") or "")
                    if rid:
                        hit_counts[rid] = int(row.get("hit_count") or 0)
            except Exception as exc:  # noqa: BLE001
                neo4j_errors.append(f"term_search: {exc}")
                search_rows = []

    if neo4j_errors and not reg_rows and not corpus_rows and not search_rows:
        if allow_catalog_fallback:
            return _catalog_as_regulations()
        raise RuntimeError("Neo4j legal graph queries failed: " + "; ".join(neo4j_errors))

    merged = _merge_regulation_rows(reg_rows, corpus_rows, hit_counts=hit_counts)
    if search_rows:
        merged = _merge_regulation_rows(merged, search_rows, hit_counts=hit_counts)

    if not merged:
        if allow_catalog_fallback:
            return _catalog_as_regulations()
        raise RuntimeError("Neo4j returned no regulation nodes")

    # Attach catalog metadata but do not use catalog-only rows for ranking
    for reg in merged:
        code = reg_id_to_code(str(reg.get("reg_id") or ""))
        catalog = law_by_code(code) or {}
        if not reg.get("name"):
            reg["name"] = catalog.get("label") or ""
        if not reg.get("short_name"):
            reg["short_name"] = catalog.get("short") or ""
        if not reg.get("official_number"):
            reg["official_number"] = catalog.get("number") or ""

    return merged


def _catalog_as_regulations() -> list[dict[str, Any]]:
    """Last-resort labels when Neo4j returns no regulation nodes."""
    rows: list[dict[str, Any]] = []
    for law in LAW_CATALOG:
        rid = "REG_" + law["code"].upper().replace("AI_ACT", "AIACT")
        rows.append(
            {
                "reg_id": rid,
                "name": law["label"],
                "short_name": law["short"],
                "official_number": law.get("number") or "",
                "description": law["label"],
                "texts": [],
                "hit_count": 0,
            }
        )
    return rows


def _regulation_title_blob(reg: dict[str, Any]) -> str:
    parts = [
        reg.get("name"),
        reg.get("short_name"),
        reg.get("description"),
        reg.get("official_number"),
    ]
    return " ".join(str(p) for p in parts if p).strip()


def _regulation_search_blob(reg: dict[str, Any]) -> str:
    texts = reg.get("texts") or []
    if isinstance(texts, list):
        text_block = " ".join(str(t) for t in texts[:20])
    else:
        text_block = str(texts)
    parts = [
        reg.get("name"),
        reg.get("short_name"),
        reg.get("description"),
        text_block,
        reg.get("official_number"),
    ]
    return " ".join(str(p) for p in parts if p).strip()


def _term_scores(query: str, regulations: list[dict[str, Any]], *, title_only: bool = False) -> list[float]:
    terms = _tokenize(query)
    if not terms:
        return [0.0] * len(regulations)
    scores: list[float] = []
    for reg in regulations:
        blob = (_regulation_title_blob if title_only else _regulation_search_blob)(reg).lower()
        hits = sum(1 for t in terms if t in blob)
        scores.append(hits / max(len(terms), 1))
    return scores


def _retrieval_scores(regulations: list[dict[str, Any]]) -> list[float]:
    max_hits = max((int(r.get("hit_count") or 0) for r in regulations), default=0)
    if max_hits <= 0:
        return [0.0] * len(regulations)
    return [int(r.get("hit_count") or 0) / max_hits for r in regulations]


def _vector_scores_raw(regulations: list[dict[str, Any]]) -> list[float]:
    """Cosine similarity from Neo4j (0–1); do not re-normalise to pool max."""
    return [
        min(1.0, max(0.0, float(r.get("max_vector_score") or 0.0)))
        for r in regulations
    ]


def _predicate_overlap_scores(
    kg_facts: list[dict[str, Any]] | None,
    regulations: list[dict[str, Any]],
) -> list[float]:
    preds = _predicate_terms_from_kg(kg_facts)
    if not preds:
        return [0.0] * len(regulations)
    scores: list[float] = []
    for reg in regulations:
        blob = _regulation_search_blob(reg).lower()
        hits = sum(1 for p in preds if p in blob)
        scores.append(hits / max(len(preds), 1))
    return scores


def _blend_vector_score(
    vec: float,
    ret: float,
    term: float,
    pred: float,
    *,
    with_retrieval: bool,
) -> float:
    """Combine cosine similarity with auxiliary signals; strong vectors keep absolute scale."""
    if with_retrieval:
        blended = 0.75 * vec + 0.08 * ret + 0.12 * term + 0.05 * pred
    else:
        blended = 0.86 * vec + 0.09 * term + 0.05 * pred
    if vec >= 0.72:
        blended = max(blended, vec * 0.90)
    return blended


def _calibrated_relevance_score(blended: float, vec_raw: float) -> float:
    """Map corpus-realistic cosine (often 0.45–0.58) onto the user-facing 0–1 scale."""
    if vec_raw <= 0:
        return blended
    # In this Aura corpus, strong matches peak near ~0.55 cosine — not 0.85+.
    anchor = 0.75 + min(0.22, max(0.0, (vec_raw - 0.47)) / 0.11 * 0.20)
    return min(1.0, max(blended, anchor))


def _passes_relevance_gate(
    reg: dict[str, Any],
    *,
    vec_raw: float,
    term: float,
    pred: float,
    is_catalog_primary: bool,
    include_secondary: bool,
) -> bool:
    if is_catalog_primary:
        return True
    vec_floor = 0.50 if include_secondary else 0.47
    term_floor = 0.30 if include_secondary else 0.22
    pred_floor = 0.18 if include_secondary else 0.15
    if vec_raw >= vec_floor and int(reg.get("vector_hit_count") or 0) >= 1:
        return True
    if term >= term_floor:
        return True
    if pred >= pred_floor:
        return True
    return False


def _is_catalog_primary(reg: dict[str, Any], title: str) -> bool:
    primary_code, _, _ = catalog_for_primary_document(
        title, str(reg.get("official_number") or "")
    )
    if primary_code:
        return True
    mapped = reg_id_to_code(str(reg.get("reg_id") or ""))
    return bool(law_by_code(mapped))


def _stable_row_code(reg_id: str, catalog_code: str) -> str:
    rid = (reg_id or "").strip()
    if is_uuid_slug(rid.replace("-", "_")) or re.match(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
        rid,
        re.I,
    ):
        return rid.lower()
    mapped = reg_id_to_code(rid)
    if mapped and not is_uuid_slug(mapped):
        return mapped
    if catalog_code:
        return catalog_code
    return mapped or rid.lower()


def _humanize_match_rationale(
    *,
    vector_hits: int,
    term_hits: int,
    pred_score: float,
    ret_score: float,
    has_vector: bool,
) -> str:
    parts: list[str] = []
    if vector_hits > 0:
        parts.append("Semantically similar to your product profile")
    if term_hits > 0:
        parts.append("Strong keyword overlap with your product description")
    if pred_score > 0:
        parts.append("Matches facts from your product graph")
    if ret_score > 0 and not has_vector:
        parts.append("Matched provisions in the legal corpus")
    return "; ".join(parts)


def _format_result(
    reg: dict[str, Any],
    score: float,
    *,
    match_rationale: str = "",
) -> dict[str, Any]:
    reg_id = str(reg.get("reg_id") or "")
    title = str(reg.get("name") or "")
    texts = reg.get("texts") or []
    text_block = ""
    if isinstance(texts, list) and texts:
        text_block = str(texts[0])

    display = parse_document_display(
        title,
        official_number=str(reg.get("official_number") or ""),
        short_name=str(reg.get("short_name") or ""),
        description=str(reg.get("description") or ""),
        provision_excerpt=text_block,
    )

    catalog_code = display["catalog_code"] or ""
    if not catalog_code:
        mapped = reg_id_to_code(reg_id)
        if mapped and not is_uuid_slug(mapped):
            catalog_code = mapped

    code = _stable_row_code(reg_id, catalog_code)
    catalog = law_by_code(catalog_code) or law_by_code(reg_id_to_code(reg_id)) or {}

    number = display["number"] or catalog.get("number") or ""
    if not number:
        number = _extract_number(title, _regulation_search_blob(reg))

    short = display["short"] or ""
    if not short and catalog.get("short"):
        short = catalog["short"]
    elif not short:
        short = catalog.get("label") or ""
    if short and len(short) > 48 and catalog.get("short"):
        short = catalog["short"]
    if is_uuid_slug(short.replace("-", "_")):
        short = display["full_title"][:40].rstrip()
        if len(display["full_title"]) > 40:
            short += "…"

    full_title = display.get("full_title") or title or short
    topics = display.get("description")
    if isinstance(topics, list):
        keywords = [str(k).strip() for k in topics if str(k).strip()]
        keyword_line = ", ".join(keywords)
    else:
        keywords = []
        keyword_line = str(topics or "").strip()
    summary = title_summary(full_title) or keyword_line or short
    if not keyword_line and summary:
        keyword_line = summary

    engine_code = catalog_code or (code if code in {r["code"] for r in LAW_CATALOG} else "")
    document_tier = display.get("document_tier") or classify_document_tier(title)
    ui_label = format_product_ui_label(
        title,
        official_number=str(reg.get("official_number") or number or ""),
        catalog_code=catalog_code,
        document_tier=document_tier,
        catalog_row=catalog or None,
        provision_excerpt=text_block,
    )
    legal_instrument = format_legal_instrument(
        title,
        official_number=str(reg.get("official_number") or number or ""),
        catalog_code=catalog_code,
        document_tier=document_tier,
        catalog_row=catalog or None,
    )
    return {
        "code": code,
        "short": short,
        "number": number or "—",
        "summary": _excerpt(summary, 220),
        "keywords": keywords[:6],
        "description": _excerpt(keyword_line, 300),
        "score": round(max(0.0, min(1.0, score)), 4),
        "reg_id": reg_id,
        "label": _excerpt(summary, 220),
        "ui_label": ui_label,
        "legal_instrument": legal_instrument,
        "catalog_code": catalog_code or None,
        "document_tier": document_tier,
        "engine_mode": engine_mode_for(engine_code or catalog_code or reg_id_to_code(reg_id)),
        "hit_count": int(reg.get("hit_count") or 0),
        "match_rationale": match_rationale or "",
    }


def _result_dedup_key(row: dict[str, Any]) -> str:
    tier = str(row.get("document_tier") or "")
    catalog_code = str(row.get("catalog_code") or "").strip()
    number = str(row.get("number") or "").strip()
    if catalog_code and tier in {"delegated", "implementing"} and number and number != "—":
        return f"catalog:{catalog_code}:{number}"
    if catalog_code and tier not in {"delegated", "implementing"}:
        return f"catalog:{catalog_code}:instrument"
    if tier == "primary" and catalog_code:
        return f"primary:{catalog_code}"
    if number and number != "—":
        return f"num:{number}"
    return f"code:{row.get('code')}"


def rank_regulations(
    query: str,
    regulations: list[dict[str, Any]],
    *,
    limit: int = 0,
    min_score: float = 0.75,
    include_secondary: bool = False,
    kg_facts: list[dict[str, Any]] | None = None,
    vector_ranked: bool = False,
    description_catalog_codes: list[str] | None = None,
) -> tuple[list[dict[str, Any]], str, int, int]:
    if not regulations:
        return [], "none", 0, 0

    pool: list[dict[str, Any]] = []
    for reg in regulations:
        blob_len = len(_regulation_search_blob(reg))
        hits = int(reg.get("hit_count") or 0)
        vector_hits = int(reg.get("vector_hit_count") or 0)
        if blob_len >= MIN_RANK_BLOB_CHARS or hits > 0 or vector_hits > 0:
            pool.append(reg)

    if not pool:
        pool = [
            r
            for r in regulations
            if int(r.get("hit_count") or 0) > 0 or int(r.get("vector_hit_count") or 0) > 0
        ]
    if not pool:
        pool = list(regulations)

    vector = _vector_scores_raw(pool) if vector_ranked else [0.0] * len(pool)
    term = _term_scores(query, pool, title_only=vector_ranked and any(
        float(r.get("max_vector_score") or 0.0) for r in pool
    ))
    retrieval = _retrieval_scores(pool)
    pred_overlap = _predicate_overlap_scores(kg_facts, pool)

    has_vector = vector_ranked and any(vector)
    has_retrieval = any(retrieval)

    if has_vector:
        if has_retrieval:
            raw = [
                min(1.0, _blend_vector_score(v, r, t, p, with_retrieval=True))
                for v, r, t, p in zip(vector, retrieval, term, pred_overlap)
            ]
            method = "neo4j_vector+retrieval+terms+predicates"
        else:
            raw = [
                min(1.0, _blend_vector_score(v, 0.0, t, p, with_retrieval=False))
                for v, t, p in zip(vector, term, pred_overlap)
            ]
            method = "neo4j_vector+terms+predicates"
    elif has_retrieval:
        raw = [
            min(1.0, 0.50 * r + 0.35 * t + 0.15 * p)
            for r, t, p in zip(retrieval, term, pred_overlap)
        ]
        method = "retrieval+terms+predicates"
    else:
        raw = [min(1.0, 0.75 * t + 0.25 * p) for t, p in zip(term, pred_overlap)]
        method = "fallback_no_neo4j_vectors" if vector_ranked else "terms+predicates"

    ranked = sorted(
        zip(raw, pool, retrieval, term, pred_overlap, vector),
        key=lambda x: x[0],
        reverse=True,
    )
    effective_min = min_score + (0.05 if include_secondary else 0.0)
    desc_catalog = set(description_catalog_codes or [])
    total_ranked = sum(1 for score, *_rest in ranked if score > 0)
    out: list[dict[str, Any]] = []
    seen_dedup: set[str] = set()
    total_passing = 0
    for score, reg, ret_score, term_score, pred_score, vec_raw in ranked:
        if score <= 0:
            continue
        title = str(reg.get("name") or "")
        if is_noise_document(title):
            continue
        if desc_catalog and not _matches_description_catalog(title, reg, desc_catalog):
            continue
        tier = classify_document_tier(title)
        is_catalog_primary = _is_catalog_primary(reg, title)
        if should_exclude_tier(
            tier,
            include_secondary=include_secondary,
            is_catalog_primary=is_catalog_primary,
        ):
            continue
        if not _passes_relevance_gate(
            reg,
            vec_raw=vec_raw,
            term=term_score,
            pred=pred_score,
            is_catalog_primary=is_catalog_primary,
            include_secondary=include_secondary,
        ):
            continue
        adjusted = max(
            0.0,
            score - (0.0 if is_catalog_primary else tier_score_penalty(tier)),
        )
        adjusted = _calibrated_relevance_score(adjusted, vec_raw)
        title_code = infer_catalog_code(title, str(reg.get("official_number") or ""))
        anchor_code = str(reg.get("anchor_catalog_code") or "")
        if reg.get("catalog_anchor") and anchor_code in desc_catalog:
            adjusted = max(adjusted, 0.92)
        elif title_code and title_code in desc_catalog:
            adjusted = min(1.0, adjusted + 0.10)
        if desc_catalog and not include_secondary:
            if (
                not reg.get("catalog_anchor")
                and title_code not in desc_catalog
                and tier not in {"primary", "council"}
                and adjusted < 0.82
            ):
                continue
        if adjusted < effective_min:
            continue
        rationale_parts: list[str] = []
        vh = int(reg.get("vector_hit_count") or 0)
        th = int(reg.get("hit_count") or 0)
        match_text = _humanize_match_rationale(
            vector_hits=vh,
            term_hits=th,
            pred_score=pred_score,
            ret_score=ret_score,
            has_vector=vec_raw > 0,
        )
        row = _format_result(reg, adjusted, match_rationale=match_text)
        row["rank_method"] = method
        dedup_key = _result_dedup_key(row)
        if dedup_key in seen_dedup:
            continue
        seen_dedup.add(dedup_key)
        total_passing += 1
        if limit <= 0 or len(out) < limit:
            out.append(row)

    return out, method, total_ranked, total_passing


def _fill_missing_catalog_rows(
    results: list[dict[str, Any]],
    regulations: list[dict[str, Any]],
    description_catalog_codes: list[str],
    *,
    limit: int,
) -> list[dict[str, Any]]:
    if not description_catalog_codes:
        return results
    out = list(results)
    present = {str(r.get("catalog_code") or "") for r in out if r.get("catalog_code")}
    for code in description_catalog_codes:
        if code in present:
            continue
        reg = next(
            (
                r
                for r in regulations
                if r.get("catalog_anchor") and str(r.get("anchor_catalog_code") or "") == code
            ),
            None,
        )
        if not reg:
            continue
        row = _format_result(reg, 0.92, match_rationale="Matched from EU law catalog for your product profile")
        row["rank_method"] = "catalog_anchor_fill"
        out.append(row)
        present.add(code)
        if limit > 0 and len(out) >= limit:
            break
    return out[:limit] if limit > 0 else out


def scan_relevant_laws(
    *,
    description: str,
    kg_facts: list[dict[str, Any]] | None = None,
    limit: int = 15,
    min_score: float = 0.75,
    include_secondary: bool = False,
    full_scan: bool = False,
    get_legal_driver_fn: Callable[[], Any],
    resolve_database_fn: Callable[[], str],
) -> dict[str, Any]:
    """Run law relevance scan against Neo4j legal graph."""
    from logic.prototype_fast import (
        catalog_scan_response,
        get_cached_scan,
        is_prototype_mode,
        put_cached_scan,
        scan_cache_key,
    )

    cache_key = scan_cache_key(
        description,
        limit=limit,
        min_score=min_score,
        include_secondary=include_secondary,
        full_scan=full_scan,
    )
    cached = get_cached_scan(cache_key)
    if cached is not None:
        return cached

    if is_prototype_mode() and not full_scan:
        catalog_resp = catalog_scan_response(
            description,
            limit=limit,
            min_score=min_score,
            include_secondary=include_secondary,
        )
        if catalog_resp is not None:
            put_cached_scan(cache_key, catalog_resp)
            return catalog_resp

    if legal_graph_backend() == "local":
        raise RuntimeError(
            "Law scan requires Neo4j legal Aura (twin_p corpus). Set LEGAL_GRAPH_BACKEND=neo4j "
            "in .env.local — local CSV export is not sufficient for regulation-level scan."
        )
    if not neo4j_legal_configured():
        raise RuntimeError(
            "NEO4J_LEGAL_URI and NEO4J_LEGAL_PASSWORD must be set for law scan."
        )
    # Product law scan ranks against the user's written description only.
    scan_query = build_scan_query(description, None)
    description_catalog_codes = catalog_codes_from_description(description)
    driver = get_legal_driver_fn()
    database = resolve_database_fn()

    profile = load_embedding_profile(driver, database)
    regulations: list[dict[str, Any]] = []
    vector_used = False
    fast_path = profile.usable() and not full_scan

    if fast_path:
        query_vector = embed_query(scan_query, profile)
        if query_vector:
            hits = vector_search_hits(
                driver,
                database,
                profile,
                query_vector,
                top_k=_vector_search_top_k(
                    limit=limit, full_scan=False, regulation_count=0
                ),
            )
            vector_by_reg = aggregate_hits_by_regulation(hits)
            vector_used = bool(vector_by_reg)
            if vector_by_reg:
                doc_ids = list(vector_by_reg.keys())
                regulations = _fetch_documents_by_ids(driver, database, doc_ids)
                reg_metadata = fetch_document_metadata_for_ids(driver, database, doc_ids)
                regulations = merge_vector_hits_into_regulations(
                    regulations, vector_by_reg, reg_metadata
                )

    if description_catalog_codes:
        anchored = _fetch_catalog_anchor_documents(
            driver,
            database,
            description_catalog_codes,
            include_secondary=include_secondary,
        )
        if anchored:
            regulations = _merge_regulation_lists(regulations, anchored)

    if not regulations:
        try:
            regulations = fetch_regulations_from_neo4j(
                driver,
                database,
                query=scan_query,
                skip_corpus=fast_path or profile.usable(),
            )
        except RuntimeError as exc:
            if profile.usable() and "no regulation nodes" in str(exc).lower():
                regulations = []
            else:
                raise

        if profile.usable():
            query_vector = embed_query(scan_query, profile)
            if query_vector:
                hits = vector_search_hits(
                    driver,
                    database,
                    profile,
                    query_vector,
                    top_k=_vector_search_top_k(
                        limit=limit,
                        full_scan=full_scan,
                        regulation_count=len(regulations),
                    ),
                )
                vector_by_reg = aggregate_hits_by_regulation(hits)
                if full_scan:
                    reg_metadata = {
                        **fetch_legal_entity_metadata(driver, database),
                        **fetch_document_metadata(driver, database),
                    }
                else:
                    reg_metadata = fetch_document_metadata_for_ids(
                        driver, database, list(vector_by_reg.keys())
                    )
                regulations = merge_vector_hits_into_regulations(
                    regulations, vector_by_reg, reg_metadata
                )
                vector_used = bool(vector_by_reg)

    if not regulations:
        raise RuntimeError("Neo4j returned no regulation nodes")

    rank_limit = 0 if full_scan else limit
    results, rank_method, total_ranked, total_passing = rank_regulations(
        scan_query,
        regulations,
        limit=rank_limit,
        min_score=min_score,
        include_secondary=include_secondary,
        kg_facts=None,
        vector_ranked=profile.usable(),
        description_catalog_codes=description_catalog_codes,
    )
    if description_catalog_codes and not full_scan:
        results = _fill_missing_catalog_rows(
            results,
            regulations,
            description_catalog_codes,
            limit=rank_limit or limit,
        )
    corpus_chars = sum(len(_regulation_search_blob(r)) for r in regulations)
    total_hits = sum(int(r.get("hit_count") or 0) for r in regulations)
    total_vector_hits = sum(int(r.get("vector_hit_count") or 0) for r in regulations)
    payload = {
        "version": 1,
        "scan_query": scan_query,
        "backend": "neo4j",
        "regulation_count": len(regulations),
        "corpus_chars": corpus_chars,
        "total_ranked": total_ranked,
        "match_count": len(results),
        "total_match_count": total_passing,
        "min_score": min_score,
        "include_secondary": include_secondary,
        "full_scan": full_scan,
        "display_limit": limit if not full_scan else 0,
        "total_hits": total_hits,
        "total_vector_hits": total_vector_hits,
        "results": results,
        "rank_method": rank_method,
        "embedding_search": {
            "has_neo4j_embeddings": profile.has_embeddings,
            "vector_search_used": vector_used,
            "dimensions": profile.dimensions,
            "vector_property": profile.vector_property,
            "vector_index": profile.vector_index_name,
            "query_provider": profile.query_provider if vector_used else "",
            "query_model": profile.query_model if vector_used else "",
        },
    }
    put_cached_scan(cache_key, payload)
    return payload
