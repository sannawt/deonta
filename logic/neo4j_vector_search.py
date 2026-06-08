"""Neo4j vector similarity search over stored legal embeddings."""

from __future__ import annotations

from typing import Any

from logic.reg_id_map import normalize_reg_key
from logic.neo4j_embedding_config import EmbeddingProfile

VECTOR_INDEX_QUERY = """
CALL db.index.vector.queryNodes($indexName, $topK, $queryVector)
YIELD node, score
RETURN
  labels(node) AS labels,
  elementId(node) AS node_id,
  score,
  coalesce(
    node.doc_id, node.document_id, node.documentId,
    node.regulation_id, node.regulationId,
    node.legal_entity_id, node.legalEntityId,
    node.celex, node.code, node.id, ''
  ) AS reg_key,
  coalesce(node.title, node.name, node.long_id, '') AS title,
  left(toString(coalesce(node.text, node.body, node.content, '')), 240) AS text_preview
ORDER BY score DESC
LIMIT $topK
"""

COSINE_EMBEDDING_QUERY = """
MATCH (n)
WHERE any(l IN $labels WHERE l IN labels(n)) AND n.embedding IS NOT NULL
WITH n, vector.similarity.cosine(n.embedding, $queryVector) AS score
WHERE score > 0
RETURN
  labels(n) AS labels,
  elementId(n) AS node_id,
  score,
  coalesce(
    n.doc_id, n.document_id, n.documentId,
    n.regulation_id, n.regulationId,
    n.legal_entity_id, n.legalEntityId,
    n.celex, n.code, n.id, ''
  ) AS reg_key,
  coalesce(n.title, n.name, n.long_id, '') AS title,
  left(toString(coalesce(n.text, n.body, n.content, '')), 240) AS text_preview
ORDER BY score DESC
LIMIT $topK
"""

COSINE_TEXT_EMBEDDINGS_QUERY = """
MATCH (n)
WHERE any(l IN $labels WHERE l IN labels(n)) AND n.text_embeddings IS NOT NULL AND size(n.text_embeddings) > 0
WITH n,
  CASE
    WHEN size(n.text_embeddings) > 0 AND n.text_embeddings[0] IS NOT NULL AND size(n.text_embeddings[0]) > 1
    THEN n.text_embeddings[0]
    ELSE n.text_embeddings
  END AS vec
WITH n, vec, vector.similarity.cosine(vec, $queryVector) AS score
WHERE score > 0
RETURN
  labels(n) AS labels,
  elementId(n) AS node_id,
  score,
  coalesce(
    n.doc_id, n.document_id, n.documentId,
    n.regulation_id, n.regulationId,
    n.legal_entity_id, n.legalEntityId,
    n.celex, n.code, n.id, ''
  ) AS reg_key,
  coalesce(n.title, n.name, n.long_id, '') AS title,
  left(toString(coalesce(n.text, n.body, n.content, '')), 240) AS text_preview
ORDER BY score DESC
LIMIT $topK
"""

LEGAL_ENTITY_ENRICH_QUERY = """
MATCH (le:LegalEntity)
RETURN
  coalesce(le.id, le.regulation_id, le.regulationId, le.code, elementId(le)) AS reg_key,
  coalesce(le.name, le.title, '') AS name,
  coalesce(le.short_name, le.shortName, le.number, '') AS short_name,
  coalesce(le.official_number, le.number, le.celex, '') AS official_number
"""

DOCUMENT_ENRICH_QUERY = """
MATCH (d:Document)
RETURN
  coalesce(d.id, elementId(d)) AS reg_key,
  coalesce(d.title, d.name, '') AS name,
  '' AS short_name,
  '' AS official_number
"""

DOCUMENT_ENRICH_BY_IDS_QUERY = """
UNWIND $ids AS doc_id
MATCH (d:Document)
WHERE d.id = doc_id
RETURN
  coalesce(d.id, elementId(d)) AS reg_key,
  coalesce(d.title, d.name, '') AS name,
  '' AS short_name,
  '' AS official_number
"""


def _cosine_query_for_property(vector_property: str) -> str:
    if vector_property == "text_embeddings":
        return COSINE_TEXT_EMBEDDINGS_QUERY
    return COSINE_EMBEDDING_QUERY


def vector_search_hits(
    driver: Any,
    database: str,
    profile: EmbeddingProfile,
    query_vector: list[float],
    *,
    top_k: int = 40,
) -> list[dict[str, Any]]:
    """Run vector similarity search; never returns stored embedding arrays."""
    if not query_vector or not profile.usable():
        return []
    if len(query_vector) != profile.dimensions:
        return []

    labels = list(profile.search_labels) or list(profile.vector_index_labels)
    hits: list[dict[str, Any]] = []

    with driver.session(database=database) as session:
        if profile.vector_index_name:
            try:
                rows = session.run(
                    VECTOR_INDEX_QUERY,
                    indexName=profile.vector_index_name,
                    topK=top_k,
                    queryVector=query_vector,
                )
                hits = [r.data() for r in rows]
            except Exception:  # noqa: BLE001
                hits = []

        if not hits and labels:
            cypher = _cosine_query_for_property(profile.vector_property)
            try:
                rows = session.run(
                    cypher,
                    labels=labels,
                    queryVector=query_vector,
                    topK=top_k,
                )
                hits = [r.data() for r in rows]
            except Exception:  # noqa: BLE001
                hits = []

    return hits[:top_k]


def aggregate_hits_by_regulation(hits: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Group vector hits by regulation key."""
    by_reg: dict[str, dict[str, Any]] = {}
    for hit in hits:
        raw_key = str(hit.get("reg_key") or "").strip()
        reg_key = normalize_reg_key(raw_key)
        if not reg_key:
            label_list = hit.get("labels") or []
            if "LegalEntity" in label_list:
                reg_key = normalize_reg_key(raw_key or "LegalEntity")
            if not reg_key:
                continue

        score = float(hit.get("score") or 0.0)
        preview = str(hit.get("text_preview") or "").strip()
        title = str(hit.get("title") or "").strip()
        entry = by_reg.setdefault(
            reg_key,
            {
                "reg_id": reg_key,
                "vector_hit_count": 0,
                "max_vector_score": 0.0,
                "vector_score_sum": 0.0,
                "top_text_previews": [],
                "top_titles": [],
            },
        )
        entry["vector_hit_count"] += 1
        entry["max_vector_score"] = max(entry["max_vector_score"], score)
        entry["vector_score_sum"] += score
        if preview and preview not in entry["top_text_previews"]:
            entry["top_text_previews"].append(preview)
        if title and title not in entry["top_titles"]:
            entry["top_titles"].append(title)

    for entry in by_reg.values():
        previews = entry["top_text_previews"][:6]
        entry["texts"] = previews
        entry["hit_count"] = entry["vector_hit_count"]
    return by_reg


def fetch_document_metadata(driver: Any, database: str) -> dict[str, dict[str, Any]]:
    """Load Document nodes for regulation metadata merge."""
    out: dict[str, dict[str, Any]] = {}
    try:
        with driver.session(database=database) as session:
            rows = [r.data() for r in session.run(DOCUMENT_ENRICH_QUERY)]
    except Exception:  # noqa: BLE001
        return out
    for row in rows:
        rk = str(row.get("reg_key") or "").strip().lower()
        if rk:
            out[rk] = row
    return out


def fetch_document_metadata_for_ids(
    driver: Any,
    database: str,
    ids: list[str],
) -> dict[str, dict[str, Any]]:
    """Load Document metadata for a bounded set of doc ids (fast scan path)."""
    keys = [str(i).strip() for i in ids if str(i).strip()]
    if not keys:
        return {}
    out: dict[str, dict[str, Any]] = {}
    try:
        with driver.session(database=database) as session:
            rows = [r.data() for r in session.run(DOCUMENT_ENRICH_BY_IDS_QUERY, ids=keys)]
    except Exception:  # noqa: BLE001
        return out
    for row in rows:
        rk = str(row.get("reg_key") or "").strip().lower()
        if rk:
            out[rk] = row
    return out


def fetch_legal_entity_metadata(driver: Any, database: str) -> dict[str, dict[str, Any]]:
    """Load LegalEntity nodes for regulation metadata merge."""
    out: dict[str, dict[str, Any]] = {}
    try:
        with driver.session(database=database) as session:
            rows = [r.data() for r in session.run(LEGAL_ENTITY_ENRICH_QUERY)]
    except Exception:  # noqa: BLE001
        return out
    for row in rows:
        rk = normalize_reg_key(str(row.get("reg_key") or ""))
        if rk:
            out[rk] = row
    return out


def merge_vector_hits_into_regulations(
    regulations: list[dict[str, Any]],
    vector_by_reg: dict[str, dict[str, Any]],
    legal_entities: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Merge vector search aggregates into regulation rows."""
    by_id = {str(r.get("reg_id") or ""): dict(r) for r in regulations}
    legal_entities = legal_entities or {}

    for reg_key, vec in vector_by_reg.items():
        entry = by_id.setdefault(
            reg_key,
            {
                "reg_id": reg_key,
                "name": "",
                "short_name": "",
                "official_number": "",
                "description": "",
                "texts": [],
                "hit_count": 0,
            },
        )
        le = legal_entities.get(reg_key) or legal_entities.get(reg_key.lower()) or {}
        if le.get("name"):
            entry["name"] = str(le["name"])
        if le.get("short_name"):
            entry["short_name"] = str(le["short_name"])
        if le.get("official_number"):
            entry["official_number"] = str(le["official_number"])

        if not entry.get("name"):
            top_titles = vec.get("top_titles") or []
            if top_titles:
                entry["name"] = str(top_titles[0])

        entry["vector_hit_count"] = int(vec.get("vector_hit_count") or 0)
        entry["max_vector_score"] = float(vec.get("max_vector_score") or 0.0)
        entry["hit_count"] = max(int(entry.get("hit_count") or 0), entry["vector_hit_count"])
        for t in vec.get("texts") or []:
            texts = entry.setdefault("texts", [])
            if t and t not in texts:
                texts.append(t)

    for reg_key, vec in vector_by_reg.items():
        if reg_key not in by_id and reg_key in vector_by_reg:
            continue

    # Include vector-only regulations not in original list
    for reg_key, vec in vector_by_reg.items():
        if reg_key not in by_id:
            by_id[reg_key] = {
                "reg_id": reg_key,
                "name": (legal_entities.get(reg_key) or {}).get("name", ""),
                "short_name": (legal_entities.get(reg_key) or {}).get("short_name", ""),
                "official_number": (legal_entities.get(reg_key) or {}).get("official_number", ""),
                "description": "",
                "texts": list(vec.get("texts") or []),
                "hit_count": int(vec.get("vector_hit_count") or 0),
                "vector_hit_count": int(vec.get("vector_hit_count") or 0),
                "max_vector_score": float(vec.get("max_vector_score") or 0.0),
            }

    return list(by_id.values())
