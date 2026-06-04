"""
Rule-first fact extraction from natural language (Step 2) + optional OpenAI pass.

Output is JSON-friendly facts compatible with ``validate_scope_facts``.
"""

from __future__ import annotations

import json
import os
import re
import secrets
import urllib.error
import urllib.request
from typing import Any

from logic.corpus import extensional_predicates, load_regulations
from logic.graph_citations import _preview
from logic.scenario_store import upsert_scenario

FALLBACK_REGS = ("gdpr", "eu_ai_act", "mdr", "ccpa", "hipaa")

_PERSONAL = re.compile(
    r"personal data|pii|\bemail\b|\bnames?\b|health data|patient|patient records|"
    r"special category|identifiable|employee|worker|process(es|ing)? data",
    re.I,
)
_NEGATED_PERSONAL = re.compile(
    r"(?:\bno\b|\bnot\b|\bwithout\b|\bdoes not\b|\bdoesn't\b|\bdo not\b|\bdon't\b)"
    r"[^.]{0,80}?"
    r"(?:personal data|pii|\bemail\b|\bnames?\b|health data|patient|patient records|"
    r"special category|identifiable(?:\s+\w+){0,3}|worker data|employee data|process(es|ing)? data)",
    re.I,
)
_EU = re.compile(
    r"\beu\b|european union|\beurope\b|germany|france|finland|netherlands|spain|italy|"
    r"eu market|in the eu|union establishment|services to.*eu",
    re.I,
)
_EXCLUSION = re.compile(
    r"\bexempt\b|exclusion|derogation|purely personal|household activity|carve-?out",
    re.I,
)
_PROCESSING = re.compile(
    r"\bprocess(?:es|ing)?\b|\bstore(?:s|d)?\b|\bcollect(?:s|ed|ing)?\b|\buse(?:s|d)?\b|"
    r"\banalys(?:e|es|ed|ing)\b|\banalyz(?:e|es|ed|ing)\b|\btrack(?:s|ed|ing)?\b|"
    r"\bmonitor(?:s|ed|ing)?\b|\bhandle(?:s|d|ing)?\b|\bapi\b|\bplatform\b|\bsaas\b",
    re.I,
)
_DIGITAL = re.compile(r"\bapi\b|\bplatform\b|\bsaas\b|\bsystem\b|\bsoftware\b|\bmodel\b", re.I)
_AI = re.compile(
    r"\bai system\b|artificial intelligence|machine learning|\bml model\b|predictive model|"
    r"neural network|deep learning|\bllm\b|language model|computer vision|"
    r"recommendation system|automated decision|algorithm|ai-powered|ai-based|"
    r"trained model|inference|predictive maintenance|\bai model\b|\bai models\b",
    re.I,
)
_PROVIDER = re.compile(
    r"\bsell(?:ing)?\b|\bplace(?:s|d)? on (?:the )?market\b|\bdeploy(?:ing|ed)?\b|"
    r"\bwe offer\b|\bwe provide\b|\bprovider\b",
    re.I,
)
_EMPLOYMENT = re.compile(
    r"\bhr\b|employee|employment|recruit(?:ment|ing)|hiring|workforce|"
    r"worker management|attendance|performance score|productivity metric|promotion|termination",
    re.I,
)
_ESTABLISHMENT = re.compile(
    r"\bbased in\b|\bestablished in\b|\bheadquartered in\b|\blocated in\b",
    re.I,
)
_BILLING_CONTACT = re.compile(r"billing|invoice|contact|api key|account", re.I)


def new_case_id() -> str:
    return "sit_" + secrets.token_hex(4)


def _discover_regulation_aliases() -> list[tuple[re.Pattern[str], str]]:
    try:
        regs = list(load_regulations()) or list(FALLBACK_REGS)
    except Exception:  # noqa: BLE001
        regs = list(FALLBACK_REGS)
    out: list[tuple[re.Pattern[str], str]] = []
    for reg in regs:
        tokens = {reg, reg.replace("_", " ")}
        if reg == "eu_ai_act":
            tokens.update({"ai act", "eu ai act", "artificial intelligence act"})
        if reg == "gdpr":
            tokens.update({"general data protection regulation", "data protection regulation"})
        pattern = r"|".join(re.escape(t) for t in sorted(tokens, key=len, reverse=True))
        out.append((re.compile(rf"\b(?:{pattern})\b", re.I), reg))
    return out


def _norm_fact_dict(pred: str, args: list[str]) -> dict[str, Any]:
    return {"predicate": pred, "args": list(args)}


def _dedupe_facts(facts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, tuple[str, ...]]] = set()
    out: list[dict[str, Any]] = []
    for f in facts:
        p = str(f.get("predicate", "")).strip()
        a = f.get("args") or []
        if not isinstance(a, list):
            continue
        t = (p, tuple(str(x) for x in a))
        if t in seen:
            continue
        seen.add(t)
        out.append({"predicate": p, "args": [str(x) for x in a]})
    return out


def _human_label(pred: str, args: list[str], case_id: str) -> str:
    if pred == "processing":
        return "The situation involves a processing activity"
    if pred == "processing_concerns":
        return "The processing involves a concrete data item"
    if pred == "automated_means":
        return "The processing appears to happen by automated means"
    if pred == "natural_person":
        return "A natural person is involved in the data flow"
    if pred == "concerns":
        return "The data appears to concern an identifiable person"
    if pred == "identifies":
        return "The data appears able to identify a person"
    if pred == "established_in":
        return "An actor appears established in the EU"
    if pred == "processing_in_context_of_establishment":
        return "The processing appears tied to an EU establishment"
    if pred == "data_subjects_in_eu_targeted":
        return "The situation appears to target people in the EU"
    if pred == "provider":
        return "The organisation appears to act as an AI provider"
    if pred == "places_on_eu_market":
        return "The AI system appears to be placed on the EU market"
    if pred == "output_used_in_eu":
        return "The AI system output appears to be used in the EU"
    if pred == "has_feature" and len(args) >= 2:
        return f"Detected feature: {args[1].replace('_', ' ')}"
    if pred == "has_capability" and len(args) >= 2:
        return f"Detected capability: {args[1].replace('_', ' ')}"
    if pred == "high_risk_ai_use_case":
        return "The situation appears to match a high-risk AI use case"
    if pred == "employment_social_security_law_basis":
        return "The situation appears connected to employment or worker-management law"
    return f"{pred}({', '.join(args)})"


def _allowed_predicates() -> set[str]:
    try:
        return {str(row.get("predicate") or "").strip() for row in extensional_predicates()}
    except Exception:  # noqa: BLE001
        return set()


def _personal_data_signal(situation: str) -> tuple[str, str | None]:
    negated = bool(_NEGATED_PERSONAL.search(situation))
    cleaned = _NEGATED_PERSONAL.sub(" ", situation)
    positive = bool(_PERSONAL.search(cleaned))
    if positive:
        return "yes", None
    if negated and _BILLING_CONTACT.search(situation):
        return (
            "unknown",
            "The narrative rules out some personal data, but billing or account-contact details may still involve identifiable people.",
        )
    if negated:
        return "no", "Text says no personal or identifiable data."
    return "unknown", "Could not determine whether personal data is involved from the narrative alone."


def _yes_unknown_signal(pattern: re.Pattern[str], text: str) -> str:
    return "yes" if pattern.search(text) else "unknown"


def extract_facts_rules(
    situation: str, case_id: str
) -> tuple[list[dict[str, Any]], list[str], dict[str, str]]:
    notes: list[str] = []
    facts: list[dict[str, Any]] = []
    allowed = _allowed_predicates()
    signals = {
        "personal_data": "unknown",
        "eu_link": "unknown",
        "ai_system": "unknown",
    }

    for rx, _slug in _discover_regulation_aliases():
        if rx.search(situation):
            break
    else:
        notes.append("No regulation named in text — reasoning will rely on detected facts instead.")

    processing_hint = bool(_PROCESSING.search(situation))
    digital_hint = bool(_DIGITAL.search(situation))
    provider_hint = bool(_PROVIDER.search(situation))
    eu_hint = bool(_EU.search(situation))
    establishment_hint = bool(_ESTABLISHMENT.search(situation)) and eu_hint
    employment_hint = bool(_EMPLOYMENT.search(situation))

    personal_signal, personal_note = _personal_data_signal(situation)
    ai_signal = _yes_unknown_signal(_AI, situation)
    eu_signal = "yes" if eu_hint else "unknown"
    signals["personal_data"] = personal_signal
    signals["eu_link"] = eu_signal
    signals["ai_system"] = ai_signal

    if personal_note:
        notes.append(personal_note)
    if eu_signal == "unknown":
        notes.append("Could not determine an EU territorial link from the narrative alone.")
    if ai_signal == "unknown":
        notes.append("Could not confirm from the narrative alone whether this involves an AI system.")

    if "processing" in allowed and (processing_hint or personal_signal == "yes"):
        facts.append(_norm_fact_dict("processing", [case_id]))
    if "automated_means" in allowed and (digital_hint or ai_signal == "yes" or processing_hint):
        facts.append(_norm_fact_dict("automated_means", [case_id]))

    if personal_signal == "yes":
        datum_id = f"{case_id}_datum"
        person_id = f"{case_id}_person"
        if "processing_concerns" in allowed:
            facts.append(_norm_fact_dict("processing_concerns", [case_id, datum_id]))
        if "natural_person" in allowed:
            facts.append(_norm_fact_dict("natural_person", [person_id]))
        if "concerns" in allowed:
            facts.append(_norm_fact_dict("concerns", [datum_id, person_id]))
        if "identifies" in allowed:
            facts.append(_norm_fact_dict("identifies", [datum_id, person_id]))
        if "data_subjects_in_eu_targeted" in allowed and eu_hint:
            facts.append(_norm_fact_dict("data_subjects_in_eu_targeted", [case_id, "your_org"]))

    if establishment_hint and "established_in" in allowed:
        facts.append(_norm_fact_dict("established_in", ["your_org", "eu"]))
    if establishment_hint and "processing_in_context_of_establishment" in allowed:
        facts.append(
            _norm_fact_dict("processing_in_context_of_establishment", [case_id, "your_org"])
        )

    if ai_signal == "yes":
        if "has_feature" in allowed:
            facts.append(_norm_fact_dict("has_feature", [case_id, "machine_based"]))
        if "has_capability" in allowed:
            facts.append(_norm_fact_dict("has_capability", [case_id, "autonomous_operation"]))
            facts.append(_norm_fact_dict("has_capability", [case_id, "inference_from_input"]))
        if "provider" in allowed and provider_hint:
            facts.append(_norm_fact_dict("provider", ["your_org", case_id]))
        if "places_on_eu_market" in allowed and eu_hint:
            facts.append(_norm_fact_dict("places_on_eu_market", ["your_org", case_id]))
        if "output_used_in_eu" in allowed and eu_hint and not provider_hint:
            facts.append(_norm_fact_dict("output_used_in_eu", [case_id]))
        if employment_hint:
            if "used_in" in allowed:
                facts.append(
                    _norm_fact_dict("used_in", [case_id, "employment_workers_management"])
                )
            if "high_risk_ai_use_case" in allowed:
                facts.append(_norm_fact_dict("high_risk_ai_use_case", [case_id]))

    if employment_hint and "employment_social_security_law_basis" in allowed:
        facts.append(_norm_fact_dict("employment_social_security_law_basis", [case_id]))
    if employment_hint and "necessary_for_employment_social_security" in allowed:
        facts.append(_norm_fact_dict("necessary_for_employment_social_security", [case_id]))

    if _EXCLUSION.search(situation):
        notes.append("Exclusion-style wording detected in the narrative; downstream review should verify any carve-out.")

    return _dedupe_facts(facts), notes, signals


def _legal_context_snippets(matches: list[dict[str, Any]], limit: int = 6) -> str:
    lines: list[str] = []
    for m in matches[:limit]:
        prev = _preview(dict(m.get("properties") or {}), 120)
        lab = ",".join(m.get("labels") or [])
        lines.append(f"- [{lab}] {prev}")
    return "\n".join(lines)


def _llm_supplement_facts(
    situation: str,
    case_id: str,
    known_regs: list[str],
    legal_matches: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[str]]:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    notes: list[str] = []
    if not key:
        return [], notes

    allowed_rows = []
    for row in list(extensional_predicates())[:80]:
        pred = str(row.get("predicate") or "").strip()
        if not pred:
            continue
        allowed_rows.append(
            f"- {pred}/{row.get('arity')} :: {row.get('description') or ''} :: {row.get('example') or ''}"
        )
    allowed = "\n".join(allowed_rows)
    ctx = _legal_context_snippets(legal_matches)
    prompt = (
        "You extract candidate compliance facts. Return ONLY a JSON array of "
        'objects {"predicate": str, "args": [str,...]} with no markdown.\n'
        f"Allowed predicates and arities: {allowed}\n"
        f"Known regulations already extracted: {known_regs}\n"
        f"Situation:\n{situation}\n"
        f"Neo4j legal graph snippets (may help):\n{ctx}\n"
        "Add only atoms that are clearly supported by the situation; "
        "do not contradict the situation. If nothing to add, return []."
    )
    payload = json.dumps(
        {
            "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            "messages": [
                {"role": "system", "content": "You output only valid JSON arrays."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        text = data["choices"][0]["message"]["content"].strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        arr = json.loads(text)
        if not isinstance(arr, list):
            notes.append("LLM returned non-array; ignored.")
            return [], notes
        out: list[dict[str, Any]] = []
        for i, item in enumerate(arr):
            if not isinstance(item, dict):
                continue
            p = item.get("predicate")
            a = item.get("args", [])
            if not p or not isinstance(a, list):
                continue
            out.append(_norm_fact_dict(str(p), [str(x) for x in a]))
        notes.append(f"LLM added {len(out)} fact candidate(s).")
        return out, notes
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError) as e:
        notes.append(f"LLM extraction skipped: {type(e).__name__}")
        return [], notes


def propose_scope_facts(
    situation: str,
    legal_matches: list[dict[str, Any]],
    _playbook_matches: list[dict[str, Any]],
    *,
    case_id: str | None = None,
) -> dict[str, Any]:
    """
    Rules + optional LLM. Returns case_id, facts_json, display items, notes.
    """
    case_id = case_id or new_case_id()
    rules_facts, notes, signals = extract_facts_rules(situation, case_id)
    known_regs = sorted(
        {
            str(f["args"][0])
            for f in rules_facts
            if f.get("predicate") in {"regulation"} and f.get("args")
        }
    )
    llm_facts, llm_notes = _llm_supplement_facts(
        situation, case_id, known_regs, legal_matches
    )
    notes.extend(llm_notes)
    merged = _dedupe_facts(rules_facts + llm_facts)

    rules_t = {(f["predicate"], tuple(f["args"])) for f in rules_facts}
    llm_t = {(f["predicate"], tuple(f["args"])) for f in llm_facts}

    items: list[dict[str, Any]] = []
    for i, f in enumerate(merged):
        pred = f["predicate"]
        args = f["args"]
        t = (pred, tuple(args))
        src = "llm" if t in llm_t and t not in rules_t else "rules"
        items.append(
            {
                "id": i,
                "predicate": pred,
                "args": args,
                "human": _human_label(pred, args, case_id),
                "source": src,
            }
        )
    scenario_record = upsert_scenario(
        case_id,
        facts=[
            {
                "predicate": item["predicate"],
                "args": item["args"],
                "source": item["source"],
                "status": "candidate" if item["source"] == "llm" else "extracted",
            }
            for item in items
        ],
    )
    return {
        "case_id": case_id,
        "facts_json": merged,
        "extracted_facts": merged,
        "proposed_fact_items": items,
        "extractor_notes": notes,
        "signals": signals,
        "scenario_record": scenario_record,
    }
