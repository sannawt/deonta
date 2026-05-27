from __future__ import annotations

import re
from typing import Any


def _tokenize(q: str) -> list[str]:
    toks = re.findall(r"[A-Za-z_][A-Za-z0-9_]*", (q or "").lower())
    # keep meaningful tokens
    return [t for t in toks if len(t) >= 4]


def _excerpt(text: str | None, n: int = 260) -> str:
    s = str(text or "").strip()
    if len(s) <= n:
        return s
    return s[: n - 1].rstrip() + "…"


def build_general_answer_from_rule_catalog(*, question: str, rule_catalog_resp: Any) -> dict[str, Any]:
    """
    Deterministic, rule-catalog-grounded general answer.

    Returns:
      - assistant_text: markdown-ish plain text
      - related_provisions[]: minimal citations for UI
    """
    provisions = list(getattr(rule_catalog_resp, "provisions", []) or [])
    if not provisions:
        return {
            "assistant_text": "I couldn’t load the local rule corpus right now.",
            "related_provisions": [],
        }

    toks = _tokenize(question)
    q_lower = (question or "").lower()

    def score(p: Any) -> int:
        title = str(getattr(p, "title", "") or "")
        text = str(getattr(p, "text", "") or "")
        reg = str(getattr(p, "regulation", "") or "")
        blob = f"{reg} {title} {text}".lower()
        s = 0
        for t in toks:
            if t in blob:
                s += 1
        # Nudge by explicit regulation terms
        if "gdpr" in q_lower and reg.lower().find("gdpr") >= 0:
            s += 3
        if ("ai act" in q_lower or "eu ai act" in q_lower) and reg.lower().find("ai") >= 0:
            s += 3
        return s

    ranked = sorted(((score(p), p) for p in provisions), key=lambda x: x[0], reverse=True)
    top = [p for s, p in ranked[:6] if s > 0] or [p for s, p in ranked[:3]]

    lines: list[str] = []
    lines.append("Here are relevant excerpts from the local legal corpus that match your question:")
    for p in top:
        reg = str(getattr(p, "regulation", "") or "")
        plid = str(getattr(p, "provision_long_id", "") or "")
        title = str(getattr(p, "title", "") or "").strip()
        txt = _excerpt(getattr(p, "text", None), 320)
        head = f"- {reg} · {title + ' — ' if title else ''}{plid}".strip(" ·")
        lines.append(head)
        lines.append(f"  {txt}")  # plain-text excerpt

    assistant_text = "\n".join(lines).strip()

    related_provisions = [
        {
            "provision_long_id": str(getattr(p, "provision_long_id", "") or ""),
            "regulation": str(getattr(p, "regulation", "") or ""),
            "title": str(getattr(p, "title", "") or "") or None,
        }
        for p in top
    ]
    return {"assistant_text": assistant_text, "related_provisions": related_provisions}

