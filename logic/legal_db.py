"""
Structured legal database catalog and Neo4j access (twin_p-compatible).

v1: static EU law catalog + optional Neo4j connectivity check.
"""

from __future__ import annotations

import os
from typing import Any, Literal

from logic.corpus import load_regulations

EngineMode = Literal["symbolic", "retrieval_only", "planned"]

# EU tech law catalog (expand over time; US = planned)
LAW_CATALOG: tuple[dict[str, str], ...] = (
    {"code": "gdpr", "label": "GDPR", "short": "GDPR", "number": "2016/679"},
    {"code": "ai_act", "label": "EU AI Act", "short": "AI Act", "number": "2024/1689"},
    {"code": "cra", "label": "Cyber Resilience Act (CRA)", "short": "CRA", "number": "2024/2847"},
    {"code": "dora", "label": "DORA", "short": "DORA", "number": "2022/2554"},
    {"code": "nis2", "label": "NIS2", "short": "NIS2", "number": "2022/2555"},
    {"code": "data_act", "label": "EU Data Act", "short": "Data Act", "number": "2023/2854"},
    {"code": "eprivacy", "label": "ePrivacy", "short": "ePrivacy", "number": "2002/58/EC"},
    {"code": "gpsr", "label": "GPSR", "short": "GPSR", "number": "2023/988"},
    {"code": "dma", "label": "DMA", "short": "DMA", "number": "2022/1925"},
    {"code": "dsa", "label": "DSA", "short": "DSA", "number": "2022/2065"},
)

_SYMBOLIC_CODES = frozenset(load_regulations())


def engine_mode_for(code: str) -> EngineMode:
    key = (code or "").strip().lower().replace("-", "_")
    if key in _SYMBOLIC_CODES:
        return "symbolic"
    if key in ("us_ccpa", "us_federal"):
        return "planned"
    return "retrieval_only"


def list_laws() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in LAW_CATALOG:
        code = row["code"]
        out.append(
            {
                **row,
                "engine_mode": engine_mode_for(code),
                "us_module": False,
            }
        )
    out.append(
        {
            "code": "us_bundle",
            "label": "US laws (planned)",
            "short": "US",
            "engine_mode": "planned",
            "us_module": True,
        }
    )
    return out


def law_by_code(code: str) -> dict[str, Any] | None:
    key = (code or "").strip().lower().replace("-", "_")
    for row in list_laws():
        if row["code"] == key:
            return row
    return None


def neo4j_legal_configured() -> bool:
    return bool(
        (os.environ.get("NEO4J_URI") or os.environ.get("NEO4J_LEGAL_URI") or "").strip()
        and (os.environ.get("NEO4J_PASSWORD") or os.environ.get("NEO4J_LEGAL_PASSWORD") or "").strip()
    )


def law_summary_stub(code: str) -> dict[str, Any]:
    """Placeholder summary until twin_p Neo4j queries are wired."""
    law = law_by_code(code)
    if not law:
        return {"code": code, "found": False, "summary": "", "obligations": []}
    mode = law["engine_mode"]
    summary = (
        f"{law['label']} — structured obligations and provision text are loaded from the "
        "legal knowledge graph when Neo4j is configured (twin_p corpus)."
    )
    if mode == "symbolic":
        summary += " Applicability gates for this instrument can be evaluated with the symbolic rules engine."
    elif mode == "retrieval_only":
        summary += " v1 uses legal corpus retrieval; symbolic scope rules for this instrument are not yet in the engine."
    elif mode == "planned":
        summary = "US module is planned; no applicability determination is produced yet."

    obligations = _stub_obligations(law["code"], law["label"])
    return {
        "code": law["code"],
        "label": law["label"],
        "found": True,
        "engine_mode": mode,
        "summary": summary,
        "obligations": obligations,
        "neo4j_configured": neo4j_legal_configured(),
    }


def _stub_obligations(code: str, label: str) -> list[dict[str, Any]]:
    """Minimal obligation rows for law-led UI until graph-backed obligations ship."""
    templates = [
        ("scope", f"Determine whether {label} applies to your context (material and territorial scope)."),
        ("documentation", f"Maintain documentation demonstrating compliance with {label} requirements."),
        ("risk", f"Assess and mitigate risks relevant to {label} obligations."),
    ]
    return [
        {
            "id": f"{code}_{i}",
            "topic": topic,
            "text": text,
            "evidence_hints": [
                "Scope assessment record",
                "Policy or technical documentation",
                "Audit trail / logs",
            ],
        }
        for i, (topic, text) in enumerate(templates)
    ]


def related_laws(code: str, limit: int = 4) -> list[dict[str, str]]:
    """Simple related-law suggestions for law-led workflow."""
    primary = law_by_code(code)
    if not primary:
        return []
    all_codes = [r["code"] for r in LAW_CATALOG if r["code"] != primary["code"]]
    # Prefer symbolic + common bundles
    priority = ["gdpr", "ai_act", "cra", "dora", "nis2"]
    ordered = [c for c in priority if c in all_codes and c != primary["code"]]
    ordered += [c for c in all_codes if c not in ordered]
    return [law_by_code(c) or {"code": c, "label": c} for c in ordered[:limit]]  # type: ignore[misc]


def evidence_pack(obligation_ids: list[str], law_codes: list[str]) -> dict[str, Any]:
    """Build evidence document list from selected obligations."""
    documents: list[dict[str, Any]] = []
    seen: set[str] = set()
    for code in law_codes:
        summary = law_summary_stub(code)
        for ob in summary.get("obligations") or []:
            if obligation_ids and ob["id"] not in obligation_ids:
                continue
            for hint in ob.get("evidence_hints") or []:
                key = f"{code}:{hint}"
                if key in seen:
                    continue
                seen.add(key)
                documents.append(
                    {
                        "law": summary.get("label") or code,
                        "obligation_id": ob["id"],
                        "obligation_topic": ob.get("topic"),
                        "document": hint,
                    }
                )
    related = []
    for code in law_codes[:1]:
        related = related_laws(code)
    return {"documents": documents, "related_laws": related}
