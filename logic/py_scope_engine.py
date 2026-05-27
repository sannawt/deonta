"""
Pure-Python evaluation of the scope / applicability Horn program
(same semantics as rules/golden/scope_applicability.dl).

No Soufflé or Homebrew required. Stratified: EDB → positive IDB → law_applies with negation on excluded/2.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any


def _rows(pairs: set[tuple[str, ...]]) -> list[list[str]]:
    return [list(t) for t in sorted(pairs)]


def evaluate_scope_program(
    facts: list[tuple[str, tuple[str, ...]]],
) -> dict[str, Any]:
    """
    facts: list of (predicate, (arg0, ...)) extensional atoms.
    Returns the same shape as logic.souffle_runner._run_souffle on success.
    """
    edb: dict[str, set[tuple[str, ...]]] = defaultdict(set)
    for pred, args in facts:
        edb[pred].add(args)

    def has(name: str, *args: str) -> bool:
        return args in edb[name]

    cases = {t[0] for t in edb["case"]}
    regulations = {t[0] for t in edb["regulation"]}

    material: set[tuple[str, str]] = set()
    territorial: set[tuple[str, str]] = set()
    temporal: set[tuple[str, str]] = set()
    excluded: set[tuple[str, str]] = set()

    for c in cases:
        for r in regulations:
            if has("processing_personal_data", c):
                material.add((c, r))
            if has("territorial_link_eu", c):
                territorial.add((c, r))
            if has("law_in_force", r):
                temporal.add((c, r))
            if has("exclusion_holds", c, r):
                excluded.add((c, r))

    applies: set[tuple[str, str]] = set()
    for pair in material & territorial & temporal:
        if pair not in excluded:
            applies.add(pair)

    outputs = {
        "material_scope_ok": _rows(material),
        "territorial_scope_ok": _rows(territorial),
        "temporal_scope_ok": _rows(temporal),
        "excluded": _rows(excluded),
        "law_applies": _rows(applies),
    }

    return {
        "ok": True,
        "skipped": False,
        "message": "ok",
        "outputs": outputs,
        "stderr": "",
        "stdout": "",
        "program": "logic/py_scope_engine.py (pure Python)",
        "engine": "python_datalog",
    }
