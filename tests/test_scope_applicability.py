import json
from pathlib import Path

import pytest

from logic.scope_applicability import (
    build_applicability_report,
    validate_scope_facts,
)
from logic.souffle_runner import run_scope_applicability, souffle_available

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "scope"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_validate_scope_facts_accepts_union_case():
    data = _load("eu_gdpr_applies.json")
    errs, norm = validate_scope_facts(data["facts"])
    assert errs == []
    assert ("case", ("s1",)) in norm


@pytest.mark.skipif(not souffle_available(), reason="Soufflé not installed")
@pytest.mark.parametrize(
    "fixture,expected",
    [
        ("eu_gdpr_applies.json", "applies"),
        ("no_territorial_link.json", "does_not_apply"),
        ("exclusion_blocks.json", "does_not_apply"),
    ],
)
def test_scope_verdict_matches_fixture(fixture: str, expected: str):
    data = _load(fixture)
    errs, norm = validate_scope_facts(data["facts"])
    assert not errs
    out = run_scope_applicability(norm)
    rep = build_applicability_report(out.get("outputs") or {})
    assert rep["verdict"] == expected == data["expect_verdict"]


@pytest.mark.skipif(not souffle_available(), reason="Soufflé not installed")
def test_souffle_scope_outputs_rows():
    data = _load("eu_gdpr_applies.json")
    _, norm = validate_scope_facts(data["facts"])
    out = run_scope_applicability(norm)
    assert out["ok"], out.get("stderr") or out.get("message")
    assert out["outputs"].get("law_applies") == [["s1", "gdpr"]]


@pytest.mark.skipif(not souffle_available(), reason="Soufflé not installed")
def test_legacy_gdpr_r14_still_runs():
    from logic.souffle_runner import run_souffle_golden

    out = run_souffle_golden([("natural_person", ("alice",))])
    assert out["ok"], out.get("stderr") or out.get("message")
