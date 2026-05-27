"""
Map internal provision_long_id values to human labels and EUR-Lex / ELI URLs.
"""

from __future__ import annotations

import re
from typing import Any

_REG_ELI = {
    "GDPR": "2016/679",
    "AIAct": "2024/1689",
}

_REG_CELEX = {
    "GDPR": "32016R0679",
    "AIAct": "32024R1689",
}


def _reg_prefix(plid: str) -> str | None:
    if plid.startswith("GDPR_"):
        return "GDPR"
    if plid.startswith("AIAct_"):
        return "AIAct"
    return None


def format_provision_label(plid: str) -> str:
    """GDPR_A3.2.a -> Art. 3(2)(a); AIAct_R25 -> Recital 25."""
    plid = (plid or "").strip()
    if not plid:
        return ""
    prefix = _reg_prefix(plid)
    if not prefix:
        return plid
    body = plid[len(prefix) + 1 :]
    if body.startswith("R"):
        num = body[1:].split(".")[0]
        return f"Recital {num}"
    if body.startswith("A"):
        rest = body[1:]
        parts = rest.split(".")
        if not parts:
            return plid
        art = parts[0]
        label = f"Art. {art}"
        for p in parts[1:]:
            label += f"({p})"
        return label
    return plid


def eurlex_url_for_provision(plid: str) -> str | None:
    plid = (plid or "").strip()
    prefix = _reg_prefix(plid)
    if not prefix:
        return None
    eli = _REG_ELI[prefix]
    body = plid[len(prefix) + 1 :]
    if body.startswith("R"):
        num = re.match(r"R(\d+)", body)
        if num:
            return f"https://eur-lex.europa.eu/eli/reg/{eli}/oj/rec_{num.group(1)}"
    if body.startswith("A"):
        rest = body[1:]
        art = rest.split(".")[0]
        if art.isdigit():
            return f"https://eur-lex.europa.eu/eli/reg/{eli}/oj/art_{art}"
    return f"https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:{_REG_CELEX[prefix]}"


def _is_parent_provision(parent: str, child: str) -> bool:
    """True when parent is a strict prefix segment (AIAct_A2.1 parent of AIAct_A2.1.d)."""
    if parent == child:
        return False
    return child.startswith(parent + ".")


def dedupe_provision_ids(plids: list[str]) -> list[str]:
    """Drop parent provisions when a more specific child is present (not sibling paragraphs)."""
    ordered = sorted(
        {p.strip() for p in plids if (p or "").strip()},
        key=lambda x: (x.count("."), len(x)),
        reverse=True,
    )
    kept: list[str] = []
    for plid in ordered:
        if any(_is_parent_provision(plid, other) for other in kept):
            continue
        kept = [o for o in kept if not _is_parent_provision(o, plid)]
        kept.append(plid)
    return sorted(kept)


def enrich_citation(
    plid: str,
    *,
    catalog_entry: dict[str, Any] | None = None,
) -> dict[str, Any]:
    from logic.provision_text import lookup_provision_record

    merged = {**lookup_provision_record(plid), **(catalog_entry or {})}
    entry = merged
    title = str(entry.get("title") or entry.get("name") or "").strip()
    text = str(entry.get("text") or "").strip()
    # Keep excerpt only for tooltips; lawyer view uses full `text`.
    excerpt = text[:400] + ("…" if len(text) > 400 else "") if text else ""
    label = format_provision_label(plid)
    if title and title not in label:
        display = f"{label} — {title}" if label else title
    else:
        display = label or plid
    return {
        "provision_long_id": plid,
        "label": label or plid,
        "display": display,
        "title": title or None,
        "text": text or None,
        "excerpt": excerpt or None,
        "eurlex_url": eurlex_url_for_provision(plid),
        "regulation": entry.get("regulation"),
    }
