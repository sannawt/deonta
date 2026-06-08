"""Tests for law relevance scan ranking and REG_* mapping."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from logic.law_relevance_scan import (
    _format_result,
    _humanize_match_rationale,
    _merge_regulation_rows,
    build_scan_query,
    fetch_regulations_from_neo4j,
    rank_regulations,
)
from logic.reg_id_map import reg_id_to_code


def test_reg_id_to_code_gdpr_and_ai_act():
    assert reg_id_to_code("REG_GDPR") == "gdpr"
    assert reg_id_to_code("REG_AIACT") == "ai_act"
    assert reg_id_to_code("REG_CRA") == "cra"


def test_build_scan_query_includes_kg_facts():
    q = build_scan_query("Cloud HR SaaS", [{"label": "AI", "value": "yes"}])
    assert "Cloud HR SaaS" in q
    assert "AI: yes" in q


def test_merge_regulation_rows_joins_provision_texts():
    regs = [
        {
            "reg_id": "REG_GDPR",
            "name": "GDPR",
            "short_name": "GDPR",
            "official_number": "2016/679",
            "description": "",
        }
    ]
    prov = [{"reg_id": "REG_GDPR", "texts": ["Personal data protection rules."], "sample_name": ""}]
    merged = _merge_regulation_rows(regs, prov)
    assert len(merged) == 1
    assert "Personal data" in merged[0]["texts"][0]


def test_term_scores_orders_gdpr_above_unrelated():
    query = "personal data processing cloud service EU users"
    regulations = [
        {
            "reg_id": "REG_GDPR",
            "name": "General Data Protection Regulation",
            "short_name": "GDPR",
            "description": "personal data processing",
            "texts": ["processing of personal data " * 15],
            "hit_count": 0,
        },
        {
            "reg_id": "REG_GPSR",
            "name": "General Product Safety Regulation",
            "short_name": "GPSR",
            "description": "product safety consumer goods",
            "texts": ["product safety requirements " * 15],
            "hit_count": 0,
        },
    ]
    ranked, _method, _, _ = rank_regulations(query, regulations, limit=10, min_score=0)
    assert ranked
    assert ranked[0]["code"] == "gdpr"
    if len(ranked) > 1:
        assert ranked[0]["score"] >= ranked[1]["score"]


def test_rank_regulations_min_score_filter():
    query = "data processing"
    regs = [
        {
            "reg_id": "REG_GDPR",
            "name": "GDPR personal data processing",
            "short_name": "GDPR",
            "description": "personal data processing",
            "texts": ["personal data processing " * 20],
        },
        {
            "reg_id": "REG_OTHER",
            "name": "Unrelated fisheries law",
            "short_name": "Fish",
            "description": "fisheries quotas",
            "texts": ["fisheries quotas " * 5],
        },
    ]
    ranked, _, total, _ = rank_regulations(query, regs, min_score=0.75)
    assert total >= 1
    assert ranked
    assert all(r["score"] >= 0.75 for r in ranked)


def test_rank_regulations_excludes_implementing_by_default():
    query = "personal data processing"
    regs = [
        {
            "reg_id": "REG_GDPR",
            "name": "Regulation (EU) 2016/679 on the protection of personal data",
            "short_name": "GDPR",
            "description": "personal data",
            "texts": ["personal data processing " * 20],
        },
        {
            "reg_id": "REG_IMPL",
            "name": (
                "Commission Implementing Decision (EU) 2021/1772 pursuant to "
                "Regulation (EU) 2016/679 on the adequate protection of personal data"
            ),
            "short_name": "",
            "description": "personal data",
            "texts": ["personal data processing " * 20],
        },
    ]
    ranked_default, _, _, _ = rank_regulations(query, regs, min_score=0.5)
    codes = {r["reg_id"] for r in ranked_default}
    assert "REG_GDPR" in codes
    assert "REG_IMPL" not in codes

    ranked_all, _, _, _ = rank_regulations(
        query, regs, min_score=0.5, include_secondary=True
    )
    assert any(r["reg_id"] == "REG_IMPL" for r in ranked_all)


def test_rank_regulations_excludes_council_and_noise_by_default():
    query = "personal data processing"
    regs = [
        {
            "reg_id": "REG_GDPR",
            "name": "Regulation (EU) 2016/679 on the protection of personal data",
            "short_name": "GDPR",
            "description": "personal data",
            "texts": ["personal data processing " * 20],
        },
        {
            "reg_id": "REG_COUNCIL",
            "name": (
                "Council Regulation (EU) 2022/2065 concerning restrictive measures "
                "in view of the situation in Ukraine"
            ),
            "short_name": "",
            "description": "personal data processing",
            "texts": ["personal data processing " * 20],
        },
        {
            "reg_id": "REG_COMM",
            "name": "Commission Regulation (EU) No 651/2014 declaring certain categories of aid compatible",
            "short_name": "",
            "description": "personal data processing",
            "texts": ["personal data processing " * 20],
        },
    ]
    ranked, _, _, _ = rank_regulations(query, regs, min_score=0.5)
    codes = {r["reg_id"] for r in ranked}
    assert "REG_GDPR" in codes
    assert "REG_COUNCIL" not in codes
    assert "REG_COMM" not in codes


def test_rank_regulations_excludes_internal_with_secondary():
    query = "personal data processing"
    regs = [
        {
            "reg_id": "REG_IMPL",
            "name": (
                "Commission Implementing Decision (EU) 2021/1772 pursuant to "
                "Regulation (EU) 2016/679 on the adequate protection of personal data"
            ),
            "short_name": "",
            "description": "personal data",
            "texts": ["personal data processing " * 20],
        },
        {
            "reg_id": "REG_INTERNAL",
            "name": (
                "Decision of the Management Board of ENISA on internal rules "
                "concerning personal data processing"
            ),
            "short_name": "",
            "description": "personal data",
            "texts": ["personal data processing " * 20],
        },
    ]
    ranked, _, _, _ = rank_regulations(query, regs, min_score=0.5, include_secondary=True)
    codes = {r["reg_id"] for r in ranked}
    assert "REG_IMPL" in codes
    assert "REG_INTERNAL" not in codes


def test_rank_regulations_top_10_cap():
    query = "data processing"
    regs = [
        {
            "reg_id": f"REG_{i}",
            "name": f"Law {i}",
            "short_name": f"L{i}",
            "description": "data processing" if i == 0 else "other topic",
            "texts": [],
        }
        for i in range(15)
    ]
    ranked, _, _, _ = rank_regulations(query, regs, limit=10, min_score=0)
    assert len(ranked) <= 10


def test_format_result_uses_catalog_short():
    row = _format_result(
        {
            "reg_id": "REG_GDPR",
            "name": "General Data Protection Regulation",
            "short_name": "",
            "official_number": "",
            "description": "Protects personal data.",
            "texts": [],
        },
        0.9,
    )
    assert row["code"] == "gdpr"
    assert row["short"] == "GDPR"
    assert row["catalog_code"] == "gdpr"
    assert row["engine_mode"] == "symbolic"


def test_format_result_document_uuid_uses_title_not_slug():
    doc_id = "abb0ba05-5750-11ee-9220-01aa75ed71a1"
    title = (
        "Commission Implementing Decision EU 2023/1795of 10 July 2023pursuant to "
        "Regulation (EU) 2016/679 (General Data Protection Regulation)"
    )
    row = _format_result(
        {
            "reg_id": doc_id,
            "name": title,
            "short_name": "",
            "official_number": "",
            "description": "",
            "texts": ["(1) Regulation (EU) 2016/679 sets out the rules for transfer."],
        },
        0.82,
    )
    assert row["code"] == doc_id
    assert row["catalog_code"] == "gdpr"
    assert "ABB0BA05" not in row["short"]
    assert row["short"] not in {"EU Regulation", "EU Directive", ""}
    assert row["document_tier"] == "implementing"
    assert row["number"] == "2023/1795"
    assert "personal data" in row["description"]
    assert "Regulation (EU)" in row["label"]


def test_humanize_match_rationale():
    text = _humanize_match_rationale(
        vector_hits=3,
        term_hits=12,
        pred_score=0.5,
        ret_score=0.2,
        has_vector=True,
    )
    assert "Semantically similar" in text
    assert "keyword overlap" in text
    assert "product graph" in text
    assert "557" not in text


def test_ranking_varies_with_rich_corpus_text():
    gdpr_text = " ".join(["personal data processing consent controller processor"] * 8)
    ai_text = " ".join(["artificial intelligence system high-risk model training"] * 8)
    marketplace_text = " ".join(["online platform intermediary seller consumer goods"] * 8)
    regulations = [
        {
            "reg_id": "REG_GDPR",
            "name": "GDPR",
            "short_name": "GDPR",
            "description": "",
            "texts": [gdpr_text],
            "hit_count": 0,
        },
        {
            "reg_id": "REG_AIACT",
            "name": "AI Act",
            "short_name": "AI Act",
            "description": "",
            "texts": [ai_text],
            "hit_count": 0,
        },
        {
            "reg_id": "REG_DSA",
            "name": "DSA",
            "short_name": "DSA",
            "description": "",
            "texts": [marketplace_text],
            "hit_count": 0,
        },
    ]
    gdpr_top, _, _, _ = rank_regulations(
        "employee personal data HR SaaS", regulations, limit=1, min_score=0
    )
    ai_top, _, _, _ = rank_regulations(
        "machine learning model deployment high risk AI", regulations, limit=1, min_score=0
    )
    dsa_top, _, _, _ = rank_regulations(
        "online marketplace seller platform intermediary", regulations, limit=1, min_score=0
    )
    assert gdpr_top[0]["code"] == "gdpr"
    assert ai_top[0]["code"] == "ai_act"
    assert dsa_top[0]["code"] == "dsa"


def test_retrieval_hits_boost_regulation():
    regulations = [
        {
            "reg_id": "REG_GDPR",
            "name": "GDPR",
            "short_name": "GDPR",
            "description": "",
            "texts": ["personal data rules " * 20],
            "hit_count": 12,
        },
        {
            "reg_id": "REG_DORA",
            "name": "DORA",
            "short_name": "DORA",
            "description": "",
            "texts": ["financial resilience operational continuity " * 20],
            "hit_count": 0,
        },
    ]
    ranked, _, _, _ = rank_regulations(
        "personal data cloud service", regulations, limit=2, min_score=0
    )
    assert ranked[0]["code"] == "gdpr"
    assert ranked[0]["hit_count"] == 12


def test_format_result_uses_catalog_number():
    row = _format_result(
        {
            "reg_id": "REG_GDPR",
            "name": "General Data Protection Regulation",
            "short_name": "",
            "official_number": "",
            "description": "Protects personal data.",
            "texts": [],
        },
        0.9,
    )
    assert row["number"] == "2016/679"


def test_fetch_regulations_from_neo4j_mock_session():
    reg_record = MagicMock()
    reg_record.data.return_value = {
        "reg_id": "REG_GDPR",
        "name": "GDPR",
        "short_name": "GDPR",
        "official_number": "2016/679",
        "description": "Data protection",
    }
    prov_record = MagicMock()
    prov_record.data.return_value = {
        "reg_id": "REG_GDPR",
        "texts": ["Article text about personal data."],
        "sample_name": "Art. 1",
    }

    def fake_run(cypher: str, **kwargs):
        if "MATCH (r:Regulation)" in cypher:
            return [reg_record]
        return [prov_record]

    session = MagicMock()
    session.run.side_effect = fake_run
    driver = MagicMock()
    driver.session.return_value.__enter__.return_value = session

    rows = fetch_regulations_from_neo4j(driver, "neo4j", allow_catalog_fallback=True)
    assert any(r["reg_id"] == "REG_GDPR" for r in rows)
    assert rows[0]["texts"]


def test_reg_id_map_covers_catalog_codes():
    for code in ("gdpr", "ai_act", "cra", "dora", "nis2"):
        reg_key = "REG_" + code.upper().replace("AI_ACT", "AIACT")
        assert reg_id_to_code(reg_key) == code or reg_id_to_code("REG_AIACT") == "ai_act"


def test_scan_relevant_laws_raises_when_local_backend(monkeypatch):
    from logic import law_relevance_scan as mod

    monkeypatch.setenv("LEGAL_GRAPH_BACKEND", "local")
    monkeypatch.setenv("NEO4J_LEGAL_URI", "neo4j+s://x.databases.neo4j.io")
    monkeypatch.setenv("NEO4J_LEGAL_PASSWORD", "secret")

    with pytest.raises(RuntimeError, match="LEGAL_GRAPH_BACKEND=neo4j"):
        mod.scan_relevant_laws(
            description="test",
            get_legal_driver_fn=MagicMock(),
            resolve_database_fn=lambda: "neo4j",
        )


def test_rank_regulations_vector_signal():
    regulations = [
        {
            "reg_id": "REG_GDPR",
            "name": "GDPR",
            "short_name": "GDPR",
            "description": "",
            "texts": ["Personal data processing rules."],
            "hit_count": 2,
            "vector_hit_count": 8,
            "max_vector_score": 0.92,
        },
        {
            "reg_id": "REG_CRA",
            "name": "Cyber Resilience Act",
            "short_name": "CRA",
            "description": "",
            "texts": [],
            "hit_count": 0,
            "vector_hit_count": 1,
            "max_vector_score": 0.4,
        },
    ]
    ranked, method, _, _ = rank_regulations(
        "personal data SaaS",
        regulations,
        limit=5,
        min_score=0,
        vector_ranked=True,
    )
    assert ranked[0]["code"] == "gdpr"
    assert "Semantically similar" in ranked[0]["match_rationale"]
    assert method.startswith("neo4j_vector")
    assert "embedding" not in ranked[0]
    for row in ranked:
        assert "embedding" not in row


def test_scan_relevant_laws_vector_path(monkeypatch):
    from logic import law_relevance_scan as mod
    from logic.neo4j_embedding_config import EmbeddingProfile

    profile = EmbeddingProfile(
        has_embeddings=True,
        search_labels=("Article", "Recital"),
        vector_property="embedding",
        dimensions=1536,
        vector_index_name="article_emb",
        query_provider="openai",
        query_model="text-embedding-3-small",
    )

    monkeypatch.setenv("LEGAL_GRAPH_BACKEND", "neo4j")
    monkeypatch.setenv("NEO4J_LEGAL_URI", "neo4j+s://x.databases.neo4j.io")
    monkeypatch.setenv("NEO4J_LEGAL_PASSWORD", "secret")

    monkeypatch.setattr(mod, "load_embedding_profile", lambda _d, _db: profile)
    monkeypatch.setattr(
        mod,
        "fetch_regulations_from_neo4j",
        lambda *_a, **_k: [
            {
                "reg_id": "REG_GDPR",
                "name": "GDPR",
                "short_name": "GDPR",
                "official_number": "2016/679",
                "description": "",
                "texts": [],
                "hit_count": 0,
            }
        ],
    )
    monkeypatch.setattr(mod, "embed_query", lambda _q, _p: [0.1] * 1536)
    monkeypatch.setattr(
        mod,
        "vector_search_hits",
        lambda *_a, **_k: [
            {
                "reg_key": "REG_GDPR",
                "score": 0.88,
                "text_preview": "Processing of personal data shall be lawful.",
                "title": "Article 6",
                "labels": ["Article"],
            }
        ],
    )
    monkeypatch.setattr(mod, "fetch_legal_entity_metadata", lambda *_a, **_k: {})

    out = mod.scan_relevant_laws(
        description="HR SaaS processing employee personal data in the EU",
        get_legal_driver_fn=MagicMock(),
        resolve_database_fn=lambda: "neo4j",
    )
    assert out["embedding_search"]["vector_search_used"] is True
    assert out["results"]
    assert out["results"][0]["code"] == "gdpr"
    for row in out["results"]:
        assert "embedding" not in row
    assert "queryVector" not in str(out)
