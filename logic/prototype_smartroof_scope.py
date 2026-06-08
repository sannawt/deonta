"""
Curated scope assessment for the SmartRoof antenna-kit prototype demo.

Used when PROTOTYPE_MODE=1 and the product description matches the demo text.
"""

from __future__ import annotations

import re
from typing import Any

from logic.llm_scope_assess import catalog_to_instrument_id
from logic.prototype_fast import normalize_description

_SMARTROOF_MARKERS = (
    "smartroof",
    "smart rooftop",
    "rooftop internet antenna",
    "outdoor antenna",
    "wireless broadband",
    "receiver box",
)

_RESULT_MAP = {
    "met": "PASS",
    "pass": "PASS",
    "likely met": "PASS",
    "potentially met": "UNKNOWN",
    "partly met": "UNKNOWN",
    "unclear": "UNKNOWN",
    "staged": "UNKNOWN",
    "future": "UNKNOWN",
    "not indicated": "PASS",
    "not met": "FAIL",
    "fail": "FAIL",
}

_DIM_LABELS = {
    "temporal": "Temporal scope",
    "territorial": "Territorial scope",
    "material": "Material scope",
    "exclusions": "Exclusions",
}


def is_smartroof_demo(description: str) -> bool:
    lower = normalize_description(description)
    return any(m in lower for m in _SMARTROOF_MARKERS)


def _result_code(label: str) -> str:
    key = (label or "").strip().lower()
    key = re.sub(r"\s*/.*$", "", key).strip()
    for prefix, code in _RESULT_MAP.items():
        if key == prefix or key.startswith(prefix + " "):
            return code
    if "met" in key and "unclear" not in key and "partly" not in key:
        return "PASS"
    return "UNKNOWN"


def _dim(dim_id: str, result_label: str, evidence: str) -> dict[str, Any]:
    plain = result_label.strip()
    short = plain.split("/")[0].strip() if "/" in plain else plain
    return {
        "id": dim_id,
        "label": _DIM_LABELS[dim_id],
        "result": _result_code(short),
        "result_display": plain,
        "evidence": evidence.strip(),
        "decisive_facts": [],
        "citations": [],
        "rules_invoked": [],
        "proof_lines": [],
        "llm": {
            "interpretation": evidence.strip(),
            "why_result": f"On these facts, {short.lower()} for {_DIM_LABELS[dim_id].lower()}.",
            "key_facts": [],
        },
    }


def _inst(
    *,
    reg_key: str,
    label: str,
    full_name: str,
    verdict: str,
    verdict_display: str,
    confidence: str,
    summary: str,
    legal_test: dict[str, str],
    dimensions: list[tuple[str, str, str]],
    assessment_source: str = "demo_fixture",
) -> dict[str, Any]:
    inst_id = "RED_CYBER" if reg_key == "red_cyber" else catalog_to_instrument_id(reg_key)
    return {
        "id": inst_id,
        "label": label,
        "full_name": full_name,
        "reg_key": reg_key,
        "verdict": verdict,
        "verdict_display": verdict_display,
        "headline": summary.split(".")[0] + "." if summary else "",
        "llm_summary": summary,
        "risk_category": None,
        "missing_atoms": [],
        "dimensions": [_dim(d, r, e) for d, r, e in dimensions],
        "legal_tests": [legal_test],
        "facts_used": ["SmartRoof outdoor antenna and receiver for wireless broadband"],
        "missing_facts": [],
        "assessment_source": assessment_source,
        "confidence": confidence,
    }


def smartroof_demo_instruments() -> list[dict[str, Any]]:
    """Fifteen curated per-law scope cards for the SmartRoof prototype."""
    return [
        _inst(
            reg_key="red",
            label="RED",
            full_name="Radio equipment / CE marking — RED",
            verdict="applies",
            verdict_display="Indicates in scope",
            confidence="high",
            summary=(
                "SmartRoof includes an outdoor antenna and receiver for wireless broadband. "
                "It appears to be radio equipment placed on the EU market."
            ),
            legal_test={"label": "Is the product radio equipment?", "answer": "yes"},
            dimensions=[
                (
                    "temporal",
                    "Met",
                    "RED is already applicable; exact launch date is still needed for standards and conformity route. "
                    "Refs: RED Art. 1, Arts. 17–21; Recitals on market access and conformity assessment.",
                ),
                (
                    "territorial",
                    "Met",
                    "The product is planned for sale to EU customers. Refs: RED Art. 1; Art. 2 definitions on making available / placing on the market.",
                ),
                (
                    "material",
                    "Met",
                    "The antenna/receiver intentionally transmits or receives radio waves. Refs: RED Art. 2(1); Art. 3(1)–(2).",
                ),
                (
                    "exclusions",
                    "Unclear",
                    "No exclusion is visible, but frequency bands, product category and intended use need confirmation. "
                    "Refs: RED Art. 1(2)–(3); Annex I.",
                ),
            ],
        ),
        _inst(
            reg_key="red_cyber",
            label="RED Cybersecurity",
            full_name="Cybersecurity for connected radio equipment — RED Delegated Regulation 2022/30",
            verdict="applies",
            verdict_display="Indicates in scope",
            confidence="medium",
            summary=(
                "SmartRoof is connected radio equipment with cloud management and remote troubleshooting. "
                "Scope points to RED cybersecurity requirements."
            ),
            legal_test={
                "label": "Is the product internet-connected radio equipment?",
                "answer": "likely yes",
            },
            dimensions=[
                (
                    "temporal",
                    "Met",
                    "RED cybersecurity rules apply from 1 August 2025 to covered radio equipment and are repealed from 11 December 2027 when CRA applies in full. "
                    "Refs: Delegated Reg. 2022/30 Art. 3; RED Art. 3(3)(d)–(f); Delegated Reg. 2026/339 Art. 1.",
                ),
                (
                    "territorial",
                    "Met",
                    "The product is intended for the EU market. Refs: RED Art. 1; Delegated Reg. 2022/30 Art. 1.",
                ),
                (
                    "material",
                    "Met",
                    "The product is radio equipment capable of internet/cloud communication. "
                    "Refs: Delegated Reg. 2022/30 Art. 1; RED Art. 3(3)(d), (e), (f).",
                ),
                (
                    "exclusions",
                    "Unclear",
                    "Need to confirm whether the exact product category is covered or excluded. "
                    "Refs: Delegated Reg. 2022/30 Art. 1(2)–(5); Recitals 1–5.",
                ),
            ],
        ),
        _inst(
            reg_key="cra",
            label="CRA",
            full_name="Cybersecurity by design — Cyber Resilience Act",
            verdict="applies",
            verdict_display="Indicates in scope",
            confidence="high",
            summary=(
                "SmartRoof is hardware plus software with firmware, cloud management and likely remote updates. "
                "It appears to be a product with digital elements."
            ),
            legal_test={"label": "Is this a product with digital elements?", "answer": "yes"},
            dimensions=[
                (
                    "temporal",
                    "Staged",
                    "Reporting duties apply from 11 September 2026 and main obligations from 11 December 2027. "
                    "Refs: CRA Art. 71; Arts. 13–14; Annex I.",
                ),
                (
                    "territorial",
                    "Met",
                    "The product is planned for placement on the EU market. Refs: CRA Art. 2; Art. 3 definitions.",
                ),
                (
                    "material",
                    "Met",
                    "The product contains digital elements: firmware, software, cloud management and remote connectivity. "
                    "Refs: CRA Art. 2; Art. 3; Annex I.",
                ),
                (
                    "exclusions",
                    "Unclear",
                    "No exclusion is visible, but overlap with RED and any sector-specific cybersecurity regime should be checked. "
                    "Refs: CRA Art. 2; Recital 30.",
                ),
            ],
        ),
        _inst(
            reg_key="ai_act",
            label="EU AI Act",
            full_name="AI system classification — EU AI Act",
            verdict="cannot_determine",
            verdict_display="Scope assessment required",
            confidence="medium",
            summary=(
                "SmartRoof uses AI to steer signal direction, avoid interference, predict outages, recommend maintenance and troubleshoot remotely. "
                "This likely triggers AI Act scoping, but high-risk status is not yet determined."
            ),
            legal_test={"label": "Is there an AI system?", "answer": "likely yes"},
            dimensions=[
                (
                    "temporal",
                    "Staged",
                    "Current AI Act timing is staggered under Art. 113. EU 2026 implementation materials indicate high-risk rules apply from 2 December 2027 for Annex III systems and 2 August 2028 for product-embedded Annex I systems. "
                    "Refs: AI Act Art. 113; Digital Omnibus / AI Act implementation timeline.",
                ),
                (
                    "territorial",
                    "Met",
                    "A US company plans to place the AI-enabled product on the EU market. Refs: AI Act Art. 2(1); Art. 3 operator definitions.",
                ),
                (
                    "material",
                    "Partly met",
                    "AI system scoping is likely met; high-risk classification is unresolved. "
                    "Refs: AI Act Art. 3(1); Art. 6(1); Art. 6(2); Annex I; Annex III point 2; Recitals 12, 50, 55.",
                ),
                (
                    "exclusions",
                    "Unclear",
                    "Need to know whether the AI is only performance optimisation or a safety / resilience / critical-infrastructure function. "
                    "Refs: AI Act Art. 6(3)–(4); Art. 3(14); Recital 50.",
                ),
            ],
        ),
        _inst(
            reg_key="data_act",
            label="Data Act",
            full_name="Connected-product data access — EU Data Act",
            verdict="applies",
            verdict_display="Indicates in scope",
            confidence="medium",
            summary=(
                "SmartRoof generates operational data such as signal strength, uptime, interference, diagnostics, firmware version, site location and maintenance alerts. "
                "It appears to be a connected product with a related cloud service."
            ),
            legal_test={"label": "Is this a connected product?", "answer": "likely yes"},
            dimensions=[
                (
                    "temporal",
                    "Met",
                    "The Data Act applies from 12 September 2025; Article 3(1) data-access-by-design applies to connected products placed on the market after 12 September 2026. "
                    "Refs: Data Act Art. 50; Art. 3(1).",
                ),
                (
                    "territorial",
                    "Met",
                    "The product is intended for EU users/customers. Refs: Data Act Art. 1; Art. 2 user/data-holder definitions.",
                ),
                (
                    "material",
                    "Met",
                    "The product appears to generate product data, and the cloud dashboard may be a related service. "
                    "Refs: Data Act Art. 2; Arts. 3–5; Recitals 14–15, 20–21.",
                ),
                (
                    "exclusions",
                    "Unclear",
                    "Need to separate personal data, non-personal data, trade secrets and technically accessible data. "
                    "Refs: Data Act Arts. 4–5; Art. 8; Recitals on trade secrets and data access.",
                ),
            ],
        ),
        _inst(
            reg_key="gdpr",
            label="GDPR",
            full_name="Personal data protection — GDPR",
            verdict="applies",
            verdict_display="Indicates in scope",
            confidence="medium",
            summary=(
                "SmartRoof may process IP/MAC addresses, installation location, operator accounts, technician activity, device logs and network metadata. "
                "These may identify subscribers, households, workers or technicians."
            ),
            legal_test={"label": "Is personal data processed?", "answer": "likely yes"},
            dimensions=[
                (
                    "temporal",
                    "Met",
                    "GDPR has applied since 25 May 2018. Refs: GDPR Art. 99.",
                ),
                (
                    "territorial",
                    "Met",
                    "The product targets EU customers and may process data relating to people in the EU. Refs: GDPR Art. 3(1)–(2); Recitals 22–23.",
                ),
                (
                    "material",
                    "Met",
                    "The facts indicate automated processing of data that may relate to identifiable natural persons. "
                    "Refs: GDPR Art. 2(1); Art. 4(1); Art. 4(2); Recitals 26, 30.",
                ),
                (
                    "exclusions",
                    "Not indicated",
                    "No household-use or law-enforcement exclusion appears. Refs: GDPR Art. 2(2); Recital 18.",
                ),
            ],
        ),
        _inst(
            reg_key="eprivacy",
            label="ePrivacy",
            full_name="Electronic communications privacy — ePrivacy Directive",
            verdict="cannot_determine",
            verdict_display="Needs review",
            confidence="medium",
            summary=(
                "SmartRoof is used by internet providers and may involve traffic data, location data or communications metadata. "
                "It is unclear whether the company itself provides a public electronic communications service or only supplies equipment."
            ),
            legal_test={
                "label": "Is SmartRoof processing traffic or location data for a public communications service?",
                "answer": "unclear",
            },
            dimensions=[
                (
                    "temporal",
                    "Met",
                    "The Directive is implemented through Member State laws. Refs: ePrivacy Art. 15a / national implementation; related national laws.",
                ),
                (
                    "territorial",
                    "Likely met",
                    "EU network use is stated, but national implementation and operator role must be checked. Refs: ePrivacy Art. 3.",
                ),
                (
                    "material",
                    "Unclear",
                    "Depends on whether SmartRoof processes communications, traffic data, location data or terminal-equipment information. "
                    "Refs: ePrivacy Arts. 5, 5(3), 6, 9; Recitals 24, 26.",
                ),
                (
                    "exclusions",
                    "Unclear",
                    "Cannot determine until service role is known. Refs: ePrivacy Art. 3; Art. 15.",
                ),
            ],
        ),
        _inst(
            reg_key="eecc",
            label="EECC",
            full_name="Telecom networks and services — EECC",
            verdict="cannot_determine",
            verdict_display="Needs review",
            confidence="medium",
            summary=(
                "SmartRoof is wireless broadband equipment sold to internet providers. "
                "The EECC may apply directly if the company provides or operates an electronic communications network or service in the EU."
            ),
            legal_test={"label": "Is the company a network/service provider?", "answer": "unclear"},
            dimensions=[
                (
                    "temporal",
                    "Met",
                    "The EECC is implemented through Member State telecom laws. Refs: EECC Art. 124; national implementation laws.",
                ),
                (
                    "territorial",
                    "Potentially met",
                    "EU connectivity use is stated. Refs: EECC Art. 1; Art. 2 definitions.",
                ),
                (
                    "material",
                    "Unclear",
                    "The product supports broadband networks, but the company role is unclear: equipment supplier, managed-service provider or network operator. "
                    "Refs: EECC Art. 2; Art. 12.",
                ),
                (
                    "exclusions",
                    "Unclear",
                    "Cannot assess until the service model and operator role are known. Refs: EECC Art. 2; Recitals 13–16.",
                ),
            ],
        ),
        _inst(
            reg_key="nis2",
            label="NIS2",
            full_name="Critical-sector cybersecurity — NIS2",
            verdict="cannot_determine",
            verdict_display="Needs review",
            confidence="medium",
            summary=(
                "SmartRoof targets telecom operators, hospitals, municipalities, utilities, factories and data centres. "
                "NIS2 may apply directly if SmartRoof provides covered services in the EU, but on current facts it is more likely to appear through customer procurement and supply-chain requirements."
            ),
            legal_test={
                "label": "Is the company itself a NIS2 essential or important entity?",
                "answer": "unclear",
            },
            dimensions=[
                (
                    "temporal",
                    "Met",
                    "NIS2 is in force, but obligations operate through Member State implementation. Refs: NIS2 Arts. 41, 44.",
                ),
                (
                    "territorial",
                    "Potentially met",
                    "EU customers and EU operational use are stated, but establishment and service-provision facts are missing. Refs: NIS2 Art. 2; Art. 26.",
                ),
                (
                    "material",
                    "Unclear",
                    "Customer sectors are relevant, but direct entity classification cannot be concluded. Refs: NIS2 Arts. 2–3; Annexes I–II.",
                ),
                (
                    "exclusions",
                    "Unclear",
                    "Size thresholds, sector category, establishment and service model must be assessed. Refs: NIS2 Art. 2; Art. 3; Recitals 14–18.",
                ),
            ],
        ),
        _inst(
            reg_key="market_surveillance",
            label="MSR",
            full_name="Market surveillance / EU responsible person — Regulation 2019/1020",
            verdict="applies",
            verdict_display="Indicates in scope",
            confidence="high",
            summary=(
                "SmartRoof is a US-made product likely covered by EU harmonised product law, including RED and RoHS. "
                "EU market-surveillance and economic-operator requirements should be checked."
            ),
            legal_test={
                "label": "Is the product subject to EU harmonised product law?",
                "answer": "likely yes",
            },
            dimensions=[
                (
                    "temporal",
                    "Met",
                    "The market-surveillance framework is already applicable. Refs: Regulation 2019/1020 Art. 44.",
                ),
                (
                    "territorial",
                    "Met",
                    "The product is intended for the EU market. Refs: Regulation 2019/1020 Art. 1; Art. 2.",
                ),
                (
                    "material",
                    "Met",
                    "The product appears subject to Union harmonisation legislation, including RED. "
                    "Refs: Regulation 2019/1020 Art. 2; Art. 4; Annex I.",
                ),
                (
                    "exclusions",
                    "Unclear",
                    "Need to identify importer, authorised representative, distributor and fulfilment-service arrangements. "
                    "Refs: Regulation 2019/1020 Arts. 3–4; Recitals 21–22.",
                ),
            ],
        ),
        _inst(
            reg_key="gpsr",
            label="GPSR",
            full_name="General product safety — GPSR",
            verdict="cannot_determine",
            verdict_display="Needs review",
            confidence="medium",
            summary=(
                "SmartRoof is a physical product that may be installed in apartment buildings and other user environments. "
                "GPSR may apply as a residual consumer-safety regime, especially for risks not fully covered by RED or other harmonised laws."
            ),
            legal_test={
                "label": "Is this a consumer product or consumer-accessible product?",
                "answer": "unclear",
            },
            dimensions=[
                (
                    "temporal",
                    "Met",
                    "GPSR applies from 13 December 2024. Refs: GPSR Art. 52.",
                ),
                (
                    "territorial",
                    "Met",
                    "EU market placement is stated. Refs: GPSR Art. 2; Art. 3.",
                ),
                (
                    "material",
                    "Unclear",
                    "The product is physical hardware, but it may be B2B-only and already covered by RED for many risks. "
                    "Refs: GPSR Art. 2; Art. 5; Recitals 8, 10, 13.",
                ),
                (
                    "exclusions",
                    "Unclear",
                    "Specific harmonised laws may displace GPSR for covered risks, but residual consumer risks may remain. "
                    "Refs: GPSR Art. 2(1)–(2).",
                ),
            ],
        ),
        _inst(
            reg_key="product_liability",
            label="PLD",
            full_name="Defective product liability — Product Liability Directive 2024/2853",
            verdict="cannot_determine",
            verdict_display="Needs review",
            confidence="medium",
            summary=(
                "SmartRoof combines hardware, embedded software, AI functions, cloud management and updates. "
                "The new Product Liability Directive is relevant for future liability exposure."
            ),
            legal_test={
                "label": "Is this a product with software/digital components?",
                "answer": "yes",
            },
            dimensions=[
                (
                    "temporal",
                    "Future",
                    "The new Directive applies to products placed on the market or put into service after 9 December 2026. Refs: PLD Art. 2.",
                ),
                (
                    "territorial",
                    "Potentially met",
                    "EU market placement is planned. Refs: PLD Art. 2; Art. 4 economic-operator definitions.",
                ),
                (
                    "material",
                    "Likely met",
                    "The product includes hardware, software and AI-enabled functions. Refs: PLD Art. 4; Art. 7; Recitals 13, 17, 32.",
                ),
                (
                    "exclusions",
                    "Unclear",
                    "Cannot conclude without launch date, product version and economic-operator chain. "
                    "Refs: PLD Art. 2; Art. 8; Recitals 40–41.",
                ),
            ],
        ),
        _inst(
            reg_key="rohs",
            label="RoHS",
            full_name="Hazardous substances in electronics — RoHS",
            verdict="applies",
            verdict_display="Indicates in scope",
            confidence="high",
            summary=(
                "The product is electrical and electronic equipment because it includes an antenna kit, receiver box and embedded electronics. "
                "It therefore falls within the likely scope of RoHS."
            ),
            legal_test={
                "label": "Is the product considered electrical and electronic equipment?",
                "answer": "yes",
            },
            dimensions=[
                (
                    "temporal",
                    "Met",
                    "RoHS is already applicable for covered EEE placed on the EU market. Refs: RoHS Art. 2; Art. 4; Art. 25.",
                ),
                (
                    "territorial",
                    "Met",
                    "The product is planned for EU sale. Refs: RoHS Art. 2; Art. 3 placing/making available definitions.",
                ),
                (
                    "material",
                    "Met",
                    "The antenna, receiver box and embedded electronics are likely EEE. Refs: RoHS Art. 3(1)–(2); Art. 4; Annexes I–II.",
                ),
                (
                    "exclusions",
                    "Unclear",
                    "No exclusion is visible, but category, exemptions and bill of materials must be checked. "
                    "Refs: RoHS Art. 2(4); Annexes III–IV.",
                ),
            ],
        ),
        _inst(
            reg_key="weee",
            label="WEEE",
            full_name="Electronic waste / take-back — WEEE",
            verdict="applies",
            verdict_display="Indicates in scope",
            confidence="high",
            summary=(
                "SmartRoof appears to be electrical and electronic equipment that will eventually become waste equipment. "
                "WEEE producer-registration and take-back scope should be assessed."
            ),
            legal_test={"label": "Is the product EEE placed on the EU market?", "answer": "likely yes"},
            dimensions=[
                (
                    "temporal",
                    "Met",
                    "WEEE is already implemented through Member State laws. Refs: WEEE Art. 2; Art. 24.",
                ),
                (
                    "territorial",
                    "Met",
                    "The product is planned for EU sale. Refs: WEEE Art. 2; Art. 3 producer definition.",
                ),
                (
                    "material",
                    "Met",
                    "The product appears to be EEE within the WEEE framework. Refs: WEEE Art. 3(1)(a); Annexes III–IV.",
                ),
                (
                    "exclusions",
                    "Unclear",
                    "Need B2B/B2C classification, producer identity and Member State take-back route. "
                    "Refs: WEEE Art. 2(3)–(4); Arts. 12–16.",
                ),
            ],
        ),
        _inst(
            reg_key="reach",
            label="REACH",
            full_name="Chemicals / substances in articles — REACH",
            verdict="applies",
            verdict_display="Indicates in scope",
            confidence="medium",
            summary=(
                "SmartRoof is a physical article made of components, plastics, metals, cables, circuit boards and coatings. "
                "REACH is relevant for substances in articles, SVHC communication and restrictions."
            ),
            legal_test={"label": "Is the product an article containing substances?", "answer": "yes"},
            dimensions=[
                (
                    "temporal",
                    "Met",
                    "REACH is already applicable. Refs: REACH Art. 141; Art. 7; Art. 33; Art. 67.",
                ),
                (
                    "territorial",
                    "Met",
                    "The product is planned for EU sale or import. Refs: REACH Art. 1; Art. 3 importer/article definitions.",
                ),
                (
                    "material",
                    "Met",
                    "The product is likely an article; specific duties depend on SVHCs, restricted substances and intended release. "
                    "Refs: REACH Art. 3(3); Art. 7; Art. 33; Art. 67; Annex XVII.",
                ),
                (
                    "exclusions",
                    "Unclear",
                    "No exclusion is visible, but supplier declarations and bill of materials are needed. "
                    "Refs: REACH Art. 2; Art. 7(6); Annex XVII.",
                ),
            ],
        ),
    ]


def demo_instruments_for_description(description: str) -> list[dict[str, Any]] | None:
    if not is_smartroof_demo(description):
        return None
    return smartroof_demo_instruments()


def apply_smartroof_demo_scope(response: dict[str, Any], description: str) -> dict[str, Any]:
    """Replace scope_analysis instruments with curated SmartRoof demo cards."""
    instruments = demo_instruments_for_description(description)
    if not instruments:
        return response

    scope_analysis = {"instruments": instruments, "llm_enriched": True}
    response["scope_analysis"] = scope_analysis
    assessment = response.get("assessment")
    if isinstance(assessment, dict):
        assessment = {**assessment, "scope_analysis": scope_analysis}
        response["assessment"] = assessment
    return response


def demo_scan_extra_rows() -> list[dict[str, Any]]:
    """Extra catalog scan row for RED delegated cybersecurity (demo only)."""
    return [
        {
            "code": "red_cyber",
            "short": "RED Cyber",
            "number": "2022/30",
            "summary": "Cybersecurity for connected radio equipment",
            "keywords": ["red", "cybersecurity", "radio"],
            "description": "RED Delegated Regulation 2022/30 — cybersecurity for connected radio equipment",
            "score": 0.93,
            "reg_id": "catalog:red_cyber",
            "label": "RED Delegated Regulation 2022/30",
            "ui_label": "Cybersecurity for connected radio equipment",
            "legal_instrument": "RED Delegated Regulation 2022/30",
            "catalog_code": "red_cyber",
            "document_tier": "delegated",
            "engine_mode": "retrieval_only",
            "hit_count": 0,
            "match_rationale": "Matched from EU law catalog for your product profile",
            "rank_method": "prototype_catalog",
        }
    ]
