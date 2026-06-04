"""Tokenization helpers for legal/playbook retrieval."""

from __future__ import annotations

import re

STOPWORDS = frozenset(
    """
    the and for are but not you all can her was one our out get has him his how
    may she way who its let what when will with from that this have been into
    than then them they your such only also about would could should does did
    any some into onto unto per via
    """.split()
)


def terms_from_question(question: str) -> list[str]:
    words = re.findall(r"[a-zA-Z0-9]{2,}", question.lower())
    out: list[str] = []
    for w in words:
        if w in STOPWORDS:
            continue
        if w not in out:
            out.append(w)
        if len(out) >= 12:
            break
    if not out:
        t = question.strip().lower()
        if t:
            out = [t[:64]]
    return out
