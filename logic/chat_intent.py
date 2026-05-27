from __future__ import annotations

import re


_GENERAL_HINTS = [
    r"\bwhat\s+is\b",
    r"\bwhat's\b",
    r"\bexplain\b",
    r"\bwhy\b",
    r"\bmeaning\b",
    r"\bdefine\b",
    r"\btell\s+me\b",
    r"\bhow\s+does\b",
    r"\bhow\s+would\b",
]

_APPLICABILITY_HINTS = [
    r"\bdoes\s+.*\s+(apply|apply to)\b",
    r"\bwhich\s+laws?\s+(apply|are\s+applicable)\b",
    r"\bin\s+scope\b",
    r"\bscope\b",
    r"\bapplicability\b",
    r"\bin\s+force\b",
    r"\bapplies\s+to\b",
    r"\bshould\s+(this|the\s+system)\s+.*\s+comply\b",
    r"\bgdpr\s+apply\b",
    r"\bei\s*ai\s*act\s+apply\b",
    r"\bdoes\s+gdpr\s+apply\b",
    r"\bdoes\s+eu\s+ai\s+act\s+apply\b",
]


def classify_chat_mode(question: str) -> str:
    """
    Return:
      - "applicability" for questions about whether/which laws apply
      - "general" for definitions, explanations, and "why" questions
    """
    q = (question or "").strip().lower()
    if not q:
        return "general"

    # Applicability wins if strongly signaled.
    for pat in _APPLICABILITY_HINTS:
        if re.search(pat, q, flags=re.IGNORECASE):
            return "applicability"

    # If it explicitly asks "why", default to general.
    for pat in _GENERAL_HINTS:
        if re.search(pat, q, flags=re.IGNORECASE):
            return "general"

    # Fallback: treat questions that mention regulations as general definitions,
    # otherwise default to applicability (since most user prompts are about scope).
    if any(x in q for x in ["gdpr", "ai act", "eu ai act"]):
        return "general"

    return "applicability"

