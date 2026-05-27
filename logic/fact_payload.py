from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

from logic.corpus import load_predicate_index, load_regulations

ACTOR_ID = "your_org"
SIGNAL_VALUES = {"yes", "no", "unknown"}
SCENARIO_TYPE_HINTS = ("scenario", "aisystem", "ai_system")


def _dedupe_facts(facts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, tuple[str, ...]]] = set()
    out: list[dict[str, Any]] = []
    for fact in facts:
        pred = str(fact.get("predicate") or "").strip()
        args = tuple(str(x) for x in (fact.get("args") or []))
        if not pred:
            continue
        key = (pred, args)
        if key in seen:
            continue
        seen.add(key)
        row = dict(fact)
        row["predicate"] = pred
        row["args"] = list(args)
        out.append(row)
    return out


def fact_row(
    predicate: str,
    args: list[str],
    *,
    source: str = "derived",
    status: str = "derived",
) -> dict[str, Any]:
    return {
        "predicate": predicate,
        "args": [str(x) for x in args],
        "source": source,
        "status": status,
    }


def derive_in_force_phases(current_date: date | None = None) -> dict[str, list[str]]:
    current_date = current_date or datetime.today().date()
    phases: dict[str, list[str]] = {reg: [] for reg in load_regulations()}
    if current_date >= date(2018, 5, 25):
        phases.setdefault("gdpr", []).append("general")
    if current_date >= date(2025, 2, 2):
        phases.setdefault("ai_act", []).extend(
            ["chapter_i_general", "chapter_ii_prohibitions"]
        )
    if current_date >= date(2025, 8, 2):
        phases.setdefault("ai_act", []).extend(
            ["chapter_v_gpai", "chapter_vii_governance", "chapter_xii_penalties"]
        )
    if current_date >= date(2026, 8, 2):
        phases.setdefault("ai_act", []).append("general")
    if current_date >= date(2027, 8, 2):
        phases.setdefault("ai_act", []).append("art_6_p1_high_risk_nlf")
    return {
        reg: sorted(set(values))
        for reg, values in phases.items()
        if values
    }


def compatibility_facts_for_payload(
    *,
    case_id: str,
    regulations: list[str],
    personal_data_signal: str,
    eu_link_signal: str,
    active_phases: dict[str, list[str]],
    exclusion_pairs: list[tuple[str, str]] | None = None,
) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = [fact_row("case", [case_id])]
    for reg in regulations:
        facts.append(fact_row("regulation", [reg]))
        if active_phases.get(reg):
            facts.append(fact_row("law_in_force", [reg]))
    if personal_data_signal == "yes":
        facts.append(fact_row("processing_personal_data", [case_id]))
    if eu_link_signal == "yes":
        facts.append(fact_row("territorial_link_eu", [case_id]))
    for case_value, reg in exclusion_pairs or []:
        if case_value == case_id:
            facts.append(fact_row("exclusion_holds", [case_id, reg]))
    return _dedupe_facts(facts)


def clarification_facts_for_answers(
    *,
    case_id: str,
    answers: dict[str, str],
) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []
    datum_id = f"{case_id}_datum"
    person_id = f"{case_id}_person"
    if answers.get("gdpr_personal_data") == "yes":
        facts.extend(
            [
                fact_row("processing", [case_id], source="clarification", status="confirmed"),
                fact_row(
                    "processing_concerns",
                    [case_id, datum_id],
                    source="clarification",
                    status="confirmed",
                ),
                fact_row(
                    "automated_means",
                    [case_id],
                    source="clarification",
                    status="confirmed",
                ),
                fact_row(
                    "natural_person",
                    [person_id],
                    source="clarification",
                    status="confirmed",
                ),
                fact_row(
                    "concerns",
                    [datum_id, person_id],
                    source="clarification",
                    status="confirmed",
                ),
                fact_row(
                    "identifies",
                    [datum_id, person_id],
                    source="clarification",
                    status="confirmed",
                ),
            ]
        )
    if answers.get("gdpr_eu_link") == "yes":
        facts.extend(
            [
                fact_row(
                    "established_in",
                    [ACTOR_ID, "eu"],
                    source="clarification",
                    status="confirmed",
                ),
                fact_row(
                    "processing_in_context_of_establishment",
                    [case_id, ACTOR_ID],
                    source="clarification",
                    status="confirmed",
                ),
            ]
        )
    if answers.get("aiact_ai_system") == "yes":
        facts.extend(
            [
                fact_row(
                    "has_feature",
                    [case_id, "machine_based"],
                    source="clarification",
                    status="confirmed",
                ),
                fact_row(
                    "has_capability",
                    [case_id, "autonomous_operation"],
                    source="clarification",
                    status="confirmed",
                ),
                fact_row(
                    "has_capability",
                    [case_id, "inference_from_input"],
                    source="clarification",
                    status="confirmed",
                ),
            ]
        )
    return _dedupe_facts(facts)


def _normalize_signal(value: str | None) -> str:
    text = str(value or "").strip().lower()
    return text if text in SIGNAL_VALUES else "unknown"


def resolve_signal(base_value: str | None, answer_value: str | None) -> str:
    answer = _normalize_signal(answer_value)
    if answer in {"yes", "no"}:
        return answer
    return _normalize_signal(base_value)


def infer_scenario_id(
    facts: list[tuple[str, tuple[str, ...]]] | list[dict[str, Any]],
    *,
    fallback: str | None = None,
) -> str | None:
    index = load_predicate_index()
    candidates: list[str] = []
    for row in facts:
        if isinstance(row, tuple):
            pred, args = row
            args_list = list(args)
        else:
            pred = str(row.get("predicate") or "")
            args_list = [str(x) for x in (row.get("args") or [])]
        meta = index.get(pred) or {}
        arg_types = str(meta.get("argument types") or "")
        parts = [part.strip().lower() for part in arg_types.split(",") if part.strip()]
        for pos, part in enumerate(parts):
            if pos >= len(args_list):
                continue
            if any(hint in part for hint in SCENARIO_TYPE_HINTS):
                candidates.append(args_list[pos])
    if candidates:
        return candidates[0]
    return fallback


@dataclass
class FactPayload:
    case_id: str
    raw_text: str
    extracted_facts: list[dict[str, Any]] = field(default_factory=list)
    derived_facts: list[dict[str, Any]] = field(default_factory=list)
    clarified_facts: list[dict[str, Any]] = field(default_factory=list)
    clarification_answers: dict[str, str] = field(default_factory=dict)
    signals: dict[str, str] = field(default_factory=dict)
    active_phases: dict[str, list[str]] = field(default_factory=dict)

    @property
    def all_facts(self) -> list[dict[str, Any]]:
        return _dedupe_facts(
            self.extracted_facts + self.derived_facts + self.clarified_facts
        )

    def to_dict(self) -> dict[str, Any]:
        regulations = list(load_regulations())
        personal_signal = resolve_signal(
            self.signals.get("personal_data"),
            self.clarification_answers.get("gdpr_personal_data"),
        )
        eu_signal = resolve_signal(
            self.signals.get("eu_link"),
            self.clarification_answers.get("gdpr_eu_link"),
        )
        return {
            "case_id": self.case_id,
            "raw_text": self.raw_text,
            "extracted_facts": _dedupe_facts(self.extracted_facts),
            "derived_facts": _dedupe_facts(self.derived_facts),
            "clarified_facts": _dedupe_facts(self.clarified_facts),
            "all_facts": self.all_facts,
            "compatibility_facts": compatibility_facts_for_payload(
                case_id=self.case_id,
                regulations=regulations,
                personal_data_signal=personal_signal,
                eu_link_signal=eu_signal,
                active_phases=self.active_phases,
            ),
            "clarification_answers": dict(self.clarification_answers),
            "signals": {
                "personal_data": personal_signal,
                "eu_link": eu_signal,
                "ai_system": resolve_signal(
                    self.signals.get("ai_system"),
                    self.clarification_answers.get("aiact_ai_system"),
                ),
            },
            "active_phases": {
                reg: list(values) for reg, values in self.active_phases.items()
            },
        }
