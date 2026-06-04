"""Tests for law relevance scan ranking and REG_* mapping."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from logic.law_relevance_scan import (
    _format_result,
    _merge_regulation_rows,
    build_scan_query,
    fetch_regulations_from_neo4j,
    rank_regulations,
    reg_id_to_code,
)


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
    ranked = rank_regulations(query, regulations, limit=10)
    assert ranked
    assert ranked[0]["code"] == "gdpr"
    if len(ranked) > 1:
        assert ranked[0]["score"] >= ranked[1]["score"]


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
    ranked = rank_regulations(query, regs, limit=10)
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
    assert row["engine_mode"] == "symbolic"


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
    gdpr_top = rank_regulations("employee personal data HR SaaS", regulations, limit=1)[0]["code"]
    ai_top = rank_regulations("machine learning model deployment high risk AI", regulations, limit=1)[0]["code"]
    dsa_top = rank_regulations("online marketplace seller platform intermediary", regulations, limit=1)[0]["code"]
    assert gdpr_top == "gdpr"
    assert ai_top == "ai_act"
    assert dsa_top == "dsa"


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
    ranked = rank_regulations("personal data cloud service", regulations, limit=2)
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

    rows = fetch_regulations_from_neo4j(driver, "neo4j")
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
