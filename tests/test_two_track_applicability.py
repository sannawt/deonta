"""Two-track applicability: symbolic scope rules vs semantic discovery."""

from logic.assess_pipeline import _normalize_catalog_codes
from logic.law_relevance_scan import filter_discovery_results
from logic.legal_db import is_symbolic_regulation, symbolic_regulation_codes


def test_symbolic_regulation_codes():
    codes = symbolic_regulation_codes()
    assert "gdpr" in codes
    assert "ai_act" in codes


def test_filter_discovery_results_excludes_symbolic():
    rows = [
        {"code": "gdpr", "catalog_code": "gdpr", "score": 0.95},
        {"code": "cra", "catalog_code": "cra", "score": 0.88},
        {"code": "ai_act", "catalog_code": "ai_act", "score": 0.91},
    ]
    out = filter_discovery_results(rows)
    codes = {r["code"] for r in out}
    assert codes == {"cra"}


def test_is_symbolic_regulation():
    assert is_symbolic_regulation("gdpr")
    assert is_symbolic_regulation("AI_ACT")
    assert not is_symbolic_regulation("cra")


def test_discovery_catalog_excludes_symbolic():
    raw = ["cra", "gdpr", "nis2", "ai_act"]
    discovery = [c for c in _normalize_catalog_codes(raw) if not is_symbolic_regulation(c)]
    assert discovery == ["cra", "nis2"]
    assert set(symbolic_regulation_codes()) <= set(_normalize_catalog_codes(raw + symbolic_regulation_codes()))
