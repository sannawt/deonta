"""Tests for SmartRoof demo scope fixtures."""

from logic.prototype_smartroof_scope import (
    demo_instruments_for_description,
    is_smartroof_demo,
    smartroof_demo_instruments,
)

ANTENNA_TEXT = (
    "We manufacture a smart rooftop internet antenna kit for wireless broadband. "
    "The product includes an outdoor antenna and a cloud dashboard."
)


def test_is_smartroof_demo():
    assert is_smartroof_demo(ANTENNA_TEXT) is True
    assert is_smartroof_demo("unrelated product") is False


def test_smartroof_has_fifteen_instruments():
    inst = smartroof_demo_instruments()
    assert len(inst) == 15
    keys = {i["reg_key"] for i in inst}
    assert "red" in keys
    assert "red_cyber" in keys
    assert "gdpr" in keys
    assert "ai_act" in keys


def test_red_indicates_in_scope_with_dimensions():
    inst = demo_instruments_for_description(ANTENNA_TEXT)
    assert inst is not None
    red = next(i for i in inst if i["reg_key"] == "red")
    assert red["verdict"] == "applies"
    assert red["verdict_display"] == "Indicates in scope"
    assert len(red["dimensions"]) == 4
    temporal = next(d for d in red["dimensions"] if d["id"] == "temporal")
    assert temporal["result"] == "PASS"
    assert "RED Art. 1" in temporal["evidence"]


def test_ai_act_scope_assessment_required():
    inst = demo_instruments_for_description(ANTENNA_TEXT)
    assert inst is not None
    ai = next(i for i in inst if i["reg_key"] == "ai_act")
    assert ai["verdict"] == "cannot_determine"
    assert ai["verdict_display"] == "Scope assessment required"


def test_all_demo_instruments_use_fixture_source():
    inst = smartroof_demo_instruments()
    assert all(i["assessment_source"] == "demo_fixture" for i in inst)
