"""Tests for logic/facts_summarizer.py."""

import json
from unittest.mock import MagicMock, patch

from logic.facts_summarizer import (
    _normalize_summary,
    summarize_facts_for_display,
)


def test_normalize_summary_caps_and_shapes():
    raw = {
        "scenario_gist": "x" * 400,
        "from_question": [{"label": "Processing", "detail": "HR data in EU"}],
        "from_playbook": [{"label": "Product", "detail": "Cloud HR", "relevance": "used"}],
        "note": "ok",
    }
    out = _normalize_summary(raw)
    assert len(out["scenario_gist"]) <= 320
    assert len(out["from_question"]) == 1
    assert out["from_playbook"][0]["relevance"] == "used"
    assert out["source"] == "llm"


@patch.dict("os.environ", {"OPENAI_API_KEY": "", "LLM_FACTS_SUMMARY": "1"}, clear=False)
def test_summarize_returns_none_without_api_key():
    assert (
        summarize_facts_for_display(
            question="GDPR?",
            from_question=[{"field": "Controller", "value": "EU"}],
            from_playbook=[],
        )
        is None
    )


@patch.dict(
    "os.environ",
    {"OPENAI_API_KEY": "sk-test", "LLM_FACTS_SUMMARY": "1", "LLM_PROVIDER": "openai"},
    clear=False,
)
@patch("urllib.request.urlopen")
def test_summarize_parses_llm_json(mock_urlopen):
    body = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {
                            "scenario_gist": "HR platform in Finland.",
                            "from_question": [{"label": "Personal data", "detail": "Employees"}],
                            "from_playbook": [],
                            "note": "",
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

    out = summarize_facts_for_display(
        question="Does GDPR apply?",
        from_question=[{"field": "Personal Data", "value": "employees"}],
        from_playbook=[{"field": "Product", "value": "Atlas HR", "relevance": "used"}],
        playbook_company_label="Atlas Copco",
    )
    assert out is not None
    assert "Finland" in out["scenario_gist"]
    assert out["from_question"][0]["label"] == "Personal data"


@patch.dict("os.environ", {"LLM_FACTS_SUMMARY": "0", "OPENAI_API_KEY": "sk-test"}, clear=False)
def test_summarize_disabled_by_env():
    assert (
        summarize_facts_for_display(
            question="q",
            from_question=[{"field": "a", "value": "b"}],
            from_playbook=[],
        )
        is None
    )
