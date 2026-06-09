"""Build product KG from structured intake payload (schema-aligned nodes/edges)."""

from __future__ import annotations

import re
from typing import Any

from logic.kg_schema import graph_edge, graph_node, new_node_id
from logic.predicate_facts import graph_to_predicate_facts
from logic.product_parse import kg_nodes_to_facts

_SUBJECT_LABELS = {
    "customers": "Customers",
    "employees": "Employees",
    "end_users": "End users",
    "job_applicants": "Job applicants",
}


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9_]+", "_", (value or "").lower()).strip("_") or "entity"


def _tri(val: Any) -> str:
    v = str(val or "unknown").strip().lower()
    return v if v in ("yes", "no", "unknown") else "unknown"


def _derive_territorial(intake: dict[str, Any]) -> tuple[str, str]:
    """Infer GDPR / AI Act territorial links from plain-language fields."""
    established = _tri(intake.get("establishedInEu"))
    sells = _tri(intake.get("sellsToEu"))
    markets = [str(m).strip().lower() for m in (intake.get("markets") or [])]
    in_eu_market = any(m in ("eu", "eea") for m in markets)

    gdpr = _tri(intake.get("gdprTerritorialLink"))
    if gdpr == "unknown":
        if established == "yes" or sells == "yes" or in_eu_market:
            gdpr = "yes"
        elif established == "no" and sells == "no" and markets and not in_eu_market:
            gdpr = "no"

    ai_act = _tri(intake.get("aiActTerritorialLink"))
    if ai_act == "unknown":
        if established == "yes" or sells == "yes" or in_eu_market:
            ai_act = "yes"
        elif established == "no" and sells == "no" and markets and not in_eu_market:
            ai_act = "no"

    return gdpr, ai_act


def _enrich_intake_from_narrative(intake: dict[str, Any]) -> dict[str, Any]:
    """Derive structured data/AI signals from free-form intake descriptions."""
    out = dict(intake)
    data = (intake.get("dataFlowDescription") or "").strip()
    ai = (intake.get("aiUsageDescription") or "").strip()

    if data:
        if re.search(r"no personal data|does not (process|collect|store) personal|without personal data|no user data", data, re.I):
            out["processesPersonalData"] = "no"
        elif re.search(
            r"personal data|email|name|address|phone|user data|customer data|employee|biometric|health|cv|resume|applicant|cookie|tracking|gdpr|account|login|profile",
            data,
            re.I,
        ) or len(data) >= 16:
            out["processesPersonalData"] = "yes"

        subjects: list[str] = []
        if re.search(r"\bcustomer", data, re.I):
            subjects.append("customers")
        if re.search(r"\bemployee", data, re.I):
            subjects.append("employees")
        if re.search(r"\b(end user|users)\b", data, re.I):
            subjects.append("end_users")
        if re.search(r"\b(applicant|candidate|hiring|recruit|cv|resume)\b", data, re.I):
            subjects.append("job_applicants")
        if subjects:
            out["dataSubjects"] = subjects
        if re.search(r"health|biometric|special categor", data, re.I):
            out["specialCategoryData"] = "yes"

    if ai:
        if re.search(r"no ai|does not use ai|without (ai|machine learning)|not use (ai|ml)|no machine learning", ai, re.I):
            out["hasAi"] = "no"
        elif re.search(
            r"ai|artificial intelligence|machine learning|ml model|neural|llm|gpt|generative|automated decision|computer vision|chatbot|algorithm|deep learning",
            ai,
            re.I,
        ) or len(ai) >= 16:
            out["hasAi"] = "yes"

        feats: list[str] = []
        if re.search(r"machine learning|ml model|trained model", ai, re.I):
            feats.append("machine_learning")
        if re.search(r"automated decision|scoring|ranking", ai, re.I):
            feats.append("automated_decisions")
        if re.search(r"generative|llm|gpt|chatbot", ai, re.I):
            feats.append("generative_ai")
        if re.search(r"computer vision|image recognition|facial", ai, re.I):
            feats.append("computer_vision")
        if feats:
            out["aiFeatures"] = feats
        if re.search(r"hiring|recruit|credit|loan|law enforcement|biometric ident", ai, re.I):
            out["highRiskAiUse"] = "yes"

    return out


def build_from_intake(intake: dict[str, Any]) -> dict[str, Any]:
    """Emit nodes/edges/spec from frontend ProductIntakePayload."""
    intake = _enrich_intake_from_narrative(intake)
    product_name = (intake.get("productName") or "").strip() or "Unnamed product"
    product_summary = (intake.get("productSummary") or "").strip()
    org_name = (intake.get("organisationName") or "").strip() or "Your organisation"
    case_id = _slug(product_name)

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []

    scenario_id = new_node_id("scn")
    scenario_props: dict[str, Any] = {"case_id": case_id}
    if product_summary:
        scenario_props["summary"] = product_summary
    nodes.append(
        graph_node(
            node_id=scenario_id,
            node_type="Scenario",
            label=product_name,
            properties=scenario_props,
            source="intake",
        )
    )

    anchor_id = scenario_id
    if intake.get("isAnnexIProduct"):
        product_id = new_node_id("prd")
        nodes.append(
            graph_node(
                node_id=product_id,
                node_type="Product",
                label=product_name,
                properties={"summary": product_summary} if product_summary else {},
                source="intake",
            )
        )
        edges.append(
            graph_edge(
                from_id=product_id,
                to_id=scenario_id,
                edge_type="CONTEXT_OF",
                label="context of",
            )
        )
        anchor_id = product_id

    actor_id = new_node_id("act")
    actor_props: dict[str, Any] = {}
    if _tri(intake.get("establishedInEu")) == "yes":
        actor_props["established_in"] = "eu"
    nodes.append(
        graph_node(
            node_id=actor_id,
            node_type="Actor",
            label=org_name,
            properties=actor_props,
            source="intake",
        )
    )

    for role in intake.get("actorRoles") or []:
        role_key = str(role).strip().upper()
        if not role_key:
            continue
        target = scenario_id
        if role_key in ("PROVIDER", "DEPLOYER", "IMPORTER", "DISTRIBUTOR"):
            ai_nodes = [n for n in nodes if n.get("type") == "AISystem"]
            if ai_nodes:
                target = ai_nodes[0]["id"]
        edges.append(
            graph_edge(
                from_id=actor_id,
                to_id=target,
                edge_type=role_key,
                label=role_key.replace("_", " ").lower(),
            )
        )

    if _tri(intake.get("establishedInEu")) == "yes":
        edges.append(
            graph_edge(
                from_id=scenario_id,
                to_id=actor_id,
                edge_type="IN_CONTEXT_OF_ESTABLISHMENT",
                label="establishment context",
            )
        )

    markets = [str(m).strip().lower() for m in (intake.get("markets") or []) if str(m).strip()]
    for market in markets:
        m_id = new_node_id("mkt")
        label = market.upper() if len(market) <= 3 else market.title()
        nodes.append(
            graph_node(
                node_id=m_id,
                node_type="Market",
                label=label,
                properties={"market": market},
                source="intake",
            )
        )
        edges.append(
            graph_edge(
                from_id=anchor_id,
                to_id=m_id,
                edge_type="OPERATES_IN",
                label="operates in",
            )
        )

    gdpr_link, ai_act_link = _derive_territorial(intake)

    if gdpr_link == "yes":
        edges.append(
            graph_edge(
                from_id=actor_id,
                to_id=scenario_id,
                edge_type="GDPR_TERRITORIAL_LINK",
                label="GDPR territorial link",
            )
        )

    if _tri(intake.get("processesPersonalData")) == "yes":
        datum_id = new_node_id("dat")
        datum_props: dict[str, Any] = {"personal_data": "yes", "concerns": "yes"}
        if _tri(intake.get("specialCategoryData")) == "yes":
            datum_props["category"] = "special_category"
        nodes.append(
            graph_node(
                node_id=datum_id,
                node_type="Datum",
                label="Personal data",
                properties=datum_props,
                source="intake",
            )
        )
        edges.append(
            graph_edge(
                from_id=anchor_id,
                to_id=datum_id,
                edge_type="PROCESSES_DATA",
                label="processes data",
            )
        )
        subjects = intake.get("dataSubjects") or ["end_users"]
        for subj in subjects:
            subj_key = str(subj).strip().lower()
            subj_id = new_node_id("act")
            nodes.append(
                graph_node(
                    node_id=subj_id,
                    node_type="Actor",
                    label=_SUBJECT_LABELS.get(subj_key, subj_key.replace("_", " ").title()),
                    properties={"natural_person": "yes"},
                    source="intake",
                )
            )
            edges.append(
                graph_edge(
                    from_id=datum_id,
                    to_id=subj_id,
                    edge_type="CONCERNS",
                    label="concerns",
                )
            )
            edges.append(
                graph_edge(
                    from_id=datum_id,
                    to_id=subj_id,
                    edge_type="IDENTIFIES",
                    label="identifies",
                )
            )

    if _tri(intake.get("hasAi")) == "yes":
        ai_id = new_node_id("ai")
        ai_props: dict[str, Any] = {"has_feature": "machine_based"}
        if _tri(intake.get("highRiskAiUse")) == "yes":
            ai_props["high_risk"] = "yes"
        for feat in intake.get("aiFeatures") or []:
            ai_props.setdefault("capabilities", []).append(str(feat))
        nodes.append(
            graph_node(
                node_id=ai_id,
                node_type="AISystem",
                label=product_name,
                properties=ai_props,
                source="intake",
            )
        )
        edges.append(
            graph_edge(
                from_id=anchor_id,
                to_id=ai_id,
                edge_type="USES_AI",
                label="uses AI",
            )
        )
        if ai_act_link == "yes":
            edges.append(
                graph_edge(
                    from_id=actor_id,
                    to_id=ai_id,
                    edge_type="AI_ACT_TERRITORIAL_LINK",
                    label="AI Act territorial link",
                )
            )
        for role in intake.get("actorRoles") or []:
            role_key = str(role).strip().upper()
            if role_key in ("PROVIDER", "DEPLOYER"):
                edges.append(
                    graph_edge(
                        from_id=actor_id,
                        to_id=ai_id,
                        edge_type=role_key,
                        label=role_key.lower(),
                    )
                )

    eu_link = gdpr_link

    spec = {
        "name": product_name,
        "summary": product_summary or (intake.get("supplementalNote") or "").strip(),
        "markets": [m.upper() if len(m) <= 3 else m.title() for m in markets],
        "processesPersonalData": _tri(intake.get("processesPersonalData")),
        "euLink": eu_link,
        "aiSystem": _tri(intake.get("hasAi")),
    }

    predicate_facts = graph_to_predicate_facts(nodes, edges, case_id=case_id)
    facts = kg_nodes_to_facts(nodes, predicate_facts=predicate_facts)

    return {
        "nodes": nodes,
        "edges": edges,
        "facts": facts,
        "predicate_facts": predicate_facts,
        "spec": spec,
        "name": spec["name"],
        "summary": spec["summary"],
        "markets": spec["markets"],
        "processesPersonalData": spec["processesPersonalData"],
        "euLink": spec["euLink"],
        "aiSystem": spec["aiSystem"],
    }
