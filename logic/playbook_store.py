"""
Company playbook retrieval from Neo4j (multi-tenant graph: Vaisala_, Iloq_, Atlascopco_).
"""

from __future__ import annotations

import json
import re
from typing import Any, Callable, Optional

# Known tenants in the playbook Aura instance (label prefix on nodes).
PLAYBOOK_COMPANIES: tuple[dict[str, str], ...] = (
    {"id": "vaisala", "label": "Vaisala", "prefix": "Vaisala"},
    {"id": "iloq", "label": "Iloq", "prefix": "Iloq"},
    {"id": "atlascopco", "label": "Atlas Copco", "prefix": "Atlascopco"},
)

PLAYBOOK_DISPLAY_CAP = 8

_GEO_TERMS = frozenset(
    {
        "eu",
        "europe",
        "finland",
        "sweden",
        "germany",
        "france",
        "uk",
        "united",
        "kingdom",
        "global",
        "market",
        "country",
        "jurisdiction",
        "territorial",
        "worldwide",
        "international",
    }
)

_HIGH_VALUE_LABELS = frozenset(
    {
        "PersonalData",
        "AISystem",
        "NaturalPerson",
        "SpecialCategoryData",
        "BiometricData",
        "WorkerIdentityData",
    }
)

_PLAYBOOK_FETCH_CYPHER = """
MATCH (n)
WHERE any(l IN labels(n) WHERE l STARTS WITH $prefix)
RETURN labels(n) AS labels, elementId(n) AS id, properties(n) AS props
LIMIT $limit
"""


def filter_playbook_terms(terms: list[str]) -> list[str]:
    """Stricter terms for playbook matching (min length 3, drop very short tokens)."""
    out: list[str] = []
    for t in terms:
        t = (t or "").strip().lower()
        if len(t) < 3:
            continue
        if t in ("the", "and", "for", "are", "but", "not", "you", "all", "can", "via", "per"):
            continue
        if t not in out:
            out.append(t)
    return out[:12]


def company_by_id(company_id: str | None) -> dict[str, str] | None:
    if not company_id:
        return None
    key = company_id.strip().lower()
    for row in PLAYBOOK_COMPANIES:
        if row["id"] == key or row["prefix"].lower() == key:
            return row
    return None


def list_playbook_companies() -> list[dict[str, str]]:
    return [dict(row) for row in PLAYBOOK_COMPANIES]


def _props_text(props: dict[str, Any]) -> str:
    try:
        return json.dumps(props, default=str).lower()
    except TypeError:
        return str(props).lower()


def _term_hits(blob: str, terms: list[str]) -> int:
    return sum(1 for t in terms if t in blob)


def _is_jurisdiction_node(labels: list[str], prefix: str) -> bool:
    return any(str(l) == f"{prefix}_Jurisdiction" for l in labels)


def _score_node(
    node: dict[str, Any],
    terms: list[str],
    *,
    prefix: str,
    question_blob: str,
    missing_atoms: list[str],
) -> float:
    props = node.get("properties") or {}
    labels = [str(l) for l in (node.get("labels") or [])]
    blob = _props_text(props)
    label_blob = " ".join(labels).lower()
    full = f"{label_blob} {blob}"

    hits = _term_hits(full, terms)
    if hits == 0 and terms:
        return -1.0

    score = float(hits) * 2.0

    short = _primary_label(labels, prefix)
    if short in _HIGH_VALUE_LABELS:
        score += 6.0
    if props.get("is_ai_system") is True:
        score += 5.0
    if short == "Product":
        score += 3.0

    # High-value field single hit
    name = str(props.get("name") or props.get("title") or "").lower()
    if name and any(t in name for t in terms):
        score += 4.0

    if _is_jurisdiction_node(labels, prefix):
        if not any(g in question_blob for g in _GEO_TERMS):
            score -= 8.0
        else:
            score += 1.0

    # Require 2+ hits unless high-value label or name match
    if hits < 2 and short not in _HIGH_VALUE_LABELS and not (
        name and any(t in name for t in terms)
    ):
        score -= 3.0

    # Link to missing atoms / material scope
    atom_blob = " ".join(missing_atoms).lower()
    if atom_blob:
        if "ai" in atom_blob and (props.get("is_ai_system") or "aisystem" in label_blob.lower()):
            score += 4.0
        if "personal" in atom_blob and "personaldata" in label_blob.lower().replace("_", ""):
            score += 4.0
        if "processing" in atom_blob and short in ("Product", "PersonalData"):
            score += 2.0

    return score


def _relevance_tier(score: float, used_in_analysis: bool) -> str:
    if used_in_analysis:
        return "used"
    if score >= 8.0:
        return "related"
    return "background"


def _primary_label(labels: list[str], prefix: str) -> str:
    for lbl in labels:
        if lbl.startswith(prefix + "_") and not lbl.endswith("_Company"):
            return lbl[len(prefix) + 1 :]
    for lbl in labels:
        if lbl.startswith(prefix + "_"):
            return lbl[len(prefix) + 1 :]
    return labels[0] if labels else "Fact"


def _format_value(props: dict[str, Any]) -> str:
    parts: list[str] = []
    name = props.get("name") or props.get("title")
    if name:
        parts.append(str(name))
    if props.get("is_ai_system") is True:
        parts.append("AI system")
    elif props.get("is_ai_system") is False:
        parts.append("not an AI system")
    for key in ("sector", "relationship_to_main", "software_tools", "customer_types"):
        val = props.get(key)
        if val is None or val == "":
            continue
        if isinstance(val, list):
            parts.append(f"{key}: {', '.join(str(x) for x in val[:6])}")
        else:
            parts.append(f"{key}: {val}")
    features = props.get("features") or props.get("capabilities")
    if isinstance(features, list) and features:
        parts.append("features: " + ", ".join(str(x) for x in features[:5]))
    elif isinstance(features, str) and features:
        parts.append(f"features: {features}")
    if not parts:
        for k, v in list(props.items())[:4]:
            if isinstance(v, (list, dict)):
                continue
            parts.append(f"{k}={v}")
    return "; ".join(parts) if parts else "—"


def fetch_playbook_matches(
    *,
    driver: Any,
    database: str,
    company_id: str,
    terms: list[str],
    limit: int = 120,
    record_to_dict_fn: Callable[[dict[str, Any]], dict[str, Any]],
) -> list[dict[str, Any]]:
    """Fetch playbook nodes for one company prefix (broad pool for ranking)."""
    company = company_by_id(company_id)
    if not company:
        return []

    prefix = company["prefix"]
    terms_l = filter_playbook_terms(terms)

    with driver.session(database=database) as session:
        rows = session.run(
            _PLAYBOOK_FETCH_CYPHER,
            prefix=prefix,
            limit=limit,
        )
        raw = [r.data() for r in rows]

    nodes = [record_to_dict_fn(row) for row in raw]
    if terms_l:
        nodes = [n for n in nodes if _term_hits(_props_text(n.get("properties") or {}), terms_l) > 0]
    return nodes


def rank_playbook_for_display(
    matches: list[dict[str, Any]],
    *,
    company_id: str,
    terms: list[str],
    question: str = "",
    missing_atoms: list[str] | None = None,
    display_cap: int = PLAYBOOK_DISPLAY_CAP,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Return (primary_rows, extended_rows) for UI.
    primary_rows capped at display_cap with relevance tiers.
    """
    company = company_by_id(company_id)
    prefix = (company or {}).get("prefix") or ""
    terms_l = filter_playbook_terms(terms)
    question_blob = (question or "").lower()
    missing = list(missing_atoms or [])

    scored: list[tuple[float, dict[str, Any], dict[str, Any]]] = []
    seen: set[str] = set()

    for node in matches:
        labels = node.get("labels") or []
        if any(str(l).endswith("_Company") for l in labels):
            continue
        props = node.get("properties") or {}
        score = _score_node(
            node,
            terms_l,
            prefix=prefix,
            question_blob=question_blob,
            missing_atoms=missing,
        )
        if score < 0:
            continue

        short = _primary_label([str(l) for l in labels], prefix)
        field = re.sub(r"([a-z])([A-Z])", r"\1 \2", short).replace("_", " ").strip()
        value = _format_value(props)
        dedupe = f"{field}::{value}".lower()
        if dedupe in seen:
            continue
        seen.add(dedupe)

        used = score >= 10.0 and (
            short in _HIGH_VALUE_LABELS or props.get("is_ai_system") is True
        )
        tier = _relevance_tier(score, used)
        row = {
            "field": field,
            "value": value,
            "source": "playbook",
            "relevance": tier,
            "playbook_node_id": node.get("id"),
            "playbook_labels": labels,
            "_score": score,
        }
        scored.append((score, node, row))

    scored.sort(key=lambda x: x[0], reverse=True)
    all_rows = [r[2] for r in scored]
    for r in all_rows:
        r.pop("_score", None)

    primary = all_rows[:display_cap]
    extended = all_rows[display_cap:]
    return primary, extended


def playbook_nodes_to_fact_rows(
    matches: list[dict[str, Any]], *, company_id: str
) -> list[dict[str, Any]]:
    """Legacy: convert all matches to rows (prefer rank_playbook_for_display)."""
    company = company_by_id(company_id)
    prefix = (company or {}).get("prefix") or ""
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()

    for node in matches:
        labels = node.get("labels") or []
        if any(str(l).endswith("_Company") for l in labels):
            continue
        props = node.get("properties") or {}
        short = _primary_label([str(l) for l in labels], prefix)
        field = re.sub(r"([a-z])([A-Z])", r"\1 \2", short).replace("_", " ").strip()
        value = _format_value(props)
        dedupe = f"{field}::{value}".lower()
        if dedupe in seen:
            continue
        seen.add(dedupe)
        rows.append(
            {
                "field": field,
                "value": value,
                "source": "playbook",
                "relevance": "related",
                "playbook_node_id": node.get("id"),
                "playbook_labels": labels,
            }
        )
    return rows


def summarize_playbook_capabilities(company_id: str) -> dict[str, Any]:
    company = company_by_id(company_id)
    if not company:
        return {}
    return {
        "id": company["id"],
        "label": company["label"],
        "prefix": company["prefix"],
        "node_families": [
            "Company",
            "Product",
            "Jurisdiction",
            "PersonalData",
            "AISystem",
            "NaturalPerson",
            "LegalObject",
        ],
    }
