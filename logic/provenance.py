from __future__ import annotations

from collections import defaultdict
import re
from typing import Any

from logic.corpus import load_citations, load_rules_index

DIMENSION_ORDER = ("TEMPORAL", "TERRITORIAL", "MATERIAL", "EXCLUSION", "VERDICT", "DEFINITION")


def _split_top_level(text: str, sep: str) -> list[str]:
    parts: list[str] = []
    buf: list[str] = []
    depth = 0
    in_string = False
    quote_char = ""
    for ch in text:
        if in_string:
            buf.append(ch)
            if ch == quote_char:
                in_string = False
            continue
        if ch in ('"', "'"):
            in_string = True
            quote_char = ch
            buf.append(ch)
            continue
        if ch == "(":
            depth += 1
            buf.append(ch)
            continue
        if ch == ")":
            depth = max(0, depth - 1)
            buf.append(ch)
            continue
        if ch == sep and depth == 0:
            part = "".join(buf).strip()
            if part:
                parts.append(part)
            buf = []
            continue
        buf.append(ch)
    tail = "".join(buf).strip()
    if tail:
        parts.append(tail)
    return parts


def _parse_atom(atom: str) -> tuple[bool, str, list[str]]:
    atom = atom.strip().rstrip(".")
    neg = atom.startswith("!")
    if neg:
        atom = atom[1:].strip()
    m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)$", atom)
    if not m:
        return neg, atom, []
    pred = m.group(1)
    inner = m.group(2).strip()
    args = _split_top_level(inner, ",") if inner else []
    return neg, pred, [a.strip() for a in args]


def _is_var(token: str) -> bool:
    return bool(re.match(r"^[A-Z_][A-Za-z0-9_]*$", token))


def _unquote(token: str) -> str:
    token = token.strip()
    if len(token) >= 2 and token[0] == token[-1] and token[0] in {'"', "'"}:
        return token[1:-1]
    return token


def _match_with_bindings(pattern_args: list[str], actual_args: tuple[str, ...], bindings: dict[str, str]) -> dict[str, str] | None:
    if len(pattern_args) != len(actual_args):
        return None
    out = dict(bindings)
    for patt, actual in zip(pattern_args, actual_args):
        patt = patt.strip()
        if _is_var(patt):
            prev = out.get(patt)
            if prev is not None and prev != actual:
                return None
            out[patt] = actual
        else:
            if _unquote(patt) != actual:
                return None
    return out


def _instantiate_args(pattern_args: list[str], bindings: dict[str, str]) -> list[str]:
    out: list[str] = []
    for patt in pattern_args:
        patt = patt.strip()
        if _is_var(patt):
            out.append(bindings.get(patt, patt))
        else:
            out.append(_unquote(patt))
    return out


def _dimension_for_predicate(pred: str, scope_tag: str | None = None) -> str:
    if scope_tag:
        tag = str(scope_tag).strip().upper()
        if tag in DIMENSION_ORDER:
            return tag
    if pred.endswith("_material") or pred == "regulation_material":
        return "MATERIAL"
    if pred.endswith("_territorial_link") or pred == "regulation_territorial_link":
        return "TERRITORIAL"
    if pred.endswith("_excluded") or pred == "regulation_excluded":
        return "EXCLUSION"
    if pred == "in_force":
        return "TEMPORAL"
    if pred in {"applies", "applies_via_actor", "obligation", "prohibition"}:
        return "VERDICT"
    return "DEFINITION"


def _index_atoms(
    normalized_facts: list[tuple[str, tuple[str, ...]]],
    outputs: dict[str, list[list[str]]],
) -> dict[str, set[tuple[str, ...]]]:
    atoms: dict[str, set[tuple[str, ...]]] = defaultdict(set)
    for pred, args in normalized_facts:
        atoms[pred].add(tuple(args))
    for pred, rows in outputs.items():
        for row in rows:
            atoms[pred].add(tuple(str(x) for x in row))
    return atoms


def _build_rule_index() -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for rule in load_rules_index():
        head = str(rule.get("head_predicate") or "").strip()
        if head:
            out[head].append(dict(rule))
    return out


def _find_rule_and_binding(
    goal_pred: str,
    goal_args: tuple[str, ...],
    rules_by_head: dict[str, list[dict[str, Any]]],
    atoms: dict[str, set[tuple[str, ...]]],
) -> tuple[dict[str, Any] | None, dict[str, str] | None]:
    for rule in rules_by_head.get(goal_pred, []):
        _, _, head_args = _parse_atom(str(rule.get("head_atom") or ""))
        bindings = _match_with_bindings(head_args, goal_args, {})
        if bindings is None:
            continue
        ok = True
        working = dict(bindings)
        for raw in rule.get("body_atoms") or []:
            neg, pred, patt_args = _parse_atom(str(raw))
            if neg:
                concrete = tuple(_instantiate_args(patt_args, working))
                if concrete in atoms.get(pred, set()):
                    ok = False
                    break
                continue
            matched = None
            for actual in atoms.get(pred, set()):
                maybe = _match_with_bindings(patt_args, actual, working)
                if maybe is not None:
                    matched = maybe
                    break
            if matched is None:
                ok = False
                break
            working = matched
        if ok:
            return rule, working
    return None, None


def _proof_for_goal(
    goal_pred: str,
    goal_args: tuple[str, ...],
    *,
    rules_by_head: dict[str, list[dict[str, Any]]],
    atoms: dict[str, set[tuple[str, ...]]],
    citations: dict[str, Any],
    seen: set[tuple[str, tuple[str, ...]]],
) -> list[dict[str, Any]]:
    key = (goal_pred, goal_args)
    if key in seen:
        return []
    seen.add(key)
    rule, bindings = _find_rule_and_binding(goal_pred, goal_args, rules_by_head, atoms)
    if rule is None or bindings is None:
        return []
    plid = str(rule.get("provision_long_id") or "")
    dim = _dimension_for_predicate(goal_pred, rule.get("scope_tag"))
    lines: list[dict[str, Any]] = [
        {
            "dimension": dim,
            "kind": "derive",
            "atom": f"{goal_pred}({', '.join(goal_args)})",
            "provision_long_id": plid or None,
            "citation": citations.get(plid) if plid else None,
            "note": rule.get("rule_text"),
        }
    ]
    for raw in rule.get("body_atoms") or []:
        neg, pred, patt_args = _parse_atom(str(raw))
        concrete_args = tuple(_instantiate_args(patt_args, bindings))
        atom_str = f"{pred}({', '.join(concrete_args)})"
        if neg:
            present = concrete_args in atoms.get(pred, set())
            lines.append(
                {
                    "dimension": _dimension_for_predicate(pred, rule.get("scope_tag")),
                    "kind": "~ndaf" if not present else "exclude",
                    "atom": atom_str,
                    "provision_long_id": plid or None,
                    "citation": citations.get(plid) if plid else None,
                    "note": "Negation-as-failure support" if not present else "Predicate grounded and blocks this rule",
                }
            )
            continue
        if concrete_args in atoms.get(pred, set()):
            child_rule, _ = _find_rule_and_binding(pred, concrete_args, rules_by_head, atoms)
            lines.append(
                {
                    "dimension": _dimension_for_predicate(pred, child_rule.get("scope_tag") if child_rule else rule.get("scope_tag")),
                    "kind": "derive" if child_rule else "ground",
                    "atom": atom_str,
                    "provision_long_id": str(child_rule.get("provision_long_id") or "") or None if child_rule else None,
                    "citation": citations.get(str(child_rule.get("provision_long_id") or "")) if child_rule and child_rule.get("provision_long_id") else None,
                    "note": child_rule.get("rule_text") if child_rule else "Fact supplied or reference fact",
                }
            )
            if child_rule:
                lines.extend(
                    _proof_for_goal(
                        pred,
                        concrete_args,
                        rules_by_head=rules_by_head,
                        atoms=atoms,
                        citations=citations,
                        seen=seen,
                    )
                )
        else:
            lines.append(
                {
                    "dimension": _dimension_for_predicate(pred, rule.get("scope_tag")),
                    "kind": "gap",
                    "atom": atom_str,
                    "provision_long_id": plid or None,
                    "citation": citations.get(plid) if plid else None,
                    "note": "Required body literal not grounded for this scenario",
                }
            )
    return lines


def build_provenance(
    *,
    normalized_facts: list[tuple[str, tuple[str, ...]]],
    outputs: dict[str, list[list[str]]],
    evaluations: list[dict[str, Any]],
    scenario_id: str | None = None,
    active_phases: dict[str, list[str]] | None = None,
) -> dict[str, Any]:
    citations = load_citations()
    rules_by_head = _build_rule_index()
    atoms = _index_atoms(normalized_facts, outputs)

    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for pred, args in normalized_facts:
        grouped["DEFINITION"].append(
            {
                "dimension": "DEFINITION",
                "kind": "ground",
                "atom": f"{pred}({', '.join(args)})",
                "provision_long_id": None,
                "citation": None,
                "note": "Fact supplied to the engine",
            }
        )

    by_regulation: dict[str, list[dict[str, Any]]] = {}
    for ev in evaluations:
        reg = str(ev.get("regulation") or "")
        reg_lines: list[dict[str, Any]] = []
        seen: set[tuple[str, tuple[str, ...]]] = set()
        if scenario_id:
            goals: list[tuple[str, tuple[str, ...]]] = [
                ("regulation_material", (reg, scenario_id)),
                ("regulation_excluded", (reg, scenario_id)),
            ]
            phases = list((active_phases or {}).get(reg) or [])
            if phases:
                reg_lines.append(
                    {
                        "dimension": "TEMPORAL",
                        "kind": "derived",
                        "atom": f'active_phases("{reg}", {", ".join(phases)})',
                        "provision_long_id": None,
                        "citation": None,
                        "note": "Temporal applicability derived in the application layer from workbook application dates.",
                    }
                )
            else:
                reg_lines.append(
                    {
                        "dimension": "TEMPORAL",
                        "kind": "gap",
                        "atom": f'active_phases("{reg}")',
                        "provision_long_id": None,
                        "citation": None,
                        "note": "No active workbook phase is in force for this regulation on the current date.",
                    }
                )
            if ev.get("derived", {}).get("applies"):
                goals.append(("applies", (scenario_id, "current", reg)))
            terr_rows = ev.get("territorial_links") or []
            if terr_rows:
                first = terr_rows[0]
                if len(first) >= 3:
                    goals.append(("regulation_territorial_link", tuple(str(x) for x in first[:3])))
            else:
                goals.append(("regulation_territorial_link", (reg, "Actor", scenario_id)))
            for pred, args in goals:
                if "Actor" in args:
                    reg_lines.append(
                        {
                            "dimension": _dimension_for_predicate(pred),
                            "kind": "gap",
                            "atom": f"{pred}({', '.join(args)})",
                            "provision_long_id": None,
                            "citation": None,
                            "note": "No grounded atom found for this goal",
                        }
                    )
                    continue
                if args in atoms.get(pred, set()):
                    reg_lines.extend(
                        _proof_for_goal(
                            pred,
                            args,
                            rules_by_head=rules_by_head,
                            atoms=atoms,
                            citations=citations,
                            seen=seen,
                        )
                    )
                else:
                    reg_lines.append(
                        {
                            "dimension": _dimension_for_predicate(pred),
                            "kind": "gap",
                            "atom": f"{pred}({', '.join(args)})",
                            "provision_long_id": None,
                            "citation": None,
                            "note": "Expected atom is not derived for the current facts",
                        }
                    )
        by_regulation[reg] = reg_lines
        for line in reg_lines:
            grouped[line["dimension"]].append(line)

    return {
        "groups": [
            {"dimension": dim, "lines": grouped.get(dim, [])}
            for dim in DIMENSION_ORDER
            if grouped.get(dim)
        ],
        "by_regulation": by_regulation,
    }
