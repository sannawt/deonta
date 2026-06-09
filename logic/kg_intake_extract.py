"""Extract ProductIntakeState fields from uploaded documents (rules + optional LLM)."""

from __future__ import annotations

import json
import re
from typing import Any

from logic.fact_extractor import (
    _AI,
    _EMPLOYMENT,
    _ESTABLISHMENT,
    _EU,
    _PERSONAL,
    _PROCESSING,
    _PROVIDER,
)
from logic.product_parse import extract_product_name, extract_text_from_bytes

_TRI = frozenset({"yes", "no", "unknown"})

_INTAKE_KEYS = (
    "productName",
    "productSummary",
    "organisationName",
    "isAnnexIProduct",
    "actorRoles",
    "markets",
    "establishedInEu",
    "sellsToEu",
    "processesPersonalData",
    "dataSubjects",
    "hasAi",
    "aiFeatures",
    "specialCategoryData",
    "highRiskAiUse",
    "dataFlowDescription",
    "aiUsageDescription",
    "supplementalNote",
)


def _guess_doc_type(filename: str) -> str:
    lower = (filename or "").lower()
    if "privacy" in lower:
        return "privacy_policy"
    if any(x in lower for x in ("spec", "technical", "product")):
        return "product_spec"
    if "dpa" in lower or "processing" in lower:
        return "dpa"
    if "terms" in lower:
        return "terms_of_service"
    return "document"


def _tri_from_bool(yes: bool, no: bool) -> str:
    if yes:
        return "yes"
    if no:
        return "no"
    return "unknown"


def _markets_from_text(text: str) -> list[str]:
    found: list[str] = []
    for m in re.finditer(r"\b(EU|EEA|UK|US)\b", text, re.I):
        key = m.group(1).lower()
        if key == "eu" and "eu" not in found:
            found.append("eu")
        elif key == "eea" and "eea" not in found:
            found.append("eea")
        elif key == "uk" and "uk" not in found:
            found.append("uk")
        elif key == "us" and "us" not in found:
            found.append("us")
    return found


def _roles_from_text(text: str) -> list[str]:
    roles: list[str] = []
    patterns = (
        (r"\bcontroller\b", "CONTROLLER"),
        (r"\bprocessor\b", "PROCESSOR"),
        (r"\bprovider\b", "PROVIDER"),
        (r"\bdeployer\b", "DEPLOYER"),
        (r"\bimporter\b", "IMPORTER"),
        (r"\bdistributor\b", "DISTRIBUTOR"),
    )
    for pat, role in patterns:
        if re.search(pat, text, re.I):
            roles.append(role)
    if not roles and _PROVIDER.search(text):
        roles.append("PROVIDER")
    return roles


def _subjects_from_text(text: str) -> list[str]:
    subjects: list[str] = []
    if re.search(r"\bcustomer", text, re.I):
        subjects.append("customers")
    if _EMPLOYMENT.search(text):
        subjects.append("employees")
    if re.search(r"\bjob applicant|\bapplicant|\brecruit", text, re.I):
        subjects.append("job_applicants")
    if re.search(r"\bend user|\buser data|\bwebsite visitor", text, re.I):
        subjects.append("end_users")
    return subjects


def _ai_features_from_text(text: str) -> list[str]:
    feats: list[str] = []
    if re.search(r"machine learning|\bml\b|trained model", text, re.I):
        feats.append("machine_learning")
    if re.search(r"automated decision|profiling", text, re.I):
        feats.append("automated_decisions")
    if re.search(r"generative|\bllm\b|language model|gpt", text, re.I):
        feats.append("generative_ai")
    if re.search(r"computer vision|image recognition|facial", text, re.I):
        feats.append("computer_vision")
    return feats


def _extract_intake_rules(text: str, default_source: str) -> tuple[dict[str, Any], dict[str, str]]:
    raw = (text or "").strip()
    intake: dict[str, Any] = {}
    sources: dict[str, str] = {}
    if not raw:
        return intake, sources

    name = extract_product_name(raw)
    if name:
        intake["productName"] = name
        sources["productName"] = default_source

    summary_lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    if summary_lines:
        summary = " ".join(summary_lines[:3])[:400]
        if summary and len(summary) > 20:
            intake["productSummary"] = summary
            sources["productSummary"] = default_source

    org = re.search(
        r"(?:we are|company name|organisation|organization)[:\s]+([A-Z][A-Za-z0-9 &.-]{2,60})",
        raw,
        re.I,
    )
    if org:
        intake["organisationName"] = org.group(1).strip()
        sources["organisationName"] = default_source

    markets = _markets_from_text(raw)
    if markets:
        intake["markets"] = markets
        sources["markets"] = default_source

    established = _tri_from_bool(bool(_ESTABLISHMENT.search(raw) and _EU.search(raw)), False)
    if established != "unknown":
        intake["establishedInEu"] = established
        sources["establishedInEu"] = default_source

    sells_eu = _tri_from_bool(bool(_EU.search(raw)), False)
    if sells_eu != "unknown":
        intake["sellsToEu"] = sells_eu
        sources["sellsToEu"] = default_source

    personal = _tri_from_bool(bool(_PERSONAL.search(raw)), bool(re.search(r"no personal data|does not process personal", raw, re.I)))
    if personal != "unknown":
        intake["processesPersonalData"] = personal
        sources["processesPersonalData"] = default_source

    subjects = _subjects_from_text(raw)
    if subjects:
        intake["dataSubjects"] = subjects
        sources["dataSubjects"] = default_source

    if re.search(r"special categor|health data|biometric|Art\.?\s*9", raw, re.I):
        intake["specialCategoryData"] = "yes"
        sources["specialCategoryData"] = default_source

    ai = _tri_from_bool(bool(_AI.search(raw)), bool(re.search(r"no ai|does not use ai|without ai", raw, re.I)))
    if ai != "unknown":
        intake["hasAi"] = ai
        sources["hasAi"] = default_source

    ai_feats = _ai_features_from_text(raw)
    if ai_feats:
        intake["aiFeatures"] = ai_feats
        sources["aiFeatures"] = default_source

    if re.search(r"high.risk|credit scoring|hiring|recruitment|law enforcement|biometric identification", raw, re.I):
        intake["highRiskAiUse"] = "yes"
        sources["highRiskAiUse"] = default_source

    roles = _roles_from_text(raw)
    if roles:
        intake["actorRoles"] = roles
        sources["actorRoles"] = default_source

    if _PROCESSING.search(raw):
        intake.setdefault("processesPersonalData", "yes")

    return intake, sources


def _extract_intake_llm(text: str) -> dict[str, Any] | None:
    if len(text) < 80:
        return None
    try:
        from logic.openai_client import chat_completion, openai_configured

        if not openai_configured():
            return None

        prompt = (
            "Extract product intake JSON with keys: "
            "productName, productSummary, organisationName, actorRoles (array of CONTROLLER|PROCESSOR|PROVIDER|DEPLOYER), "
            "markets (array: eu|eea|uk|us), establishedInEu, sellsToEu, processesPersonalData, "
            "dataSubjects (customers|employees|end_users|job_applicants), hasAi, aiFeatures "
            "(machine_learning|automated_decisions|generative_ai|computer_vision), "
            "specialCategoryData, highRiskAiUse — each yes/no/unknown except arrays. "
            "Use unknown when not stated.\n\nDocument:\n" + text[:8000]
        )
        content = chat_completion(
            messages=[{"role": "user", "content": prompt}],
            json_object=True,
            timeout=45,
        )
        if not content:
            return None
        data = json.loads(content)
        return data if isinstance(data, dict) else None
    except Exception:  # noqa: BLE001
        return None


def _is_empty(val: Any) -> bool:
    if val is None:
        return True
    if isinstance(val, str):
        return not val.strip() or val.strip().lower() == "unknown"
    if isinstance(val, list):
        return len(val) == 0
    if isinstance(val, bool):
        return False
    return False


def merge_intake(
    manual: dict[str, Any] | None,
    extracted: dict[str, Any] | None,
    *,
    extracted_sources: dict[str, str] | None = None,
) -> tuple[dict[str, Any], dict[str, str]]:
    """Manual field values beat extracted; track provenance for prefilled fields."""
    out: dict[str, Any] = dict(extracted or {})
    sources: dict[str, str] = dict(extracted_sources or {})
    manual = manual or {}

    for key in _INTAKE_KEYS:
        mval = manual.get(key)
        if not _is_empty(mval):
            out[key] = mval
            sources.pop(key, None)
        elif key in out and not _is_empty(out.get(key)):
            sources.setdefault(key, sources.get(key) or "document")

    return out, sources


def extract_intake_from_documents(
    files: list[tuple[str, bytes]],
    *,
    use_llm: bool = True,
) -> dict[str, Any]:
    """Return partial intake + field_sources from uploaded files."""
    combined_parts: list[str] = []
    primary_source = "document"
    for filename, data in files:
        text = extract_text_from_bytes(filename, data)
        if not text.strip():
            continue
        combined_parts.append(text)
        primary_source = _guess_doc_type(filename)

    combined = "\n\n".join(combined_parts)
    intake, field_sources = _extract_intake_rules(combined, primary_source)

    if use_llm:
        llm = _extract_intake_llm(combined)
        if llm:
            for key in _INTAKE_KEYS:
                val = llm.get(key)
                if _is_empty(intake.get(key)) and not _is_empty(val):
                    if key in ("establishedInEu", "sellsToEu", "processesPersonalData", "hasAi", "specialCategoryData", "highRiskAiUse"):
                        v = str(val).lower()
                        intake[key] = v if v in _TRI else "unknown"
                    else:
                        intake[key] = val
                    field_sources[key] = primary_source

    return {"intake": intake, "field_sources": field_sources}
