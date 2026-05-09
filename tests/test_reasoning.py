import pytest

from logic.schema import validate_ground_facts
from logic.souffle_runner import run_souffle_golden, souffle_available


def test_validate_rejects_unknown_predicate():
    errs, norm = validate_ground_facts([{"predicate": "not_a_real_predicate", "args": ["x"]}])
    assert errs
    assert norm == []


def test_validate_rejects_bad_arity():
    errs, norm = validate_ground_facts([{"predicate": "natural_person", "args": ["a", "b"]}])
    assert any("arity" in e for e in errs)
    assert norm == []


def test_validate_accepts_natural_person():
    errs, norm = validate_ground_facts([{"predicate": "natural_person", "args": ["alice"]}])
    assert errs == []
    assert norm == [("natural_person", ("alice",))]


@pytest.mark.skipif(not souffle_available(), reason="Soufflé not installed")
def test_souffle_golden_gdpr_protects():
    out = run_souffle_golden([("natural_person", ("alice",))])
    assert out["ok"], out.get("stderr") or out.get("message")
    rows = out["outputs"].get("gdpr_protects") or []
    assert ["alice"] in rows or rows == [["alice"]]


@pytest.mark.skipif(not souffle_available(), reason="Soufflé not installed")
def test_souffle_golden_not_personal_data():
    out = run_souffle_golden([("legal_person_data", ("corp1",))])
    assert out["ok"], out.get("stderr") or out.get("message")
    rows = out["outputs"].get("not_personal_data") or []
    assert ["corp1"] in rows or rows == [["corp1"]]
