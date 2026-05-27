"""
Friendly labels for internal engine tokens (session/case ids, actor placeholders).
"""

from __future__ import annotations

import re
from typing import Any

ACTOR_ID = "your_org"
ACTOR_LABEL = "your organisation"
SCENARIO_LABEL = "this assessment scenario"

_SIT_RX = re.compile(r"^sit_[a-z0-9]+$", re.I)
_SESSION_ID_RX = re.compile(r"^[a-z0-9]{10,22}$", re.I)
_CASE_SUFFIX_RX = re.compile(r"^([a-z0-9]{10,22}|sit_[a-z0-9]+)_(person|datum)$", re.I)


def is_internal_case_id(token: str) -> bool:
    t = (token or "").strip().strip("\"'")
    if not t:
        return False
    if t.startswith("sit_"):
        return True
    if t == ACTOR_ID:
        return False
    if "_" in t or "." in t or ":" in t:
        return False
    if not _SESSION_ID_RX.match(t):
        return False
    return any(c.isdigit() for c in t) and any(c.isalpha() for c in t)


def friendly_token(token: str, *, case_id: str | None = None) -> str | None:
    t = (token or "").strip().strip("\"'")
    if not t:
        return None
    if t == ACTOR_ID:
        return ACTOR_LABEL
    m = _CASE_SUFFIX_RX.match(t)
    if m:
        suffix = m.group(2).lower()
        return "a data subject" if suffix == "person" else "a data item"
    if case_id and t == case_id:
        return SCENARIO_LABEL
    if is_internal_case_id(t):
        return SCENARIO_LABEL
    return t


def format_fact_value(
    predicate: str,
    args: list[Any],
    *,
    case_id: str | None = None,
) -> str:
    """Human-readable value for facts table / UI (no raw session ids)."""
    pred = (predicate or "").strip()
    parts: list[str] = []
    for raw in args or []:
        label = friendly_token(str(raw), case_id=case_id)
        if label and label not in parts:
            parts.append(label)

    phrases: dict[str, str] = {
        "data_subjects_in_eu_targeted": (
            "People in the EU are in scope for your organisation in this assessment."
        ),
        "processing_in_context_of_establishment": (
            "Processing appears linked to an EU establishment of your organisation."
        ),
        "places_on_eu_market": "Your organisation appears to place the system on the EU market.",
        "provider": "Your organisation appears to act as the AI provider for this assessment.",
        "output_used_in_eu": "Output of the system appears used in the EU in this assessment.",
        "established_in": "Your organisation appears established in the EU.",
        "processing": "A processing activity is described in this assessment.",
        "regulation_territorial_link": "An EU territorial link is asserted for this assessment.",
        "regulation_excluded": "Whether an exclusion or carve-out applies to this assessment.",
        "regulation_material": "Whether the activity falls within the regulation's material scope.",
    }
    if pred in phrases:
        return phrases[pred]

    if not parts:
        return "asserted"
    if len(parts) == 1:
        return parts[0]
    return " · ".join(parts)


def sanitize_atom_display(atom: str, *, case_id: str | None = None) -> str:
    """Replace tokens inside a Datalog atom string for UI."""
    s = (atom or "").strip()
    if not s:
        return s
    if case_id:
        s = re.sub(re.escape(case_id), SCENARIO_LABEL, s)
    s = re.sub(r"\byour_org\b", ACTOR_LABEL, s)
    # Replace internal derived entity ids (case_id_person, case_id_datum)
    s = _CASE_SUFFIX_RX.sub(lambda m: "a data subject" if m.group(2).lower() == "person" else "a data item", s)
    s = re.sub(r'"([^"]{10,22})"', _replace_quoted_session, s)
    s = re.sub(r"'([^']{10,22})'", _replace_quoted_session, s)
    return re.sub(r"\s+", " ", s).strip()


def _replace_quoted_session(m: re.Match[str]) -> str:
    inner = m.group(1)
    if is_internal_case_id(inner):
        return f'"{SCENARIO_LABEL}"'
    return m.group(0)


def format_proof_gap_message(
    *,
    atom: str,
    engine_note: str,
    dimension: str,
    dim_result: str,
    regulation_label: str,
) -> tuple[str, str] | None:
    """
    User-facing label + note for provenance 'gap' lines.
    Returns None when the gap should not be shown (e.g. PASS on exclusions).
    """
    if dim_result == "PASS":
        return None

    atom_l = (atom or "").lower()
    note = (engine_note or "").strip()
    reg = regulation_label or "the regulation"
    dim = dimension or "scope"

    if "regulation_excluded" in atom_l:
        return (
            f"Exclusion check ({reg})",
            "The detailed proof trace did not re-derive an exclusion atom from your facts. "
            "That does not by itself mean an exclusion applies — other scope gates drive the result.",
        )
    if "regulation_material" in atom_l:
        return (
            f"Material scope check ({reg})",
            "The proof trace did not fully chain a material-scope atom for this assessment. "
            "Open material-scope facts or clarifications may still be needed.",
        )
    if "regulation_territorial_link" in atom_l or "territorial_link" in atom_l:
        return (
            "EU territorial link",
            "The proof trace could not ground a territorial-link atom (often because the "
            "scenario uses a placeholder actor). Scope may still pass from other EU facts you provided.",
        )
    if "active_phases" in atom_l:
        return (
            "In-force dates",
            note or "Temporal scope could not be fully traced from derived facts.",
        )

    if note == "Expected atom is not derived for the current facts":
        return (
            f"Proof trace gap ({dim})",
            f"An expected reasoning step for {reg} was not reconstructed from the current facts. "
            "This is a trace limitation, not necessarily a legal conclusion.",
        )

    return (
        "Proof trace gap",
        note or "A step in the symbolic proof was not grounded on the current facts.",
    )
