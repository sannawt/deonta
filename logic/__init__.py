"""Compliance reasoning: schema validation and Soufflé execution."""

from logic.corpus import load_regulations
from logic.defeasibility import build_defeasibility
from logic.provenance import build_provenance
from logic.reasoner import run_universal_reasoner
from logic.schema import load_predicate_schema, validate_ground_facts
from logic.py_scope_engine import evaluate_scope_program
from logic.phase_c_scope import analyse_phase_c_scope
from logic.scope_applicability import (
    build_applicability_report,
    validate_scope_facts,
)
from logic.souffle_runner import (
    run_scope_applicability,
    run_souffle_golden,
    souffle_available,
)

__all__ = [
    "load_predicate_schema",
    "load_regulations",
    "validate_ground_facts",
    "validate_scope_facts",
    "analyse_phase_c_scope",
    "evaluate_scope_program",
    "build_applicability_report",
    "build_provenance",
    "build_defeasibility",
    "run_universal_reasoner",
    "run_scope_applicability",
    "run_souffle_golden",
    "souffle_available",
]
