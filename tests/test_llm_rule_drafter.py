"""Tests for logic/llm_rule_drafter.py."""

import json
from unittest.mock import MagicMock, patch

from logic.llm_rule_drafter import draft_scope_rules, drafting_enabled


@patch.dict("os.environ", {"ALLOW_RULE_DRAFT": "0", "OPENAI_API_KEY": "sk-test"}, clear=False)
def test_drafting_disabled_by_default():
    assert drafting_enabled() is False
    result = draft_scope_rules("gpsr")
    assert result["ok"] is False


@patch.dict(
    "os.environ",
    {"ALLOW_RULE_DRAFT": "1", "OPENAI_API_KEY": "sk-test", "LLM_PROVIDER": "openai"},
    clear=False,
)
@patch("logic.llm_rule_drafter._call_openai_draft")
def test_draft_scope_rules_writes_files(mock_draft, tmp_path, monkeypatch):
    import logic.llm_rule_drafter as mod

    monkeypatch.setattr(mod, "DRAFTS_DIR", tmp_path)

    mock_draft.return_value = {
        "datalog": ".decl material_scope_ok(c:symbol, r:symbol)\n.output material_scope_ok\n",
        "provisions_cited": ["GPSR_A5"],
        "warnings": ["Review territorial gate"],
        "summary": "Draft GPSR material scope",
    }

    result = draft_scope_rules("gpsr", write_files=True)
    assert result["ok"] is True
    assert (tmp_path / "gpsr_scope.dl").is_file()
    assert (tmp_path / "gpsr_scope.meta.json").is_file()
    text = (tmp_path / "gpsr_scope.dl").read_text(encoding="utf-8")
    assert "DRAFT" in text
    assert ".decl" in text


@patch.dict(
    "os.environ",
    {"ALLOW_RULE_DRAFT": "1", "OPENAI_API_KEY": "sk-test", "LLM_PROVIDER": "openai"},
    clear=False,
)
@patch("urllib.request.urlopen")
def test_call_openai_draft_parses(mock_urlopen):
    from logic.llm_rule_drafter import _call_openai_draft

    body = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {
                            "datalog": ".decl foo(x:symbol)\n",
                            "provisions_cited": ["RED_A3"],
                            "warnings": [],
                            "summary": "RED draft",
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

    parsed = _call_openai_draft({"law": {"code": "red"}})
    assert parsed is not None
    assert ".decl" in parsed["datalog"]
