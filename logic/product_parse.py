"""Parse product description and documents into KG nodes and compatibility facts."""

from __future__ import annotations

import io
import re
from typing import Any, BinaryIO

from logic.fact_extractor import _AI, _PERSONAL, _PROCESSING, _PROVIDER

# Territorial nexus only — selling *to* EU customers is not enough for euLink=yes.
_EU_TERRITORIAL_LINK = re.compile(
    r"\b(?:established|based|located|headquartered|operat(?:e|ing)|process(?:es|ing)?)\s+"
    r"(?:data\s+)?in\s+(?:the\s+)?(?:EU|EEA|European Union)\b"
    r"|(?:EU|EEA)\s+(?:establishment|branch|office|subsidiary)\b"
    r"|in\s+the\s+(?:EU|EEA)\s+(?:as\s+)?(?:a\s+)?(?:controller|processor|provider)\b",
    re.I,
)
from logic.kg_schema import graph_edge, graph_node, new_node_id
from logic.predicate_facts import graph_to_predicate_facts

_MARKET_RE = re.compile(
    r"\b(EU|US|UK|EEA|Finland|Germany|France|global|worldwide)\b",
    re.I,
)
_NAME_STOPWORDS = frozenset(
    {
        "eu", "us", "uk", "eea", "ai", "hr", "api", "gdpr", "saas", "the", "and", "for",
        "that", "this", "with", "have", "uses", "using", "our", "my", "your",
        "product", "service", "platform", "app", "tool", "system", "software",
    }
)

_NAME_PATTERNS: list[tuple[re.Pattern[str], int]] = [
    # "it's called CVSCAN", "its call CVSCAN", "named Foo"
    (
        re.compile(
            r"(?:it'?s|its)\s+(?:call(?:ed)?|name(?:d)?)\s+[\"']?"
            r"([A-Za-z][A-Za-z0-9][\w.-]{0,38})[\"']?",
            re.I,
        ),
        1,
    ),
    (
        re.compile(
            r"(?:called|named|known\s+as)\s+[\"']?"
            r"([A-Za-z][A-Za-z0-9][\w.-]{0,38})[\"']?",
            re.I,
        ),
        1,
    ),
    (
        re.compile(
            r"(?:product|service|platform|app|application|tool)\s+"
            r"(?:name\s+is|called|named)\s+[\"']?"
            r"([A-Za-z][A-Za-z0-9][\w.-]{0,38})[\"']?",
            re.I,
        ),
        1,
    ),
    (re.compile(r"[«\"']([^\"'\n]{2,40})[»\"']"), 1),
    (re.compile(r"(?:my|our)\s+([A-Za-z][A-Za-z0-9][\w.-]{0,38})\s+(?:product|service|platform|app)\b", re.I), 1),
    (re.compile(r"\b([A-Z][A-Z0-9]{2,17})\b"), 1),  # CVSCAN (min 3 chars; skips "AI")
]


def _clean_product_name(candidate: str) -> str:
    name = (candidate or "").strip().strip("\"'«».,;:")
    if not name or len(name) < 2:
        return ""
    if name.lower() in _NAME_STOPWORDS:
        return ""
    if len(name.split()) > 4:
        return ""
    return name[:80]


def extract_product_name(text: str) -> str:
    """Best-effort product name from free-text description."""
    raw = (text or "").strip()
    if not raw:
        return ""

    for pattern, group in _NAME_PATTERNS:
        for m in pattern.finditer(raw):
            name = _clean_product_name(m.group(group))
            if name:
                return name

    # "Name: Foo" / "Product - Foo"
    legacy = re.search(
        r"(?:product(?:\s+name)?|name)\s*[:\-]\s*[\"']?([^\"'\n.,;]{2,40})",
        raw,
        re.I,
    )
    if legacy:
        name = _clean_product_name(legacy.group(1))
        if name:
            return name

    # Short opener: "CVSCAN screens CVs" — leading proper noun / brand token
    opener = re.match(
        r"^[\"']?([A-Za-z][A-Za-z0-9][\w.-]{1,30})[\"']?\s+(?:is|helps|lets|screens|scans|processes)\b",
        raw,
        re.I,
    )
    if opener:
        name = _clean_product_name(opener.group(1))
        if name:
            return name

    # Only use first line if it is a short label, not a full sentence
    first = raw.split("\n")[0].strip()
    words = first.split()
    if 1 <= len(words) <= 4 and not first.endswith((".", "!", "?")):
        name = _clean_product_name(first)
        if name:
            return name

    return ""


def extract_text_from_bytes(filename: str, data: bytes) -> str:
    lower = filename.lower()
    if lower.endswith(".txt") or lower.endswith(".md"):
        return data.decode("utf-8", errors="replace")
    if lower.endswith(".pdf"):
        try:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(data))
            return "\n".join((p.extract_text() or "") for p in reader.pages)
        except Exception:  # noqa: BLE001
            return ""
    if lower.endswith(".docx"):
        try:
            import docx

            doc = docx.Document(io.BytesIO(data))
            return "\n".join(p.text for p in doc.paragraphs if p.text)
        except Exception:  # noqa: BLE001
            return ""
    return data.decode("utf-8", errors="replace")


def _signal_from_text(text: str, pattern: re.Pattern[str]) -> str:
    if pattern.search(text):
        return "yes"
    return "unknown"


def parse_description(text: str) -> dict[str, Any]:
    """Rule-based parse of free-text product description."""
    raw = (text or "").strip()
    name = extract_product_name(raw)

    markets = list(
        {
            m.group(0).upper()
            if m.group(0).upper() in ("EU", "US", "UK", "EEA")
            else m.group(0)
            for m in _MARKET_RE.finditer(raw)
        }
    )

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []

    product_id = new_node_id("pr")
    product_label = name or "Your product"
    product_node = graph_node(
        node_id=product_id,
        node_type="Product",
        label=product_label,
        properties={"description": raw[:4000]},
        source="parse",
    )
    nodes.append(product_node)

    org_id = new_node_id("ac")
    org_props: dict[str, Any] = {}
    if _PROVIDER.search(raw):
        org_props["provider"] = "yes"
    nodes.append(
        graph_node(
            node_id=org_id,
            node_type="Actor",
            label="Your organisation",
            properties=org_props,
            source="parse",
        )
    )
    edges.append(graph_edge(from_id=org_id, to_id=product_id, edge_type="PARTICIPATES_IN"))

    for market in markets[:8]:
        mid = new_node_id("mk")
        nodes.append(
            graph_node(
                node_id=mid,
                node_type="Market",
                label=market,
                source="parse",
            )
        )
        edges.append(graph_edge(from_id=product_id, to_id=mid, edge_type="OPERATES_IN"))

    personal_signal = _signal_from_text(raw, _PERSONAL)
    processing_signal = "yes" if _PROCESSING.search(raw) else "unknown"
    if personal_signal == "yes" or processing_signal == "yes":
        did = new_node_id("dt")
        datum_props: dict[str, Any] = {"personal_data": personal_signal}
        if processing_signal == "yes":
            datum_props["processing"] = "yes"
        nodes.append(
            graph_node(
                node_id=did,
                node_type="Datum",
                label="Operational or personal data",
                properties=datum_props,
                source="parse",
            )
        )
        edges.append(graph_edge(from_id=product_id, to_id=did, edge_type="PROCESSES_DATA"))
        person_id = new_node_id("ps")
        if personal_signal == "yes":
            nodes.append(
                graph_node(
                    node_id=person_id,
                    node_type="Actor",
                    label="Data subject",
                    properties={"natural_person": "yes"},
                    source="parse",
                )
            )
            edges.append(graph_edge(from_id=did, to_id=person_id, edge_type="CONCERNS"))

    if _AI.search(raw):
        aid = new_node_id("ai")
        ai_props: dict[str, Any] = {"has_feature": "machine_based"}
        if _PROVIDER.search(raw):
            ai_props["provider"] = "yes"
        nodes.append(
            graph_node(
                node_id=aid,
                node_type="AISystem",
                label="AI system",
                properties=ai_props,
                source="parse",
            )
        )
        edges.append(graph_edge(from_id=product_id, to_id=aid, edge_type="USES_AI"))
        if _PROVIDER.search(raw):
            edges.append(graph_edge(from_id=org_id, to_id=aid, edge_type="ACTS_AS"))

    if processing_signal == "yes":
        product_node.setdefault("properties", {})["processing"] = "yes"
    if _AI.search(raw) or _PROCESSING.search(raw):
        product_node.setdefault("properties", {})["automated_means"] = "yes"

    predicate_facts = graph_to_predicate_facts(nodes, edges, case_id=product_id)
    facts = kg_nodes_to_facts(nodes, predicate_facts=predicate_facts)
    eu_link = "yes" if _EU_TERRITORIAL_LINK.search(raw) else "unknown"
    return {
        "name": name,
        "summary": raw,
        "markets": markets,
        "processesPersonalData": personal_signal,
        "euLink": eu_link,
        "aiSystem": _signal_from_text(raw, _AI),
        "nodes": nodes,
        "edges": edges,
        "facts": facts,
    }


def parse_documents(files: list[tuple[str, bytes]]) -> dict[str, Any]:
    """Merge text from uploaded files into one parse pass."""
    chunks: list[str] = []
    doc_nodes: list[dict[str, Any]] = []
    for filename, data in files:
        text = extract_text_from_bytes(filename, data)
        if text.strip():
            chunks.append(text)
        doc_nodes.append(
            graph_node(
                node_type="Document",
                label=filename,
                properties={"chars": len(text)},
                source="parse",
            )
        )
    combined = "\n\n".join(chunks)
    parsed = parse_description(combined)
    product_id = None
    for n in parsed.get("nodes") or []:
        if n.get("type") in ("Product", "Scenario"):
            product_id = n.get("id")
            break
    for dn in doc_nodes:
        parsed.setdefault("nodes", []).append(dn)
        if product_id:
            parsed.setdefault("edges", []).append(
                graph_edge(from_id=product_id, to_id=dn["id"], edge_type="DESCRIBED_BY")
            )
    parsed["document_count"] = len(files)
    return parsed


def kg_nodes_to_facts(
    nodes: list[dict[str, Any]],
    *,
    predicate_facts: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []
    for pf in predicate_facts or []:
        pred = str(pf.get("predicate") or "")
        args = pf.get("args") or []
        args_s = ", ".join(str(a) for a in args)
        facts.append(
            {
                "id": f"pred_{pred}_{args_s}",
                "label": pred,
                "value": f"{pred}({args_s})" if args_s else pred,
                "source": pf.get("source", "parse"),
                "predicate": pred,
                "args": list(args),
                "text": pf.get("description") or f"{pred}({args_s})",
                "provenance": pf.get("source", "parse"),
            }
        )
    for node in nodes:
        if node.get("type") in {"Document"}:
            facts.append(
                {
                    "id": node.get("id"),
                    "label": node.get("type") or "node",
                    "value": node.get("label") or "",
                    "source": node.get("source", "parse"),
                    "text": node.get("label"),
                }
            )
    return facts


def llm_enrich_json(text: str) -> dict[str, Any] | None:
    """Optional OpenAI structured extract (fields only)."""
    if len(text) < 40:
        return None
    try:
        import json

        from logic.openai_client import chat_completion, openai_configured

        if not openai_configured():
            return None

        prompt = (
            "Extract JSON with keys: name, markets (array), processesPersonalData (yes/no/unknown), "
            "euLink (yes/no/unknown), aiSystem (yes/no/unknown), summary (string). "
            "Set euLink to yes only when the organisation has a clear EU/EEA territorial nexus "
            "(established, based, or processing data in the EU) — not merely selling to EU customers. "
            "Product description:\n" + text[:6000]
        )
        content = chat_completion(
            messages=[{"role": "user", "content": prompt}],
            json_object=True,
            timeout=45,
        )
        if not content:
            return None
        return json.loads(content)
    except Exception:  # noqa: BLE001
        return None


def parse_product_input(
    *,
    description: str = "",
    files: list[tuple[str, bytes]] | None = None,
    use_llm: bool = True,
) -> dict[str, Any]:
    if files:
        parsed = parse_documents(files)
    else:
        parsed = parse_description(description)

    if use_llm:
        llm = llm_enrich_json(parsed.get("summary") or description)
        if llm:
            if llm.get("name"):
                parsed["name"] = llm["name"]
            for key in ("processesPersonalData", "euLink", "aiSystem"):
                if llm.get(key):
                    parsed[key] = llm[key]
            if llm.get("markets"):
                parsed["markets"] = llm["markets"]
            if llm.get("summary"):
                parsed["summary"] = llm["summary"]

    nodes = parsed.get("nodes") or []
    edges = parsed.get("edges") or []
    product_id = next(
        (n.get("id") for n in nodes if n.get("type") in ("Product", "Scenario")),
        "product",
    )
    predicate_facts = graph_to_predicate_facts(nodes, edges, case_id=str(product_id))
    parsed["predicate_facts"] = predicate_facts
    parsed["facts"] = kg_nodes_to_facts(nodes, predicate_facts=predicate_facts)
    return parsed
