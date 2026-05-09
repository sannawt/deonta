"""Compliance reasoning: schema validation and Soufflé execution."""

from logic.schema import load_predicate_schema, validate_ground_facts
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
    "validate_ground_facts",
    "validate_scope_facts",
    "build_applicability_report",
    "run_scope_applicability",
    "run_souffle_golden",
    "souffle_available",
]
