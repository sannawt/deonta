"""Tests for logic/llm_scope_assess.py."""

import json
from unittest.mock import MagicMock, patch

from logic.llm_scope_assess import (
    _build_instrument_from_llm,
    assess_retrieval_laws,
    assess_single_law,
    catalog_to_instrument_id,
    pending_instrument,
)


def test_catalog_to_instrument_id():
    assert catalog_to_instrument_id("gdpr") == "GDPR"
    assert catalog_to_instrument_id("ai_act") == "EU_AI_ACT"
    assert catalog_to_instrument_id("gpsr") == "GPSR"


def test_pending_instrument_shape():
    inst = pending_instrument({"code": "gpsr", "label": "GPSR"})
    assert inst["assessment_source"] == "pending"
    assert inst["reg_key"] == "gpsr"
    assert inst["verdict_display"] == "Scope assessment pending"


def test_build_instrument_from_llm_gpsr_specific_tests():
    parsed = {
        "verdict": "cannot_determine",
        "confidence": "medium",
        "headline": "GPSR may apply if placed on EU market.",
        "summary": "Product safety rules could cover this kit.",
        "dimensions": [
            {
                "id": "material",
                "result": "pass",
                "evidence": "Consumer product characteristics.",
                "decisive_facts": ["Industrial antenna kit for buildings"],
            },
            {
                "id": "territorial",
                "result": "cannot_determine",
                "evidence": "EU placement unclear.",
                "decisive_facts": [],
            },
        ],
        "legal_tests": [
            {"label": "Consumer product placed on EU market?", "answer": "unknown"},
            {"label": "AI system under EU AI Act?", "answer": "no"},
        ],
        "facts_used": ["Rooftop antenna hardware kit"],
        "missing_facts": ["Is the product placed on the EU market?"],
    }
    inst = _build_instrument_from_llm({"code": "gpsr", "label": "GPSR"}, parsed)
    assert inst["reg_key"] == "gpsr"
    assert inst["assessment_source"] == "llm_assisted"
    assert inst["legal_tests"][0]["label"].startswith("Consumer product")
    assert "AI system" not in inst["legal_tests"][0]["label"]


@patch.dict("os.environ", {"OPENAI_API_KEY": "", "LLM_SCOPE_ASSESS": "1"}, clear=False)
def test_assess_single_law_returns_pending_without_key():
    inst = assess_single_law(
        {"code": "red", "label": "RED"},
        spec={"name": "Antenna", "summary": "Radio kit"},
        kg_facts=[],
        legal_matches=[],
    )
    assert inst["assessment_source"] == "pending"


@patch.dict(
    "os.environ",
    {
        "OPENAI_API_KEY": "sk-test",
        "LLM_SCOPE_ASSESS": "1",
        "LLM_SCOPE_BATCH": "1",
        "LLM_PROVIDER": "openai",
        "LLM_SCOPE_CACHE_TTL": "0",
    },
    clear=False,
)
@patch("logic.llm_scope_assess._call_openai_scope_batch")
def test_assess_retrieval_laws_batch(mock_batch):
    mock_batch.return_value = {
        "cra": {
            "verdict": "applies",
            "confidence": "high",
            "headline": "CRA applies to connected product.",
            "dimensions": [{"id": "material", "result": "pass", "evidence": "Connected device."}],
            "legal_tests": [{"label": "Network-connected hardware?", "answer": "yes"}],
            "facts_used": ["IoT antenna"],
            "missing_facts": [],
        },
        "red": {
            "verdict": "cannot_determine",
            "confidence": "medium",
            "headline": "RED scope depends on radio use.",
            "dimensions": [{"id": "material", "result": "cannot_determine", "evidence": "Radio unclear."}],
            "legal_tests": [{"label": "Radio equipment?", "answer": "unknown"}],
            "facts_used": ["Antenna kit"],
            "missing_facts": ["Does the kit transmit radio signals?"],
        },
    }
    laws = [
        {"code": "cra", "label": "CRA", "engine_mode": "retrieval_only"},
        {"code": "red", "label": "RED", "engine_mode": "retrieval_only"},
        {"code": "gdpr", "label": "GDPR", "engine_mode": "symbolic"},
    ]
    out = assess_retrieval_laws(
        laws,
        spec={"name": "Kit", "summary": "Smart antenna"},
        kg_facts=[],
        legal_matches=[],
        symbolic_codes={"gdpr", "ai_act"},
    )
    assert len(out) == 2
    codes = {i["reg_key"] for i in out}
    assert codes == {"cra", "red"}
    assert all(i["assessment_source"] == "llm_assisted" for i in out)
    mock_batch.assert_called_once()


@patch.dict(
    "os.environ",
    {
        "OPENAI_API_KEY": "sk-test",
        "LLM_SCOPE_ASSESS": "1",
        "LLM_SCOPE_BATCH": "0",
        "LLM_PROVIDER": "openai",
        "LLM_SCOPE_CACHE_TTL": "0",
    },
    clear=False,
)
@patch("logic.llm_scope_assess._call_openai_scope")
def test_assess_retrieval_laws_parallel_fallback(mock_openai):
    mock_openai.return_value = {
        "verdict": "applies",
        "confidence": "high",
        "headline": "CRA applies to connected product.",
        "dimensions": [{"id": "material", "result": "pass", "evidence": "Connected device."}],
        "legal_tests": [{"label": "Network-connected hardware?", "answer": "yes"}],
        "facts_used": ["IoT antenna"],
        "missing_facts": [],
    }
    laws = [
        {"code": "cra", "label": "CRA", "engine_mode": "retrieval_only"},
        {"code": "red", "label": "RED", "engine_mode": "retrieval_only"},
        {"code": "gdpr", "label": "GDPR", "engine_mode": "symbolic"},
    ]
    out = assess_retrieval_laws(
        laws,
        spec={"name": "Kit", "summary": "Smart antenna"},
        kg_facts=[],
        legal_matches=[],
        symbolic_codes={"gdpr", "ai_act"},
    )
    assert len(out) == 2
    assert mock_openai.call_count == 2


@patch.dict(
    "os.environ",
    {"OPENAI_API_KEY": "sk-test", "LLM_SCOPE_ASSESS": "1", "LLM_PROVIDER": "openai"},
    clear=False,
)
@patch("urllib.request.urlopen")
def test_call_openai_scope_parses_response(mock_urlopen):
    from logic.llm_scope_assess import _call_openai_scope

    body = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {
                            "verdict": "cannot_determine",
                            "confidence": "low",
                            "headline": "REACH scope open",
                            "dimensions": [],
                            "legal_tests": [],
                            "facts_used": [],
                            "missing_facts": ["Substance composition unknown"],
                        }
                    )
                }
            }
        ]
    }
    resp = MagicMock()
    resp.read.return_value = json.dumps(body).encode("utf-8")
    resp.__enter__ = lambda s: s
    resp.__exit__ = MagicMock(return_value=False)
    mock_urlopen.return_value = resp

    parsed = _call_openai_scope({"law": {"code": "reach"}})
    assert parsed is not None
    assert parsed["verdict"] == "cannot_determine"
