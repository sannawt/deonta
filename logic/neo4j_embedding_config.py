"""Cached embedding profile derived from Neo4j legal graph discovery."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Callable

from logic.neo4j_embedding_discovery import discover_embedding_profile

# OpenAI embedding model -> dimensions (for query vector matching)
OPENAI_MODEL_DIMENSIONS: dict[str, int] = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "text-embedding-ada-002": 1536,
}

DIMENSION_TO_OPENAI_MODEL: dict[int, str] = {}
for _model, _dim in OPENAI_MODEL_DIMENSIONS.items():
    if _dim not in DIMENSION_TO_OPENAI_MODEL:
        DIMENSION_TO_OPENAI_MODEL[_dim] = _model


@dataclass(frozen=True)
class EmbeddingProfile:
    """Resolved config for vector search — no raw vectors."""

    has_embeddings: bool
    search_labels: tuple[str, ...] = ()
    vector_property: str = ""
    dimensions: int = 0
    vector_index_name: str = ""
    vector_index_labels: tuple[str, ...] = ()
    query_provider: str = ""
    query_model: str = ""
    model_hints: tuple[str, ...] = ()
    regulation_property_keys: tuple[str, ...] = (
        "regulation_id",
        "regulationId",
        "legal_entity_id",
        "legalEntityId",
        "celex",
        "code",
        "id",
        "document_id",
        "documentId",
    )
    dimension_mismatches: tuple[str, ...] = ()
    embedded_node_count: int = 0
    discovery_summary: dict[str, Any] = field(default_factory=dict)

    def usable(self) -> bool:
        return self.has_embeddings and self.dimensions > 0 and bool(self.vector_property)


def resolve_query_model(dimensions: int, model_hints: tuple[str, ...] = ()) -> tuple[str, str]:
    """
    Return (provider, model) for query embedding.
    provider is 'openai' when matched; empty when unknown.
    """
    override = (os.environ.get("NEO4J_QUERY_EMBEDDING_MODEL") or "").strip()
    if override:
        dim = OPENAI_MODEL_DIMENSIONS.get(override)
        if dim == dimensions:
            return "openai", override

    for hint in model_hints:
        h = hint.strip()
        if h in OPENAI_MODEL_DIMENSIONS and OPENAI_MODEL_DIMENSIONS[h] == dimensions:
            return "openai", h

    default_model = (os.environ.get("OPENAI_EMBEDDING_MODEL") or "text-embedding-3-small").strip()
    if OPENAI_MODEL_DIMENSIONS.get(default_model) == dimensions:
        return "openai", default_model

    matched = DIMENSION_TO_OPENAI_MODEL.get(dimensions)
    if matched:
        return "openai", matched
    # text-embedding-3-* supports Matryoshka dimensions (e.g. 768) via API `dimensions` param
    if dimensions in (256, 512, 768, 1024, 1536, 3072):
        override = (os.environ.get("NEO4J_QUERY_EMBEDDING_MODEL") or "").strip()
        if override and override in OPENAI_MODEL_DIMENSIONS:
            return "openai", override
        return "openai", "text-embedding-3-small"

    return "", ""


def _pick_vector_index(
    indexes: list[dict[str, Any]],
    *,
    search_labels: tuple[str, ...],
    vector_property: str,
    dimensions: int,
) -> tuple[str, tuple[str, ...]]:
    override = (os.environ.get("NEO4J_VECTOR_INDEX_NAME") or "").strip()
    if override:
        for idx in indexes:
            if str(idx.get("name") or "") == override:
                labels = idx.get("labels") or idx.get("labelsOrTypes") or []
                if isinstance(labels, str):
                    labels = [labels]
                return override, tuple(str(l) for l in labels)

    best_name = ""
    best_labels: tuple[str, ...] = ()
    for idx in indexes:
        name = str(idx.get("name") or "")
        if not name:
            continue
        idx_dims = idx.get("dimensions")
        props = idx.get("properties") or []
        if isinstance(props, str):
            props = [props]
        idx_labels = idx.get("labels") or idx.get("labelsOrTypes") or []
        if isinstance(idx_labels, str):
            idx_labels = [idx_labels]
        if idx_dims is not None and int(idx_dims) != dimensions:
            continue
        if vector_property and props and vector_property not in props:
            continue
        if search_labels and idx_labels and not any(l in search_labels for l in idx_labels):
            continue
        best_name = name
        best_labels = tuple(str(l) for l in idx_labels)
        break

    return best_name, best_labels


def profile_from_discovery(raw: dict[str, Any]) -> EmbeddingProfile:
    by_label = raw.get("by_label") or []
    search_labels_list = list(raw.get("search_labels") or [])
    all_dims = list(raw.get("all_dimensions") or [])

    primary_dim = all_dims[0] if len(all_dims) == 1 else (all_dims[0] if all_dims else 0)
    vector_property = ""
    embedded_count = 0
    model_hints: list[str] = []

    label_props: dict[str, str] = {}
    for lb in by_label:
        label = str(lb.get("label") or "")
        prop = str(lb.get("active_property") or "")
        if prop:
            label_props[label] = prop
        embedded_count += int(lb.get("has_embedding") or 0) + int(lb.get("has_text_embeddings") or 0)
        model_hints.extend(str(h) for h in (lb.get("model_hints") or []) if h)

    if search_labels_list:
        props_used = {label_props.get(l, "") for l in search_labels_list if label_props.get(l)}
        if len(props_used) == 1:
            vector_property = props_used.pop()
        elif props_used:
            vector_property = max(props_used, key=lambda p: sum(1 for l in search_labels_list if label_props.get(l) == p))

    for lb in by_label:
        if lb.get("primary_dimension") == primary_dim and lb.get("active_property"):
            if not vector_property:
                vector_property = str(lb["active_property"])

    indexes = raw.get("vector_indexes") or []
    index_name, index_labels = _pick_vector_index(
        indexes,
        search_labels=tuple(search_labels_list),
        vector_property=vector_property,
        dimensions=primary_dim,
    )

    provider, model = resolve_query_model(primary_dim, tuple(model_hints)) if primary_dim else ("", "")

    return EmbeddingProfile(
        has_embeddings=bool(raw.get("has_embeddings")),
        search_labels=tuple(search_labels_list),
        vector_property=vector_property,
        dimensions=int(primary_dim or 0),
        vector_index_name=index_name,
        vector_index_labels=index_labels,
        query_provider=provider,
        query_model=model,
        model_hints=tuple(dict.fromkeys(model_hints)),
        dimension_mismatches=tuple(raw.get("dimension_mismatches") or []),
        embedded_node_count=embedded_count,
        discovery_summary={
            "all_dimensions": all_dims,
            "vector_indexes": indexes,
            "labels_with_embeddings": search_labels_list,
        },
    )


def make_session_runner(driver: Any, database: str) -> Callable[[str, dict[str, Any]], list[dict[str, Any]]]:
    def session_runner(cypher: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        with driver.session(database=database) as session:
            return [r.data() for r in session.run(cypher, **params)]

    return session_runner


_profile_cache: dict[str, EmbeddingProfile] = {}


def load_embedding_profile(driver: Any, database: str, *, force_refresh: bool = False) -> EmbeddingProfile:
    """Load and cache embedding profile for a Neo4j database."""
    if force_refresh:
        _profile_cache.pop(database, None)
    if database in _profile_cache:
        return _profile_cache[database]
    runner = make_session_runner(driver, database)
    raw = discover_embedding_profile(runner)
    profile = profile_from_discovery(raw)
    _profile_cache[database] = profile
    return profile


def clear_embedding_profile_cache() -> None:
    _profile_cache.clear()
