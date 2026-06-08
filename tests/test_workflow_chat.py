"""Tests for logic/workflow_chat.py."""

from logic.workflow_chat import generate_workflow_reply


def test_workflow_welcome_fallback_without_openai(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    out = generate_workflow_reply(stage="welcome")
    assert out["fallback"] is True
    assert out["llm_used"] is False
    assert "Describe your product" in out["assistant_text"]


def test_law_scan_intro_fallback_lists_count(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    out = generate_workflow_reply(
        stage="law_scan_intro",
        context={
            "product_summary": "Smart antenna for EU ISPs",
            "law_scan_results": [{"ui_label": "GDPR", "score": 0.9, "legal_instrument": "Reg 2016/679"}],
            "selected_laws": ["gdpr"],
        },
    )
    assert out["fallback"] is True
    assert "regulations" in out["assistant_text"].lower()


def test_law_scan_empty_fallback(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    out = generate_workflow_reply(
        stage="law_scan_intro",
        context={"law_scan_results": [], "product_summary": "Widget"},
    )
    assert "threshold" in out["assistant_text"].lower() or "detail" in out["assistant_text"].lower()
