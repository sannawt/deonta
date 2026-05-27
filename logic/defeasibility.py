from __future__ import annotations

from typing import Any

def build_defeasibility(
    *,
    evaluations: list[dict[str, Any]],
    provenance: dict[str, Any],
) -> dict[str, list[dict[str, Any]]]:
    by_reg = provenance.get("by_regulation") or {}
    out: dict[str, list[dict[str, Any]]] = {}
    for ev in evaluations:
        reg = str(ev.get("regulation") or "")
        rows: list[dict[str, Any]] = []
        seen: set[tuple[str, str]] = set()
        for line in by_reg.get(reg, []):
            kind = str(line.get("kind") or "")
            atom = str(line.get("atom") or "")
            if kind == "~ndaf":
                key = ("unless", atom)
                if key in seen:
                    continue
                seen.add(key)
                rows.append(
                    {
                        "mode": "unless",
                        "atom": atom,
                        "provision_long_id": line.get("provision_long_id"),
                        "citation": line.get("citation"),
                        "note": "This current indication holds unless this excluded predicate grounds.",
                    }
                )
        for atom in ev.get("missing_atoms") or []:
            key = ("gap", atom)
            if key in seen:
                continue
            seen.add(key)
            rows.append(
                {
                    "mode": "gap",
                    "atom": atom,
                    "provision_long_id": None,
                    "citation": None,
                    "note": "If this atom were grounded, the indication could change.",
                }
            )
        out[reg] = rows
    return out
