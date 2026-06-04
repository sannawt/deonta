"""Parse product description and documents into KG nodes and compatibility facts."""

from __future__ import annotations

import io
import os
import re
from typing import Any, BinaryIO

from logic.fact_extractor import _AI, _EU, _PERSONAL, _PROCESSING
from logic.kg_schema import graph_edge, graph_node, new_node_id

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

    markets = list({m.group(0).upper() if m.group(0).upper() in ("EU", "US", "UK", "EEA") else m.group(0) for m in _MARKET_RE.finditer(raw)})
    if not markets:
        markets = ["EU"] if _EU.search(raw) else ["EU"]

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []

    product_id = new_node_id("pr")
    product_node = graph_node(
        node_id=product_id,
        node_type="Product",
        label=name or "Product",
        properties={"description": raw[:4000]},
        source="parse",
    )
    nodes.append(product_node)

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

    if _PERSONAL.search(raw) or _PROCESSING.search(raw):
        did = new_node_id("dt")
        nodes.append(
            graph_node(
                node_id=did,
                node_type="Data",
                label="Personal or operational data",
                properties={"personal_data": _signal_from_text(raw, _PERSONAL)},
                source="parse",
            )
        )
        edges.append(graph_edge(from_id=product_id, to_id=did, edge_type="PROCESSES_DATA"))

    if _AI.search(raw):
        aid = new_node_id("ai")
        nodes.append(
            graph_node(
                node_id=aid,
                node_type="AI",
                label="AI system",
                source="parse",
            )
        )
        edges.append(graph_edge(from_id=product_id, to_id=aid, edge_type="USES_AI"))

    facts = kg_nodes_to_facts(nodes)
    return {
        "name": name,
        "summary": raw,
        "markets": markets,
        "processesPersonalData": _signal_from_text(raw, _PERSONAL),
        "euLink": _signal_from_text(raw, _EU) if markets else "unknown",
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
        if n.get("type") == "Product":
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


def kg_nodes_to_facts(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []
    for node in nodes:
        facts.append(
            {
                "id": node.get("id"),
                "label": node.get("type") or "node",
                "value": node.get("label") or "",
                "source": node.get("source", "parse"),
                "predicate": node.get("type"),
                "text": node.get("label"),
            }
        )
        props = node.get("properties") or {}
        for k, v in props.items():
            if v and str(v) != "unknown":
                facts.append(
                    {
                        "id": f"{node.get('id')}_{k}",
                        "label": k,
                        "value": str(v),
                        "source": node.get("source", "parse"),
                    }
                )
    return facts


def llm_enrich_json(text: str) -> dict[str, Any] | None:
    """Optional OpenAI structured extract (fields only)."""
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key or len(text) < 40:
        return None
    try:
        import json
        import urllib.error
        import urllib.request

        prompt = (
            "Extract JSON with keys: name, markets (array), processesPersonalData (yes/no/unknown), "
            "euLink (yes/no/unknown), aiSystem (yes/no/unknown), summary (string). "
            "Product description:\n" + text[:6000]
        )
        body = json.dumps(
            {
                "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
            }
        ).encode()
        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=body,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=45) as resp:
            payload = json.loads(resp.read().decode())
        content = payload["choices"][0]["message"]["content"]
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

    parsed["facts"] = kg_nodes_to_facts(parsed.get("nodes") or [])
    return parsed
