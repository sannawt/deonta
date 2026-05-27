"""
Per-instrument scope analysis for the assessment panel (symbolic data + enrichment).
"""

from __future__ import annotations

import re
from typing import Any

from logic.display_tokens import (
    format_fact_value,
    format_proof_gap_message,
    is_internal_case_id,
    sanitize_atom_display,
)
from logic.legal_links import dedupe_provision_ids, enrich_citation, format_provision_label
from logic.corpus import load_citations

_INSTRUMENT_META = {
    "GDPR": {"id": "GDPR", "label": "GDPR", "reg_key": "gdpr", "full_name": "General Data Protection Regulation"},
    "EU_AI_ACT": {
        "id": "EU_AI_ACT",
        "label": "EU AI Act",
        "reg_key": "ai_act",
        "full_name": "EU Artificial Intelligence Act",
    },
}

_DIM_ORDER = ("temporal", "territorial", "material", "exclusions")

# Predicates shown under each scope gate (avoids listing unrelated "from question" facts).
_DIM_PREDICATES: dict[str, tuple[str, ...]] = {
    "temporal": ("in_force", "active_phase", "temporal"),
    "territorial": (
        "territorial",
        "establishment",
        "market",
        "eu_targeted",
        "processing_in_context_of_establishment",
        "data_subjects_in_eu_targeted",
        "places_on_eu_market",
        "output_used_in_eu",
        "regulation_territorial",
    ),
    "material": (
        "processing",
        "personal_data",
        "concerns",
        "identifies",
        "natural_person",
        "automated_means",
        "has_feature",
        "has_capability",
        "provider",
        "processor",
        "controller",
        "high_risk",
        "processing_concerns",
        "regulation_material",
    ),
    "exclusions": ("exclusion", "excluded", "exempt", "household", "regulation_excluded"),
}


def _pred_matches_dim(predicate: str, dim: str) -> bool:
    p = (predicate or "").lower()
    allowed = _DIM_PREDICATES.get(dim, ())
    return any(token in p for token in allowed)
_DIM_LABELS = {
    "temporal": "Temporal scope",
    "territorial": "Territorial scope",
    "material": "Material scope",
    "exclusions": "Exclusions",
}

_PROV_DIM = {
    "TEMPORAL": "temporal",
    "TERRITORIAL": "territorial",
    "MATERIAL": "material",
    "EXCLUSION": "exclusions",
    "EXCLUSIONS": "exclusions",
}


def _normalize_dim(dim: str) -> str:
    d = (dim or "").strip().lower()
    if d == "exclusion":
        return "exclusions"
    return d


def _result_label(trace_result: str) -> str:
    mapping = {
        "pass": "PASS",
        "fail": "FAIL",
        "cannot_determine": "UNKNOWN",
        "not_reached": "NOT_REACHED",
        "deferred": "DEFERRED",
    }
    return mapping.get(str(trace_result), "UNKNOWN")


def _verdict_display(verdict: str) -> str:
    mapping = {
        "applies": "Indicates in scope",
        "does_not_apply": "Indicates out of scope",
        "cannot_determine": "Cannot conclude yet",
    }
    return mapping.get(verdict, "Cannot conclude yet")


def _catalog_by_plid(rule_catalog: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for prov in rule_catalog:
        plid = str(prov.get("provision_long_id") or "").strip()
        if plid:
            out[plid] = prov
    return out


def _citations_map() -> dict[str, Any]:
    try:
        return load_citations()
    except Exception:
        return {}


def _atom_dimension(atom: str) -> str | None:
    a = (atom or "").lower()
    if any(x in a for x in ("excluded", "exclusion", "household", "purely personal")):
        return "exclusions"
    if any(x in a for x in ("in_force", "active_phase", "temporal", "phase")):
        return "temporal"
    if any(
        x in a
        for x in (
            "territorial",
            "establishment",
            "market",
            "member state",
            "union",
            "controller",
            "processor",
        )
    ):
        return "territorial"
    if any(
        x in a
        for x in (
            "personal_data",
            "ai_system",
            "has_feature",
            "has_capability",
            "processing",
            "high_risk",
            "material",
        )
    ):
        return "material"
    return None


_OPAQUE_ARG_RX = re.compile(r'"[a-z0-9]{10,}"|\b[a-z0-9]{12,}\b', re.I)


def _human_atom(atom: str, *, case_id: str | None = None) -> str:
    s = sanitize_atom_display((atom or "").strip(), case_id=case_id)
    m = re.match(r"^([a-z_]+)\((.*)\)$", s, re.I)
    if not m:
        return s.replace("_", " ")
    pred = m.group(1)
    inner = m.group(2).strip()
    if pred == "regulation_territorial_link":
        return "EU territorial link for this assessment"
    args = [a.strip().strip("\"'") for a in inner.split(",") if a.strip()]
    return format_fact_value(pred, args, case_id=case_id)


def _provenance_lines_for_dim(
    reg_lines: list[dict[str, Any]],
    dim: str,
) -> list[dict[str, Any]]:
    dim_u = dim.upper()
    if dim == "exclusions":
        dim_u = "EXCLUSION"
    out: list[dict[str, Any]] = []
    for line in reg_lines:
        pd = str(line.get("dimension") or "").upper()
        mapped = _PROV_DIM.get(pd, pd.lower())
        if mapped == dim or pd == dim_u:
            out.append(line)
    return out


def _rules_invoked(
    lines: list[dict[str, Any]],
    catalog: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    by_plid: dict[str, dict[str, Any]] = {}
    for line in lines:
        plid = str(line.get("provision_long_id") or "").strip()
        if not plid:
            continue
        if plid in by_plid:
            by_plid[plid]["proof_steps"] = int(by_plid[plid].get("proof_steps", 1)) + 1
            continue
        prov = catalog.get(plid) or {}
        rules = prov.get("rules") or []
        rule0 = rules[0] if rules else {}
        by_plid[plid] = {
            "provision_long_id": plid,
            "citation": enrich_citation(plid, catalog_entry=_citations_map().get(plid) or prov),
            "rule_text": str(rule0.get("rule_text") or line.get("note") or "").strip()[:500],
            "head_atom": str(rule0.get("head_atom") or line.get("atom") or "").strip(),
            "kind": str(line.get("kind") or "derive"),
            "proof_steps": 1,
        }
    return list(by_plid.values())[:8]


def _resolve_cite_id(
    cite: str,
    catalog: dict[str, dict[str, Any]],
    reg_key: str,
) -> str | None:
    c = (cite or "").strip()
    if not c:
        return None
    if c in catalog:
        return c
    if c.startswith("GDPR_") or c.startswith("AIAct_"):
        return c
    # Human label from trace e.g. "Art. 2(1)"
    target = c.lower().replace(" ", "")
    prefix = "GDPR" if reg_key == "gdpr" else "AIAct" if reg_key == "ai_act" else ""
    for plid in catalog:
        if prefix and not plid.startswith(prefix + "_"):
            continue
        label = format_provision_label(plid).lower().replace(" ", "")
        if label == target or label.startswith(target):
            return plid
    return None


def _decisive_facts(
    lines: list[dict[str, Any]],
    missing_atoms: list[str],
    dim: str,
    question_facts: list[dict[str, Any]],
    case_id: str | None = None,
    dim_result: str = "UNKNOWN",
    regulation_label: str = "GDPR",
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    question_labels: set[str] = set()

    for qf in question_facts[:20]:
        pred = str(qf.get("predicate") or "")
        if not _pred_matches_dim(pred, dim):
            continue
        label = str(qf.get("field") or pred or "Fact")
        val = str(qf.get("value") or "")
        if is_internal_case_id(val.split(",")[0].strip()):
            val = format_fact_value(str(qf.get("predicate") or ""), qf.get("args") or [], case_id=case_id)
        key = f"q::{label}::{val}"
        if key in seen:
            continue
        seen.add(key)
        question_labels.add(label.lower())
        out.append(
            {
                "atom": val[:120],
                "kind": "from_question",
                "label": label,
                "note": None,
            }
        )

    for line in lines:
        kind = str(line.get("kind") or "")
        if kind not in ("ground", "derive", "gap"):
            continue
        atom = str(line.get("atom") or "").strip()
        if not atom or atom in seen:
            continue
        if kind == "gap":
            gap_msg = format_proof_gap_message(
                atom=atom,
                engine_note=str(line.get("note") or ""),
                dimension=dim,
                dim_result=dim_result,
                regulation_label=regulation_label,
            )
            if gap_msg is None:
                continue
            label, note = gap_msg
            seen.add(atom)
            out.append({"atom": atom, "kind": "trace_gap", "label": label, "note": note})
            continue
        label = _human_atom(atom, case_id=case_id)
        if "territorial link" in atom.lower() and question_labels:
            continue
        seen.add(atom)
        out.append(
            {
                "atom": atom,
                "kind": kind,
                "label": label,
                "note": str(line.get("note") or "").strip() or None,
            }
        )

    for atom in missing_atoms:
        a = str(atom).strip()
        if not a or a in seen:
            continue
        if _atom_dimension(a) not in (None, dim):
            continue
        seen.add(a)
        out.append(
            {
                "atom": a,
                "kind": "missing",
                "label": _human_atom(a),
                "note": "Required for this scope gate — not yet established on your facts",
            }
        )

    if dim_result == "PASS" and dim == "exclusions" and not any(
        f.get("kind") == "from_question" for f in out
    ):
        out.insert(
            0,
            {
                "atom": "",
                "kind": "summary",
                "label": "No exclusion indicated on your facts",
                "note": (
                    "Nothing you described triggers a GDPR exclusion or carve-out "
                    "(e.g. household-only, pure personal use). The PASS result reflects that."
                ),
            },
        )

    return out[:8]


def _citations_for_dim(
    trace_entry: dict[str, Any],
    lines: list[dict[str, Any]],
    catalog: dict[str, dict[str, Any]],
    cit_map: dict[str, Any],
    reg_key: str,
    exclude_plids: set[str] | None = None,
) -> list[dict[str, Any]]:
    exclude_plids = exclude_plids or set()
    raw: list[str] = []
    for c in trace_entry.get("citations") or []:
        resolved = _resolve_cite_id(str(c).strip(), catalog, reg_key) or str(c).strip()
        if resolved.startswith(("GDPR_", "AIAct_")):
            raw.append(resolved)
    for line in lines:
        plid = str(line.get("provision_long_id") or "").strip()
        if plid:
            raw.append(plid)

    plids = dedupe_provision_ids(raw)
    out: list[dict[str, Any]] = []
    for plid in plids:
        if plid in exclude_plids:
            continue
        prov = catalog.get(plid) or cit_map.get(plid) or {}
        if not isinstance(prov, dict):
            prov = {}
        out.append(enrich_citation(plid, catalog_entry=prov))
    return out[:6]


def build_scope_analysis(
    *,
    applicability_results: dict[str, Any],
    provenance: dict[str, Any],
    rule_catalog: list[dict[str, Any]],
    question_facts: list[dict[str, Any]] | None = None,
    case_id: str | None = None,
) -> dict[str, Any]:
    """Build per-instrument scope analysis from engine outputs."""
    catalog = _catalog_by_plid(rule_catalog)
    cit_map = _citations_map()
    by_reg = provenance.get("by_regulation") or {}
    question_facts = question_facts or []

    instruments: list[dict[str, Any]] = []

    for iid, meta in _INSTRUMENT_META.items():
        res = applicability_results.get(iid)
        if not res:
            continue

        reg_key = meta["reg_key"]
        reg_lines = list(by_reg.get(reg_key) or [])
        trace = res.get("trace") or []
        missing = [str(a) for a in (res.get("missing_atoms") or []) if str(a).strip()]

        dimensions: list[dict[str, Any]] = []
        for dim in _DIM_ORDER:
            trace_entry = next(
                (t for t in trace if _normalize_dim(str(t.get("dimension") or "")) == dim),
                None,
            )
            if not trace_entry:
                continue

            prov_lines = _provenance_lines_for_dim(reg_lines, dim)
            rules_invoked = _rules_invoked(prov_lines, catalog)
            rule_plids = {str(r.get("provision_long_id") or "") for r in rules_invoked}
            dimensions.append(
                {
                    "id": dim,
                    "label": _DIM_LABELS.get(dim, dim.title()),
                    "result": _result_label(str(trace_entry.get("result") or "cannot_determine")),
                    "evidence": str(trace_entry.get("evidence") or trace_entry.get("note") or ""),
                    "predicate": trace_entry.get("predicate"),
                    "citations": _citations_for_dim(
                        trace_entry,
                        prov_lines,
                        catalog,
                        cit_map,
                        reg_key,
                        exclude_plids=rule_plids,
                    ),
                    "decisive_facts": _decisive_facts(
                        prov_lines,
                        missing,
                        dim,
                        question_facts,
                        case_id=case_id,
                        dim_result=_result_label(
                            str(trace_entry.get("result") or "cannot_determine")
                        ),
                        regulation_label=meta["label"],
                    ),
                    "rules_invoked": rules_invoked,
                    "proof_lines": [
                        {
                            "kind": line.get("kind"),
                            "atom": line.get("atom"),
                            "note": line.get("note"),
                            "provision_long_id": line.get("provision_long_id"),
                        }
                        for line in prov_lines[:20]
                    ],
                }
            )

        instruments.append(
            {
                "id": iid,
                "label": meta["label"],
                "full_name": meta["full_name"],
                "reg_key": reg_key,
                "verdict": res.get("verdict"),
                "verdict_display": _verdict_display(str(res.get("verdict") or "")),
                "headline": res.get("headline") or "",
                "risk_category": res.get("risk_category"),
                "missing_atoms": missing,
                "dimensions": dimensions,
            }
        )

    return {"instruments": instruments}
