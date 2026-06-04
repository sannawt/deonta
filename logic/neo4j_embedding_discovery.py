"""Read-only discovery of embedding properties and vector indexes in Neo4j legal graph."""

from __future__ import annotations

from typing import Any, Callable

EMBEDDING_LABELS: tuple[str, ...] = (
    "Document",
    "Article",
    "Recital",
    "LegalEntity",
    "ExternalReference",
)

VECTOR_INDEXES_CYPHER = """
SHOW INDEXES YIELD name, type, labelsOrTypes, properties, options
WHERE type = 'VECTOR'
RETURN name, labelsOrTypes, properties, options
"""

LABEL_PRESENCE_CYPHER = """
UNWIND $labels AS label
MATCH (n)
WHERE label IN labels(n)
WITH label,
     count(n) AS total,
     count(n.embedding) AS has_embedding,
     count(n.text_embeddings) AS has_text_embeddings
RETURN label, total, has_embedding, has_text_embeddings
ORDER BY label
"""

# Dimension histogram for flat list vectors (embedding property)
EMBEDDING_DIM_CYPHER = """
MATCH (n)
WHERE $label IN labels(n) AND n.embedding IS NOT NULL
WITH size(n.embedding) AS dim
RETURN dim, count(*) AS count
ORDER BY count DESC
LIMIT 10
"""

TEXT_EMBEDDINGS_DIM_CYPHER = """
MATCH (n)
WHERE $label IN labels(n) AND n.text_embeddings IS NOT NULL AND size(n.text_embeddings) > 0
WITH n.text_embeddings AS te
WITH
  CASE
    WHEN size(te) > 0 AND te[0] IS NOT NULL AND size(te[0]) IS NOT NULL AND size(te[0]) > 1
    THEN size(te[0])
    ELSE size(te)
  END AS dim
WHERE dim > 0
RETURN dim, count(*) AS count
ORDER BY count DESC
LIMIT 10
"""

# Sample shape metadata without returning vector values
EMBEDDING_SHAPE_SAMPLE_CYPHER = """
MATCH (n)
WHERE $label IN labels(n) AND n.embedding IS NOT NULL
WITH n LIMIT 1
RETURN
  size(n.embedding) AS outer_size,
  'embedding' AS property,
  'list_float' AS inferred_shape
"""

TEXT_EMBEDDINGS_SHAPE_SAMPLE_CYPHER = """
MATCH (n)
WHERE $label IN labels(n) AND n.text_embeddings IS NOT NULL
WITH n LIMIT 1
RETURN
  size(n.text_embeddings) AS outer_size,
  CASE
    WHEN size(n.text_embeddings) > 0 AND n.text_embeddings[0] IS NOT NULL
    THEN size(n.text_embeddings[0])
    ELSE size(n.text_embeddings)
  END AS inner_size,
  'text_embeddings' AS property
"""

EMBEDDING_MODEL_HINT_CYPHER = """
MATCH (n)
WHERE $label IN labels(n)
  AND (n.embedding_model IS NOT NULL OR n.embeddingModel IS NOT NULL OR n.model IS NOT NULL)
RETURN coalesce(n.embedding_model, n.embeddingModel, n.model) AS model_hint
LIMIT 3
"""

REGULATION_PROPERTY_KEYS_CYPHER = """
MATCH (n)
WHERE $label IN labels(n)
  AND (n.embedding IS NOT NULL OR n.text_embeddings IS NOT NULL)
WITH n LIMIT 50
UNWIND keys(n) AS key
RETURN DISTINCT key
ORDER BY key
"""

REGULATION_LINKAGE_SAMPLE_CYPHER = """
MATCH (n)
WHERE $label IN labels(n)
  AND (n.embedding IS NOT NULL OR n.text_embeddings IS NOT NULL)
WITH n LIMIT 5
OPTIONAL MATCH (n)-[r]-(m)
WHERE m:LegalEntity OR m:Document OR m:Regulation
  OR 'LegalEntity' IN labels(m) OR 'Document' IN labels(m)
RETURN
  labels(n) AS from_labels,
  type(r) AS rel_type,
  labels(m) AS to_labels,
  coalesce(n.regulation_id, n.regulationId, n.legal_entity_id, n.legalEntityId, n.celex, '') AS direct_reg_key
LIMIT 20
"""

LEGAL_ENTITY_SAMPLE_CYPHER = """
MATCH (le:LegalEntity)
RETURN
  coalesce(le.id, le.regulation_id, le.regulationId, le.code, le.name, elementId(le)) AS reg_key,
  coalesce(le.name, le.title, '') AS name,
  coalesce(le.short_name, le.shortName, '') AS short_name
LIMIT 20
"""


def _run(session_runner: Callable[[str, dict[str, Any]], list[dict[str, Any]]], cypher: str, **params: Any) -> list[dict[str, Any]]:
    try:
        return session_runner(cypher, params)
    except Exception:  # noqa: BLE001
        return []


def discover_embedding_profile(
    session_runner: Callable[[str, dict[str, Any]], list[dict[str, Any]]],
    *,
    labels: tuple[str, ...] = EMBEDDING_LABELS,
) -> dict[str, Any]:
    """
    Inspect embedding structure. Never returns raw vector values.
    session_runner(cypher, params) -> list of row dicts.
    """
    presence = _run(session_runner, LABEL_PRESENCE_CYPHER, labels=list(labels))
    vector_indexes = _run(session_runner, VECTOR_INDEXES_CYPHER)

    by_label: list[dict[str, Any]] = []
    all_dims: set[int] = set()
    dim_mismatches: list[str] = []

    for row in presence:
        label = str(row.get("label") or "")
        total = int(row.get("total") or 0)
        has_emb = int(row.get("has_embedding") or 0)
        has_text_emb = int(row.get("has_text_embeddings") or 0)

        active_property = ""
        if has_emb >= has_text_emb and has_emb > 0:
            active_property = "embedding"
        elif has_text_emb > 0:
            active_property = "text_embeddings"

        dim_rows: list[dict[str, Any]] = []
        shape: dict[str, Any] = {}
        if active_property == "embedding":
            dim_rows = _run(session_runner, EMBEDDING_DIM_CYPHER, label=label)
            shape_rows = _run(session_runner, EMBEDDING_SHAPE_SAMPLE_CYPHER, label=label)
            if shape_rows:
                shape = dict(shape_rows[0])
        elif active_property == "text_embeddings":
            dim_rows = _run(session_runner, TEXT_EMBEDDINGS_DIM_CYPHER, label=label)
            shape_rows = _run(session_runner, TEXT_EMBEDDINGS_SHAPE_SAMPLE_CYPHER, label=label)
            if shape_rows:
                sr = shape_rows[0]
                outer = sr.get("outer_size")
                inner = sr.get("inner_size")
                shape = {
                    "property": "text_embeddings",
                    "outer_size": outer,
                    "inner_size": inner,
                    "inferred_shape": "list_list_float" if inner and outer and inner != outer else "list_float",
                }

        dims = [int(d["dim"]) for d in dim_rows if d.get("dim") is not None]
        primary_dim = dims[0] if dims else None
        if primary_dim is not None:
            all_dims.add(primary_dim)

        model_hints = [
            str(r.get("model_hint") or "")
            for r in _run(session_runner, EMBEDDING_MODEL_HINT_CYPHER, label=label)
            if r.get("model_hint")
        ]
        prop_keys = [
            str(r.get("key") or "")
            for r in _run(session_runner, REGULATION_PROPERTY_KEYS_CYPHER, label=label)
        ]
        linkage = _run(session_runner, REGULATION_LINKAGE_SAMPLE_CYPHER, label=label)

        by_label.append(
            {
                "label": label,
                "total_nodes": total,
                "has_embedding": has_emb,
                "has_text_embeddings": has_text_emb,
                "active_property": active_property,
                "dimension_histogram": dim_rows,
                "primary_dimension": primary_dim,
                "shape_sample": shape,
                "model_hints": model_hints,
                "property_keys": prop_keys,
                "linkage_samples": linkage,
            }
        )

    if len(all_dims) > 1:
        dim_mismatches.append(f"Multiple embedding dimensions across labels: {sorted(all_dims)}")

    search_labels = [
        lb["label"]
        for lb in by_label
        if lb.get("active_property") and lb.get("primary_dimension")
    ]

    parsed_indexes: list[dict[str, Any]] = []
    for idx in vector_indexes:
        opts = idx.get("options") or {}
        index_config = opts.get("indexConfig") if isinstance(opts, dict) else {}
        if not isinstance(index_config, dict):
            index_config = {}
        parsed_indexes.append(
            {
                "name": idx.get("name"),
                "labels": idx.get("labelsOrTypes"),
                "properties": idx.get("properties"),
                "dimensions": index_config.get("vector.dimensions"),
                "similarity": index_config.get("vector.similarity_function"),
            }
        )

    legal_entities = _run(session_runner, LEGAL_ENTITY_SAMPLE_CYPHER)

    return {
        "labels_inspected": list(labels),
        "by_label": by_label,
        "vector_indexes": parsed_indexes,
        "all_dimensions": sorted(all_dims),
        "dimension_mismatches": dim_mismatches,
        "search_labels": search_labels,
        "legal_entity_samples": legal_entities,
        "has_embeddings": bool(search_labels or parsed_indexes),
    }


def discover_regulation_linkage(
    session_runner: Callable[[str, dict[str, Any]], list[dict[str, Any]]],
) -> dict[str, Any]:
    """Summarize how embedded nodes connect to regulations."""
    linkage_rows: list[dict[str, Any]] = []
    for label in EMBEDDING_LABELS:
        linkage_rows.extend(_run(session_runner, REGULATION_LINKAGE_SAMPLE_CYPHER, label=label))

    rel_types = sorted({str(r.get("rel_type") or "") for r in linkage_rows if r.get("rel_type")})
    direct_keys = sorted(
        {str(r.get("direct_reg_key") or "") for r in linkage_rows if r.get("direct_reg_key")}
    )
    return {
        "relationship_types": rel_types,
        "direct_regulation_keys_sample": direct_keys[:30],
        "linkage_samples": linkage_rows[:25],
    }
