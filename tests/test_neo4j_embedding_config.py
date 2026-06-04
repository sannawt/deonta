"""Tests for Neo4j embedding profile resolution."""

from __future__ import annotations

from logic.neo4j_embedding_config import (
    EmbeddingProfile,
    profile_from_discovery,
    resolve_query_model,
)
from logic.neo4j_vector_search import aggregate_hits_by_regulation, normalize_reg_key


def test_resolve_query_model_openai_1536():
    provider, model = resolve_query_model(1536, ())
    assert provider == "openai"
    assert model == "text-embedding-3-small"


def test_resolve_query_model_respects_hint():
    provider, model = resolve_query_model(3072, ("text-embedding-3-large",))
    assert provider == "openai"
    assert model == "text-embedding-3-large"


def test_resolve_query_model_unknown_dimension():
    provider, model = resolve_query_model(999, ())
    assert provider == ""
    assert model == ""


def test_profile_from_discovery_picks_active_property():
    raw = {
        "has_embeddings": True,
        "search_labels": ["Article", "Recital"],
        "all_dimensions": [1536],
        "dimension_mismatches": [],
        "vector_indexes": [
            {
                "name": "article_vector",
                "labels": ["Article"],
                "properties": ["embedding"],
                "dimensions": 1536,
                "similarity": "cosine",
            }
        ],
        "by_label": [
            {
                "label": "Article",
                "has_embedding": 100,
                "has_text_embeddings": 0,
                "active_property": "embedding",
                "primary_dimension": 1536,
                "model_hints": [],
            },
            {
                "label": "Recital",
                "has_embedding": 50,
                "has_text_embeddings": 0,
                "active_property": "embedding",
                "primary_dimension": 1536,
                "model_hints": [],
            },
        ],
    }
    profile = profile_from_discovery(raw)
    assert profile.usable()
    assert profile.vector_property == "embedding"
    assert profile.dimensions == 1536
    assert profile.vector_index_name == "article_vector"
    assert profile.query_provider == "openai"


def test_aggregate_hits_by_regulation():
    hits = [
        {"reg_key": "REG_GDPR", "score": 0.9, "text_preview": "Personal data rules.", "title": "Art 6"},
        {"reg_key": "REG_GDPR", "score": 0.8, "text_preview": "Controller obligations.", "title": "Art 24"},
        {"reg_key": "REG_AIACT", "score": 0.7, "text_preview": "AI system provider duties.", "title": "Art 16"},
    ]
    by_reg = aggregate_hits_by_regulation(hits)
    assert by_reg["REG_GDPR"]["vector_hit_count"] == 2
    assert by_reg["REG_GDPR"]["max_vector_score"] == 0.9
    assert len(by_reg["REG_GDPR"]["texts"]) == 2
    assert normalize_reg_key("gdpr") == "REG_GDPR"


def test_embedding_profile_usable_false_when_empty():
    profile = EmbeddingProfile(has_embeddings=False)
    assert not profile.usable()
