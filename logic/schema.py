import json
from functools import lru_cache
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[1]


@lru_cache(maxsize=1)
def load_required_facts_rows() -> tuple[dict[str, Any], ...]:
    path = REPO / "schemas" / "required_facts.json"
    if not path.is_file():
        return tuple()
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        return tuple()
    return tuple(row for row in data if isinstance(row, dict))


@lru_cache(maxsize=1)
def load_predicate_schema() -> dict[str, int]:
    """predicate name -> arity (from Required facts sheet)."""
    out: dict[str, int] = {}
    for row in load_required_facts_rows():
        p = row.get("predicate")
        if not p:
            continue
        name = str(p).strip()
        ar = row.get("arity")
        try:
            out[name] = int(float(ar)) if ar is not None else 0
        except (TypeError, ValueError):
            out[name] = 0
    return out


def validate_ground_facts(
    facts: list[dict[str, Any]],
) -> tuple[list[str], list[tuple[str, tuple[str, ...]]]]:
    """
    Validate user facts against schemas/required_facts.json.
    Returns (error_messages, normalized list of (predicate, args)).
    """
    schema = load_predicate_schema()
    errors: list[str] = []
    normalized: list[tuple[str, tuple[str, ...]]] = []
    if not schema:
        errors.append("schemas/required_facts.json missing or empty; run scripts/export_rules_xlsx.py")
        return errors, normalized

    for i, raw in enumerate(facts):
        if not isinstance(raw, dict):
            errors.append(f"facts[{i}]: must be an object")
            continue
        pred = raw.get("predicate")
        args = raw.get("args", [])
        if pred is None or not str(pred).strip():
            errors.append(f"facts[{i}]: missing predicate")
            continue
        name = str(pred).strip()
        if name not in schema:
            errors.append(f"facts[{i}]: unknown predicate {name!r}")
            continue
        if not isinstance(args, list):
            errors.append(f"facts[{i}]: args must be a list")
            continue
        exp = schema[name]
        str_args = tuple(str(a) for a in args)
        if len(str_args) != exp:
            errors.append(
                f"facts[{i}]: predicate {name!r} expects arity {exp}, got {len(str_args)}"
            )
            continue
        normalized.append((name, str_args))

    return errors, normalized


@lru_cache(maxsize=1)
def load_schema_labels() -> tuple[str, ...]:
    """Neo4j labels from schemas/nodes.json (node class column)."""
    path = REPO / "schemas" / "nodes.json"
    if not path.is_file():
        return tuple()
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        return tuple()
    labels: list[str] = []
    for row in data:
        if not isinstance(row, dict):
            continue
        c = row.get("node class")
        if c and str(c).strip():
            labels.append(str(c).strip())
    return tuple(sorted(set(labels)))
