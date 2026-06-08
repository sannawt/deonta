"""End-to-end prototype assess for SmartRoof product flow."""

import pytest

from logic.prototype_fast import catalog_scan_response
from logic.prototype_smartroof_scope import apply_smartroof_demo_scope, is_smartroof_demo

ANTENNA_TEXT = (
    "We manufacture a smart rooftop internet antenna kit for wireless broadband. "
    "The product includes an outdoor antenna and a cloud dashboard."
)


@pytest.fixture(autouse=True)
def prototype_mode(monkeypatch):
    monkeypatch.setenv("PROTOTYPE_MODE", "1")


def test_smartroof_scan_returns_fifteen_laws():
    assert is_smartroof_demo(ANTENNA_TEXT)
    scan = catalog_scan_response(
        ANTENNA_TEXT,
        limit=15,
        min_score=0.75,
        include_secondary=True,
    )
    assert scan is not None
    assert scan["backend"] == "prototype_catalog"
    codes = [r["code"] for r in scan["results"]]
    assert len(codes) == 15
    assert "red_cyber" in codes
    assert "red" in codes


def test_smartroof_assess_returns_demo_fixture_scope():
    result = apply_smartroof_demo_scope({"scope_analysis": {"instruments": []}}, ANTENNA_TEXT)
    inst = result["scope_analysis"]["instruments"]
    assert len(inst) == 15
    assert all(i.get("assessment_source") == "demo_fixture" for i in inst)
    red = next(i for i in inst if i["reg_key"] == "red")
    assert red["verdict_display"] == "Indicates in scope"
    ai = next(i for i in inst if i["reg_key"] == "ai_act")
    assert ai["verdict_display"] == "Scope assessment required"
