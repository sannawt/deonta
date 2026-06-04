"""Semantic / term relevance scan over structured legal DB (Neo4j legal Aura, twin_p corpus)."""

from __future__ import annotations

import re
from typing import Any, Callable

from logic.legal_db import LAW_CATALOG, engine_mode_for, law_by_code, neo4j_legal_configured
from logic.local_legal_store import legal_graph_backend
from logic.neo4j_embedding_config import load_embedding_profile
from logic.neo4j_vector_search import (
    aggregate_hits_by_regulation,
    fetch_document_metadata,
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


def fetch_regulations_from_neo4j(
    driver: Any,
    database: str,
    *,
    query: str = "",
    allow_catalog_fallback: bool = False,
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


def _term_scores(query: str, regulations: list[dict[str, Any]]) -> list[float]:
    terms = _tokenize(query)
    if not terms:
        return [0.0] * len(regulations)
    scores: list[float] = []
    for reg in regulations:
        blob = _regulation_search_blob(reg).lower()
        hits = sum(1 for t in terms if t in blob)
        scores.append(hits / max(len(terms), 1))
    return scores


def _retrieval_scores(regulations: list[dict[str, Any]]) -> list[float]:
    max_hits = max((int(r.get("hit_count") or 0) for r in regulations), default=0)
    if max_hits <= 0:
        return [0.0] * len(regulations)
    return [int(r.get("hit_count") or 0) / max_hits for r in regulations]


def _vector_retrieval_scores(regulations: list[dict[str, Any]]) -> list[float]:
    max_score = max((float(r.get("max_vector_score") or 0.0) for r in regulations), default=0.0)
    if max_score <= 0:
        return [0.0] * len(regulations)
    return [float(r.get("max_vector_score") or 0.0) / max_score for r in regulations]


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


def _normalize_scores(values: list[float]) -> list[float]:
    if not values:
        return values
    lo = min(values)
    hi = max(values)
    if hi <= lo:
        return [1.0 if v > 0 else 0.0 for v in values]
    return [(v - lo) / (hi - lo) for v in values]


def _format_result(
    reg: dict[str, Any],
    score: float,
    *,
    match_rationale: str = "",
) -> dict[str, Any]:
    reg_id = str(reg.get("reg_id") or "")
    code = reg_id_to_code(reg_id)
    catalog = law_by_code(code) or {}
    texts = reg.get("texts") or []
    text_block = ""
    if isinstance(texts, list) and texts:
        text_block = _excerpt(str(texts[0]), 280)
    desc = str(reg.get("description") or "").strip()
    if desc in (catalog.get("label") or "", catalog.get("short") or ""):
        desc = ""
    if not desc:
        desc = text_block
    if not desc:
        desc = str(reg.get("name") or catalog.get("label") or code)
    number = str(reg.get("official_number") or "").strip()
    if not number:
        number = catalog.get("number") or ""
    if not number:
        number = _extract_number(desc, _regulation_search_blob(reg), str(reg.get("name") or ""))
    short = (
        str(reg.get("short_name") or "").strip()
        or catalog.get("short")
        or catalog.get("label")
        or code.upper()
    )
    return {
        "code": code,
        "short": short,
        "number": number or "—",
        "description": _excerpt(desc, 300),
        "score": round(max(0.0, min(1.0, score)), 4),
        "reg_id": reg_id,
        "label": catalog.get("label") or str(reg.get("name") or short),
        "engine_mode": engine_mode_for(code),
        "hit_count": int(reg.get("hit_count") or 0),
        "match_rationale": match_rationale or "",
    }


def rank_regulations(
    query: str,
    regulations: list[dict[str, Any]],
    *,
    limit: int = 10,
    kg_facts: list[dict[str, Any]] | None = None,
    vector_ranked: bool = False,
) -> tuple[list[dict[str, Any]], str]:
    if not regulations:
        return [], "none"

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

    vector = _vector_retrieval_scores(pool) if vector_ranked else [0.0] * len(pool)
    term = _term_scores(query, pool)
    retrieval = _retrieval_scores(pool)
    pred_overlap = _predicate_overlap_scores(kg_facts, pool)

    has_vector = vector_ranked and any(vector)
    has_retrieval = any(retrieval)

    if has_vector:
        if has_retrieval:
            raw = [
                0.45 * v + 0.25 * r + 0.15 * t + 0.15 * p
                for v, r, t, p in zip(vector, retrieval, term, pred_overlap)
            ]
            method = "neo4j_vector+retrieval+terms+predicates"
        else:
            raw = [0.60 * v + 0.25 * t + 0.15 * p for v, t, p in zip(vector, term, pred_overlap)]
            method = "neo4j_vector+terms+predicates"
    elif has_retrieval:
        raw = [0.55 * r + 0.25 * t + 0.20 * p for r, t, p in zip(retrieval, term, pred_overlap)]
        method = "retrieval+terms+predicates"
    else:
        raw = [0.70 * t + 0.30 * p for t, p in zip(term, pred_overlap)]
        method = "fallback_no_neo4j_vectors" if vector_ranked else "terms+predicates"

    raw = _normalize_scores(raw)
    ranked = sorted(
        zip(raw, pool, retrieval, pred_overlap, vector),
        key=lambda x: x[0],
        reverse=True,
    )
    out: list[dict[str, Any]] = []
    for score, reg, ret_score, pred_score, vec_score in ranked[:limit]:
        if score <= 0 and out:
            break
        rationale_parts: list[str] = []
        vh = int(reg.get("vector_hit_count") or 0)
        if vh > 0:
            rationale_parts.append(f"{vh} semantically similar provisions")
        if int(reg.get("hit_count") or 0) > 0 and not vh:
            rationale_parts.append(f"{reg.get('hit_count')} matching provisions")
        elif int(reg.get("hit_count") or 0) > 0:
            rationale_parts.append(f"{reg.get('hit_count')} term matches")
        if pred_score > 0:
            rationale_parts.append("predicate overlap with product facts")
        if ret_score > 0 and not vh:
            rationale_parts.append("term retrieval match")
        row = _format_result(reg, score, match_rationale="; ".join(rationale_parts))
        row["rank_method"] = method
        out.append(row)

    return out, method


def scan_relevant_laws(
    *,
    description: str,
    kg_facts: list[dict[str, Any]] | None = None,
    limit: int = 10,
    get_legal_driver_fn: Callable[[], Any],
    resolve_database_fn: Callable[[], str],
) -> dict[str, Any]:
    """Run law relevance scan against Neo4j legal graph."""
    if legal_graph_backend() == "local":
        raise RuntimeError(
            "Law scan requires Neo4j legal Aura (twin_p corpus). Set LEGAL_GRAPH_BACKEND=neo4j "
            "in .env.local — local CSV export is not sufficient for regulation-level scan."
        )
    if not neo4j_legal_configured():
        raise RuntimeError(
            "NEO4J_LEGAL_URI and NEO4J_LEGAL_PASSWORD must be set for law scan."
        )
    scan_query = build_scan_query(description, kg_facts)
    driver = get_legal_driver_fn()
    database = resolve_database_fn()

    profile = load_embedding_profile(driver, database)
    try:
        regulations = fetch_regulations_from_neo4j(driver, database, query=scan_query)
    except RuntimeError as exc:
        if profile.usable() and "no regulation nodes" in str(exc).lower():
            regulations = []
        else:
            raise

    vector_used = False
    if profile.usable():
        query_vector = embed_query(scan_query, profile)
        if query_vector:
            hits = vector_search_hits(driver, database, profile, query_vector, top_k=max(limit * 4, 40))
            vector_by_reg = aggregate_hits_by_regulation(hits)
            reg_metadata = {
                **fetch_legal_entity_metadata(driver, database),
                **fetch_document_metadata(driver, database),
            }
            regulations = merge_vector_hits_into_regulations(
                regulations, vector_by_reg, reg_metadata
            )
            vector_used = bool(vector_by_reg)

    if not regulations:
        raise RuntimeError("Neo4j returned no regulation nodes")

    results, rank_method = rank_regulations(
        scan_query,
        regulations,
        limit=limit,
        kg_facts=kg_facts,
        vector_ranked=profile.usable(),
    )
    corpus_chars = sum(len(_regulation_search_blob(r)) for r in regulations)
    return {
        "version": 1,
        "scan_query": scan_query,
        "backend": "neo4j",
        "regulation_count": len(regulations),
        "corpus_chars": corpus_chars,
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
