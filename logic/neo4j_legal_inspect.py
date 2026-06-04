"""Read-only snapshot of the Neo4j legal Aura corpus (twin_p-style graph)."""

from __future__ import annotations

from typing import Any, Callable

from logic.law_relevance_scan import (
    CORPUS_BY_REG_CYPHER,
    REGULATIONS_CYPHER,
    _regulation_search_blob,
)
from logic.reg_id_map import reg_id_to_code
from logic.neo4j_embedding_discovery import (
    discover_embedding_profile,
    discover_regulation_linkage,
)

LABEL_COUNTS_CYPHER = """
MATCH (n)
UNWIND labels(n) AS label
RETURN label, count(*) AS count
ORDER BY count DESC, label
LIMIT 40
"""

REL_TYPES_CYPHER = """
CALL db.relationshipTypes() YIELD relationshipType
RETURN relationshipType
ORDER BY relationshipType
LIMIT 40
"""

SAMPLE_TEXT_NODES_CYPHER = """
MATCH (n)
WHERE n.text IS NOT NULL AND size(toString(n.text)) > 40
RETURN labels(n) AS labels,
       coalesce(n.id, n.long_id, elementId(n)) AS node_id,
       coalesce(n.regulation_id, n.regulationId) AS regulation_id,
       coalesce(n.name, n.title, '') AS name,
       left(toString(n.text), 240) AS text_preview
ORDER BY size(toString(n.text)) DESC
LIMIT 12
"""

PROPERTY_KEYS_CYPHER = """
MATCH (n)
WHERE n.text IS NOT NULL AND size(toString(n.text)) > 40
WITH n LIMIT 1
RETURN keys(n) AS keys
"""


def inspect_legal_graph(
    *,
    get_legal_driver_fn: Callable[[], Any],
    resolve_database_fn: Callable[[], str],
) -> dict[str, Any]:
    driver = get_legal_driver_fn()
    database = resolve_database_fn()

    def run(cypher: str, **params: Any) -> list[dict[str, Any]]:
        with driver.session(database=database) as session:
            return [r.data() for r in session.run(cypher, **params)]

    def session_runner(cypher: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        return run(cypher, **params)

    embedding_profile = discover_embedding_profile(session_runner)
    regulation_linkage = discover_regulation_linkage(session_runner)

    label_counts = run(LABEL_COUNTS_CYPHER)
    rel_types = [row.get("relationshipType") for row in run(REL_TYPES_CYPHER)]
    regulations = run(REGULATIONS_CYPHER)
    corpus_rows = run(CORPUS_BY_REG_CYPHER)
    sample_text_nodes = run(SAMPLE_TEXT_NODES_CYPHER)
    prop_keys = run(PROPERTY_KEYS_CYPHER)

    corpus_by_reg: list[dict[str, Any]] = []
    for row in corpus_rows:
        rid = str(row.get("reg_id") or "")
        texts = row.get("texts") or []
        text_chars = sum(len(str(t)) for t in texts) if isinstance(texts, list) else 0
        corpus_by_reg.append(
            {
                "reg_id": rid,
                "code": reg_id_to_code(rid),
                "text_chunks": len(texts) if isinstance(texts, list) else 0,
                "text_chars": text_chars,
                "sample_name": row.get("sample_name") or "",
                "first_text_preview": (
                    str(texts[0])[:200] + "…"
                    if isinstance(texts, list) and texts and len(str(texts[0])) > 200
                    else (str(texts[0]) if isinstance(texts, list) and texts else "")
                ),
            }
        )

    reg_summaries: list[dict[str, Any]] = []
    merged: dict[str, dict[str, Any]] = {str(r.get("reg_id") or ""): dict(r) for r in regulations}
    for row in corpus_rows:
        rid = str(row.get("reg_id") or "")
        if rid in merged:
            merged[rid]["texts"] = row.get("texts") or []
        else:
            merged[rid] = {"reg_id": rid, "texts": row.get("texts") or []}
    for rid, reg in merged.items():
        if not rid:
            continue
        blob = _regulation_search_blob(reg)
        reg_summaries.append(
            {
                "reg_id": rid,
                "code": reg_id_to_code(rid),
                "name": reg.get("name") or "",
                "short_name": reg.get("short_name") or "",
                "official_number": reg.get("official_number") or "",
                "search_blob_chars": len(blob),
                "description_preview": str(reg.get("description") or "")[:160],
            }
        )
    reg_summaries.sort(key=lambda x: -x["search_blob_chars"])

    total_text_chars = sum(r["text_chars"] for r in corpus_by_reg)
    total_text_nodes = sum(
        row.get("count", 0)
        for row in label_counts
        if row.get("label") in ("Article", "Recital", "Provision", "Paragraph", "Point")
    )

    return {
        "version": 1,
        "database": database,
        "label_counts": label_counts,
        "relationship_types": rel_types,
        "regulation_nodes": reg_summaries,
        "corpus_by_regulation": sorted(corpus_by_reg, key=lambda x: -x["text_chars"]),
        "totals": {
            "regulation_nodes": len(regulations),
            "corpus_text_chars": total_text_chars,
            "provision_like_nodes": total_text_nodes,
        },
        "sample_text_nodes": sample_text_nodes,
        "sample_text_node_keys": (prop_keys[0].get("keys") if prop_keys else []),
        "embedding_profile": embedding_profile,
        "regulation_linkage": regulation_linkage,
    }
