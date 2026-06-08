"""Tests for logic/prototype_fast.py."""

import os

import pytest

from logic.prototype_fast import (
    assess_cache_key,
    catalog_scan_response,
    heuristic_retrieval_instruments,
    is_prototype_mode,
    put_cached_scan,
    scan_cache_key,
)


ANTENNA_TEXT = (
    "We manufacture a smart rooftop internet antenna kit for wireless broadband. "
    "The product includes an outdoor antenna and a cloud dashboard."
)


@pytest.fixture(autouse=True)
def prototype_on(monkeypatch):
    monkeypatch.setenv("PROTOTYPE_MODE", "1")


def test_is_prototype_mode():
    assert is_prototype_mode() is True


def test_catalog_scan_antenna_returns_many_laws():
    out = catalog_scan_response(ANTENNA_TEXT, limit=15, min_score=0.75)
    assert out is not None
    assert out["backend"] == "prototype_catalog"
    codes = {r["code"] for r in out["results"]}
    assert "red" in codes
    assert len(out["results"]) >= 6


def test_heuristic_instruments_have_dimensions():
    laws = [
        {"code": "gpsr", "label": "GPSR", "engine_mode": "retrieval_only"},
        {"code": "red", "label": "RED", "engine_mode": "retrieval_only"},
    ]
    spec = {
        "name": "Antenna kit",
        "summary": ANTENNA_TEXT,
        "markets": ["EU"],
        "processesPersonalData": "unknown",
        "euLink": "unknown",
        "aiSystem": "no",
    }
    out = heuristic_retrieval_instruments(laws, spec=spec)
    assert len(out) == 2
    for inst in out:
        assert inst["assessment_source"] == "heuristic"
        assert len(inst["dimensions"]) == 4
        assert inst["verdict"] in ("applies", "does_not_apply", "cannot_determine")
        assert inst["headline"]


def test_scan_cache_roundtrip():
    key = scan_cache_key(ANTENNA_TEXT, limit=15, min_score=0.75, include_secondary=True, full_scan=False)
    payload = catalog_scan_response(ANTENNA_TEXT, limit=15, min_score=0.75)
    assert payload is not None
    put_cached_scan(key, payload)
    from logic.prototype_fast import get_cached_scan

    cached = get_cached_scan(key)
    assert cached is not None
    assert cached["match_count"] == payload["match_count"]


def test_assess_cache_key_stable():
    k1 = assess_cache_key(ANTENNA_TEXT, ["gdpr", "red"], [])
    k2 = assess_cache_key(ANTENNA_TEXT, ["red", "gdpr"], [])
    assert k1 == k2
