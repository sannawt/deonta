"""Parse EU legal document titles into human-readable display fields."""

from __future__ import annotations

import re
from typing import Any

from logic.legal_db import LAW_CATALOG

_NUMBER_RE = re.compile(
    r"(?:Regulation|Directive|Decision)\s*\((?:EU|Euratom|EC|EEC)(?:,\s*Euratom)?\)\s*"
    r"(?:No\s*)?(\d{4}/\d+(?:/\d+)?)",
    re.I,
)
_FALLBACK_NUMBER_RE = re.compile(r"\b(20\d{2}/\d+(?:/\d+)?)\b")
_PAREN_SHORT_RE = re.compile(r"\(([^()]{4,120})\)\s*$")
_UUID_SLUG_RE = re.compile(
    r"^[0-9a-f]{8}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{12}$",
    re.I,
)
_ON_SUBJECT_RE = re.compile(r"\bon\s+(?:the\s+)?(.+?)(?:\(|\.|$)", re.I)
_ESTABLISHING_RE = re.compile(r"\bestablishing\s+(?:the\s+)?(.+?)(?:\(|\.|$)", re.I)
_CONCERNING_RE = re.compile(r"\bconcerning\s+(?:the\s+)?(.+?)(?:\(|\.|$)", re.I)
_RELATING_RE = re.compile(r"\brelating\s+to\s+(?:the\s+)?(.+?)(?:\(|\.|$)", re.I)
_PURSUANT_RE = re.compile(r"\bpursuant to\s+(.+?)(?:\(|\.|$)", re.I)
_SPACING_FIX_RES = (
    (re.compile(r"(\d{4}/\d+)(of|on|concerning|establishing|pursuant)", re.I), r"\1 \2"),
    (re.compile(r"(\d{4})(establishing|laying|relating|amending|of|on|concerning|pursuant)", re.I), r"\1 \2"),
    (re.compile(r"(Council|Parliament|Commission)(of|on|establishing)", re.I), r"\1 \2"),
    (re.compile(r"(Decision|Regulation|Directive)(EU|EC|EEC)", re.I), r"\1 \2"),
    (re.compile(r"(EU)(\d{4}/\d+)", re.I), r"\1 \2"),
    (re.compile(r"(Kingdom|States|Union)(\d+)", re.I), r"\1"),
    (re.compile(r"(\w{4,})(\d{3,})\)", re.I), r"\1)"),
    (re.compile(r"(\D)(\d{3,})\)?$"), r"\1"),
)
_BOILERPLATE_RES = (
    re.compile(r"\(Text with EEA relevance\)", re.I),
    re.compile(r"\(notified under document[^)]*\)", re.I),
)

_KEYWORD_MAX_WORDS = 3

# Common 2–3 word legal topic phrases (matched before generic splitting)
_KNOWN_TOPIC_PHRASES: tuple[str, ...] = (
    "personal data",
    "data processing",
    "data protection",
    "data sharing",
    "data access",
    "forced labour",
    "forced labor",
    "product safety",
    "online platform",
    "online platforms",
    "artificial intelligence",
    "machine learning",
    "cyber security",
    "cybersecurity",
    "network security",
    "financial instruments",
    "criminal records",
    "child abduction",
    "parental responsibility",
    "company law",
    "personal data",
    "digital services",
    "digital markets",
    "consumer goods",
    "defence products",
    "defense products",
    "operational resilience",
    "content moderation",
    "illegal content",
    "high-risk ai",
    "third-country nationals",
    "general budget",
    "money laundering",
    "terrorist financing",
    "civil aviation",
    "electronic communications",
    "health data",
    "market surveillance",
    "common agricultural policy",
)

_KEYWORD_REJECT_RES: tuple[re.Pattern[str], ...] = (
    re.compile(r"^regulation\s*\(", re.I),
    re.compile(r"^directive\s*\(", re.I),
    re.compile(r"^decision\s*\(", re.I),
    re.compile(r"\barticle\b", re.I),
    re.compile(r"^oj\s+l\b", re.I),
    re.compile(r"\bbe made\b", re.I),
    re.compile(r"^purpose[s]?\b", re.I),
    re.compile(r"^liability companies\b", re.I),
    re.compile(r"^harmonised provisi\b", re.I),
    re.compile(r"^regulations?\b$", re.I),
    re.compile(r"^directive\b$", re.I),
    re.compile(r"\([\w\s]*$"),
)

_KEYWORD_JUNK_FRAGMENTS = frozenset(
    {
        "be made",
        "regulation (eu",
        "directive (eu",
        "oj l",
        "article",
        "purpose",
        "purposes",
        "regulations",
        "directive",
        "treaty",
    }
)

_KEYWORD_STOP = frozenset(
    {
        "the", "of", "and", "or", "a", "an", "to", "for", "in", "on", "with",
        "regard", "respect", "repealing", "establishing", "concerning", "relating",
        "under", "within", "union", "european", "parliament", "council", "commission",
        "member", "states", "measures", "framework", "programme", "program", "rules",
        "laying", "down", "amending", "implementing", "text", "eea", "relevance",
        "natural", "persons", "timely", "availability", "ensure", "products",
    }
)

_CATALOG_TOPICS: dict[str, tuple[str, ...]] = {
    "gdpr": ("personal data", "data processing", "data protection", "privacy"),
    "ai_act": ("artificial intelligence", "AI systems", "high-risk AI", "machine learning"),
    "cra": ("cybersecurity", "software products", "vulnerabilities", "digital products"),
    "dora": ("digital operational resilience", "financial entities", "ICT risk"),
    "nis2": ("network security", "critical infrastructure", "cybersecurity"),
    "data_act": ("data sharing", "IoT products", "cloud switching", "data access"),
    "eprivacy": ("electronic communications", "cookies", "marketing", "privacy"),
    "gpsr": ("product safety", "consumer goods", "market surveillance"),
    "dma": ("gatekeepers", "digital platforms", "competition", "core platform services"),
    "dsa": ("online platforms", "content moderation", "illegal content", "intermediary services"),
}
# Title keywords → catalog code (longer phrases first)
_TITLE_KEYWORDS: tuple[tuple[str, str], ...] = (
    ("general data protection regulation", "gdpr"),
    ("eu ai act", "ai_act"),
    ("artificial intelligence act", "ai_act"),
    ("cyber resilience act", "cra"),
    ("digital services act", "dsa"),
    ("digital markets act", "dma"),
    ("network and information security", "nis2"),
    ("data act", "data_act"),
    ("general product safety regulation", "gpsr"),
    ("eprivacy", "eprivacy"),
    ("dora", "dora"),
)

_PAREN_GENERIC = frozenset(
    {
        "recast",
        "codification",
        "text with eea relevance",
        "notified under document c",
    }
)
_INSTRUMENT_SHORT_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"^Commission Implementing Regulation", re.I), "Impl. Regulation"),
    (re.compile(r"^Commission Implementing Decision", re.I), "Impl. Decision"),
    (re.compile(r"^Commission Delegated Regulation", re.I), "Del. Regulation"),
    (re.compile(r"^Commission Delegated Decision", re.I), "Del. Decision"),
    (re.compile(r"^Commission Decision", re.I), "Comm. Decision"),
    (re.compile(r"^Council Regulation", re.I), "Council Regulation"),
    (re.compile(r"^Council Directive", re.I), "Council Directive"),
    (re.compile(r"^Regulation \(EU\)", re.I), "EU Regulation"),
    (re.compile(r"^Directive \(EU\)", re.I), "EU Directive"),
)

_GENERIC_INSTRUMENT_SHORTS = frozenset(
    {
        "EU Regulation",
        "EU Directive",
        "Council Regulation",
        "Council Directive",
        "Impl. Regulation",
        "Impl. Decision",
        "Del. Regulation",
        "Del. Decision",
        "Comm. Decision",
    }
)

# Act levels used to de-prioritise or exclude noise (implementing acts, internal rules, annexes).
_TIER_SCORE_PENALTY: dict[str, float] = {
    "primary": 0.0,
    "council": 0.03,
    "commission": 0.05,
    "delegated": 0.08,
    "implementing": 0.10,
    "internal": 0.15,
    "annex": 0.18,
    "other": 0.04,
    "unknown": 0.02,
}

_SECONDARY_EXCLUDED_TIERS = frozenset({"internal", "annex", "unknown"})

_NOISE_TITLE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"restrictive measures", re.I),
    re.compile(r"non[- ]proliferation", re.I),
    re.compile(r"situation in (?:the )?", re.I),
    re.compile(r"^draft (?:implementing |delegated )?", re.I),
    re.compile(
        r"only the (?:english|french|german|spanish|italian|dutch|polish|portuguese) "
        r"text is authentic",
        re.I,
    ),
    re.compile(r"authentic language version", re.I),
)
# Well-known acronyms from parenthetical short names
_ACRONYM_MAP: dict[str, str] = {
    "general data protection regulation": "GDPR",
    "digital services act": "DSA",
    "digital markets act": "DMA",
    "cyber resilience act": "CRA",
    "network and information security": "NIS2",
    "general product safety regulation": "GPSR",
    "artificial intelligence act": "AI Act",
    "eu data act": "Data Act",
}

# Subject-matter phrases → compact short handle (checked before generic word pairs)
_HANDLE_PHRASE_MAP: dict[str, str] = {
    "general budget": "EU Budget",
    "financial rules applicable": "Financial Rules",
    "european health data space": "EHDS",
    "health data space": "EHDS",
    "european electronic communications code": "EECC",
    "electronic communications code": "EECC",
    "registration, evaluation, authorisation and restriction of chemicals": "REACH",
    "money laundering": "AML/CFT",
    "terrorist financing": "AML/CFT",
    "common agricultural policy": "CAP",
    "european public prosecutor's office": "EPPO",
    "public prosecutor's office": "EPPO",
    "personal pension product": "PEPP",
    "entry/exit system": "EES",
    "schengen information system": "SIS",
    "official controls regulation": "Official Controls",
    "digital services act": "DSA",
    "digital markets act": "DMA",
    "cyber resilience act": "CRA",
    "general product safety": "GPSR",
    "artificial intelligence act": "AI Act",
}

_HANDLE_VERB_STOP = frozenset(
    {
        "prevention", "support", "setting", "making", "requests", "facilitating",
        "improving", "establishing", "ensuring", "addressing", "promoting",
        "implementation", "introduction", "collection", "transfer", "approval",
        "common", "internal", "restrictive", "behalf", "signing", "conclusion",
        "position", "only", "codified", "withdrawal", "temporary", "future",
        "packaging", "personal", "third-country", "third", "country",
    }
)


def _catalog_by_number(number: str) -> dict[str, str] | None:
    num = (number or "").strip()
    if not num:
        return None
    for row in LAW_CATALOG:
        if row.get("number") == num:
            return row
    return None


def catalog_code_from_number(number: str) -> str:
    row = _catalog_by_number(number)
    return row["code"] if row else ""


def catalog_code_from_title(title: str) -> str:
    lower = (title or "").lower()
    for phrase, code in _TITLE_KEYWORDS:
        if phrase in lower:
            return code
    return ""


def extract_all_official_numbers(title: str) -> list[str]:
    cleaned = normalize_title_spacing(title or "")
    found: list[str] = []
    for m in _NUMBER_RE.finditer(cleaned):
        num = m.group(1)
        if num not in found:
            found.append(num)
    for m in _FALLBACK_NUMBER_RE.finditer(cleaned):
        num = m.group(1)
        if num not in found:
            found.append(num)
    return found


def _document_head(title: str) -> str:
    """Title portion describing this instrument, before pursuant/amending citations."""
    cleaned = clean_document_title(title)
    return re.split(
        r"\bpursuant to\b|\bamending (?:Regulation|Directive|Council|Decision|\(EU\))\b",
        cleaned,
        maxsplit=1,
        flags=re.I,
    )[0].strip()


def extract_primary_official_number(title: str) -> str:
    """Official number of this document (ignore numbers cited in pursuant/amending clauses)."""
    head = _document_head(title)
    cleaned = normalize_title_spacing(head)
    m = _NUMBER_RE.search(head)
    if m:
        return m.group(1)
    m2 = _FALLBACK_NUMBER_RE.search(head)
    if m2:
        return m2.group(1)
    return extract_official_number(title)


def catalog_for_primary_document(
    title: str,
    official_number: str = "",
) -> tuple[str, str, dict[str, str] | None]:
    """Catalog match only when this document's own number is in the catalog."""
    primary = (official_number or "").strip() or extract_primary_official_number(title)
    row = _catalog_by_number(primary)
    if row:
        return row["code"], primary, row
    return "", primary, None


def resolve_display_catalog(title: str) -> tuple[str, str, dict[str, str] | None]:
    """Pick catalog law from pursuant references or title keywords (not amending citations)."""
    code = infer_related_catalog_code(title)
    if code:
        row = next((r for r in LAW_CATALOG if r["code"] == code), None)
        if row:
            return code, row["number"], row
    return "", extract_official_number(title), None


def infer_related_catalog_code(title: str, primary_number: str = "") -> str:
    """Catalog law this document implements (pursuant / under), not merely amends."""
    primary_code, _, _ = catalog_for_primary_document(title, primary_number)
    if primary_code:
        return primary_code

    cleaned = clean_document_title(title)
    parts = re.split(r"\bpursuant to\b", cleaned, maxsplit=1, flags=re.I)
    if len(parts) > 1:
        tail = parts[1][:500]
        for num in extract_all_official_numbers(tail):
            row = _catalog_by_number(num)
            if row:
                return row["code"]
        lower = tail.lower()
        for phrase, code in _TITLE_KEYWORDS:
            if phrase in lower:
                return code

    head = _document_head(title)
    return catalog_code_from_title(head) or ""


def infer_catalog_code(title: str, number: str = "") -> str:
    primary_code, primary_num, _ = catalog_for_primary_document(title, number)
    if primary_code:
        return primary_code
    return infer_related_catalog_code(title, primary_num or number)


def _catalog_keyword_code(title: str, primary_code: str, related_code: str) -> str:
    """Use catalog topic keywords only for primary catalog laws or pursuant instruments."""
    if primary_code:
        return primary_code
    if re.search(r"\bpursuant to\b", clean_document_title(title), re.I):
        return related_code
    return ""


def extract_official_number(title: str) -> str:
    text = title or ""
    m = _NUMBER_RE.search(text)
    if m:
        return m.group(1)
    m2 = _FALLBACK_NUMBER_RE.search(text)
    if m2:
        return m2.group(1)
    return ""


def normalize_title_spacing(title: str) -> str:
    s = (title or "").strip()
    for rx, repl in _SPACING_FIX_RES:
        s = rx.sub(repl, s)
    return re.sub(r"\s+", " ", s).strip()


def _strip_boilerplate(title: str) -> str:
    s = normalize_title_spacing(title)
    for rx in _BOILERPLATE_RES:
        s = rx.sub("", s)
    return re.sub(r"\s+", " ", s).strip()


def clean_document_title(title: str) -> str:
    s = _strip_boilerplate(title)
    if re.match(r"^Corrigendum to ", s, re.I):
        s = re.sub(r"^Corrigendum to ", "", s, flags=re.I).strip()
    return s


def classify_document_tier(title: str) -> str:
    """Coarse act level for scan filtering (primary vs implementing vs internal)."""
    cleaned = clean_document_title(title or "")
    if not cleaned:
        return "unknown"
    lower = cleaned.lower()
    if re.match(r"^(?:annex|protocol)\b", lower):
        return "annex"
    if re.search(
        r"^decision of the (?:bureau|management|governing|administrative|steering|high representative|european)",
        lower,
    ) or re.search(
        r"^(?:management board|governing board|administrative board|european investment bank) decision",
        lower,
    ):
        return "internal"
    if re.match(r"^commission implementing (?:regulation|decision)\b", lower):
        return "implementing"
    if re.match(r"^commission delegated (?:regulation|decision)\b", lower):
        return "delegated"
    if re.match(r"^council implementing (?:regulation|decision)\b", lower):
        return "implementing"
    if re.match(r"^(?:regulation|directive)\s*\((?:eu|eu,\s*euratom|ec|eec)\)", lower):
        return "primary"
    if re.match(r"^council (?:regulation|directive)\s*\((?:eu|ec|eec)\)", lower):
        return "council"
    if re.match(r"^council decision\s*\((?:eu|ec)\)", lower):
        return "council"
    if re.match(r"^commission (?:regulation|decision|directive)\s*\(", lower):
        return "commission"
    if "agreement" in lower[:80] or "convention" in lower[:50]:
        return "other"
    return "unknown"


def tier_score_penalty(tier: str) -> float:
    return _TIER_SCORE_PENALTY.get((tier or "").strip().lower(), 0.02)


def is_noise_document(title: str) -> bool:
    """Drop sanctions lists, draft-only titles, and authentic-language stubs."""
    cleaned = clean_document_title(title or "")
    if not cleaned:
        return True
    lower = cleaned.lower()
    return any(p.search(lower) for p in _NOISE_TITLE_PATTERNS)


def should_exclude_tier(tier: str, *, include_secondary: bool, is_catalog_primary: bool) -> bool:
    if is_catalog_primary:
        return False
    t = (tier or "unknown").strip().lower()
    if include_secondary:
        return t in _SECONDARY_EXCLUDED_TIERS
    return t != "primary"


def _subject_from_pursuant_clause(title: str) -> str:
    cleaned = clean_document_title(title)
    parts = re.split(r"\bpursuant to\b", cleaned, maxsplit=1, flags=re.I)
    if len(parts) < 2:
        return ""
    tail = parts[1]
    on_matches = list(re.finditer(r"\bon (?:the )?(.+?)(?:\(|\.|$)", tail, re.I))
    if not on_matches:
        return ""
    subject = on_matches[-1].group(1).strip()
    subject = re.split(
        r"\s+and amending\b|\s+and repealing\b",
        subject,
        maxsplit=1,
        flags=re.I,
    )[0]
    subject = _PAREN_SHORT_RE.sub("", subject).strip(" ,.;)")
    subject = re.sub(r"\d{3,}\)?$", "", subject).strip(" ,.;)")
    return subject if len(subject) >= 8 else ""


def _subject_from_title(title: str) -> str:
    cleaned = clean_document_title(title)
    pursuant = _subject_from_pursuant_clause(title)
    if pursuant:
        return pursuant
    head = _document_head(title)
    on_matches = list(re.finditer(r"\bon (?:the )?(.+?)(?:\(|\.|$)", head, re.I))
    if on_matches:
        subject = on_matches[-1].group(1).strip()
        subject = re.split(
            r"\s+and amending\b|\s+and repealing\b",
            subject,
            maxsplit=1,
            flags=re.I,
        )[0]
        subject = _PAREN_SHORT_RE.sub("", subject).strip(" ,.;)")
        subject = re.sub(r"\d{3,}\)?$", "", subject).strip(" ,.;)")
        if len(subject) >= 8:
            return subject
    for rx in (_ESTABLISHING_RE, _CONCERNING_RE, _RELATING_RE):
        m = rx.search(head)
        if m:
            subject = m.group(1).strip()
            subject = re.split(
                r"\s+and amending\b|\s+and repealing\b",
                subject,
                maxsplit=1,
                flags=re.I,
            )[0]
            subject = _PAREN_SHORT_RE.sub("", subject).strip(" ,.;)")
            if len(subject) >= 8:
                return subject
    return ""


def _trim_keyword_phrase(phrase: str, *, max_words: int = _KEYWORD_MAX_WORDS) -> str:
    words = [w for w in re.sub(r"\s+", " ", (phrase or "").lower()).strip().split() if w]
    while words and words[0] in _KEYWORD_STOP:
        words.pop(0)
    while words and words[-1] in _KEYWORD_STOP:
        words.pop()
    if not words:
        return ""
    if len(words) > max_words:
        words = words[:max_words]
    return " ".join(words)


def _sanitize_keyword_phrase(phrase: str) -> str:
    p = re.sub(r"\s+", " ", (phrase or "").lower()).strip(" ,.;)")
    p = re.sub(r"\d{2,}\)?$", "", p).strip(" ,.;)")
    if len(p) < 3 or re.search(r"\d{3,}", p):
        return ""
    if p in _KEYWORD_JUNK_FRAGMENTS:
        return ""
    for rx in _KEYWORD_REJECT_RES:
        if rx.search(p):
            return ""
    p = _trim_keyword_phrase(p)
    if not p or len(p) < 3:
        return ""
    words = p.split()
    if all(w in _KEYWORD_STOP for w in words):
        return ""
    if len(words) == 1 and words[0] in _HANDLE_VERB_STOP:
        return ""
    return p


def _known_phrases_in_text(text: str) -> list[str]:
    lower = (text or "").lower()
    found: list[str] = []
    for phrase in sorted(_KNOWN_TOPIC_PHRASES, key=len, reverse=True):
        if phrase in lower and phrase not in found:
            found.append(phrase)
    return found


def _phrase_keywords(text: str, *, limit: int = 5) -> list[str]:
    subject = re.sub(r"\s+", " ", (text or "").lower()).strip()
    if not subject:
        return []
    keywords: list[str] = []
    seen: set[str] = set()

    def add_phrase(raw: str) -> None:
        phrase = _sanitize_keyword_phrase(raw)
        if not phrase or phrase in seen:
            return
        seen.add(phrase)
        keywords.append(phrase)

    for phrase in _known_phrases_in_text(subject):
        add_phrase(phrase)

    parts = re.split(r",|;\s*|\s+and\s+", subject)
    for part in parts:
        part = part.strip()
        if not part:
            continue
        words = part.split()
        if len(words) <= _KEYWORD_MAX_WORDS:
            add_phrase(part)
            continue
        for n in (_KEYWORD_MAX_WORDS, 2):
            if len(words) >= n:
                add_phrase(" ".join(words[-n:]))
        if len(words) >= _KEYWORD_MAX_WORDS + 1:
            mid = len(words) // 2
            add_phrase(" ".join(words[mid : mid + _KEYWORD_MAX_WORDS]))

    return keywords[:limit]


def extract_topic_keyword_list(
    title: str,
    *,
    catalog_code: str = "",
    keyword_catalog_code: str = "",
    provision_excerpt: str = "",
    limit: int = 5,
) -> list[str]:
    """Return short (2–3 word) subject-matter keywords."""
    keywords: list[str] = []
    seen: set[str] = set()

    def add_kw(phrase: str) -> None:
        p = _sanitize_keyword_phrase(phrase)
        if p and p not in seen:
            seen.add(p)
            keywords.append(p)

    primary_code, _, _ = catalog_for_primary_document(title)
    related_code = infer_related_catalog_code(title)
    topic_code = (
        (keyword_catalog_code or "").strip().lower()
        or _catalog_keyword_code(title, primary_code, related_code)
        or ""
    )
    if topic_code in _CATALOG_TOPICS:
        for topic in _CATALOG_TOPICS[topic_code][:4]:
            add_kw(topic)
        return _dedupe_keyword_list(keywords)[:limit]

    subject = _subject_from_title(title)
    for phrase in _phrase_keywords(subject, limit=limit):
        add_kw(phrase)

    if len(keywords) < 2 and provision_excerpt:
        excerpt = clean_provision_excerpt(provision_excerpt).lower()
        for phrase in _phrase_keywords(excerpt[:240], limit=3):
            add_kw(phrase)

    return _dedupe_keyword_list(keywords)[:limit]


def extract_topic_keywords(
    title: str,
    *,
    catalog_code: str = "",
    keyword_catalog_code: str = "",
    provision_excerpt: str = "",
    limit: int = 5,
) -> str:
    """Return comma-separated subject-matter keywords for the Summary column."""
    return ", ".join(
        extract_topic_keyword_list(
            title,
            catalog_code=catalog_code,
            keyword_catalog_code=keyword_catalog_code,
            provision_excerpt=provision_excerpt,
            limit=limit,
        )
    )


def _dedupe_keyword_list(keywords: list[str]) -> list[str]:
    """Drop keywords that are substrings of another keyword."""
    out: list[str] = []
    for kw in keywords:
        lower = kw.lower()
        if any(lower != other.lower() and lower in other.lower() for other in keywords):
            continue
        if kw not in out:
            out.append(kw)
    return out


_PAREN_INSTITUTIONAL = frozenset({"eu", "eu, euratom", "ec", "eec", "european union"})


def _is_instrument_marker_paren(inner: str) -> bool:
    lower = re.sub(r"\s+", " ", (inner or "").lower()).strip()
    if lower in _PAREN_INSTITUTIONAL:
        return True
    if re.match(r"^eu\s*,", lower):
        return True
    if re.fullmatch(r"eu", lower):
        return True
    return False


def _parentheticals_in(text: str) -> list[str]:
    return [
        m.group(1).strip()
        for m in re.finditer(r"\(([^()]{2,120})\)", text or "")
        if not _is_instrument_marker_paren(m.group(1).strip())
    ]


def _meaningful_parenthetical_short(inner: str) -> str:
    inner = re.sub(r"^the\s+", "", (inner or "").strip(), flags=re.I)
    lower = inner.lower().strip()
    if lower in _PAREN_GENERIC:
        return ""
    if lower in _ACRONYM_MAP:
        return _ACRONYM_MAP[lower]
    if re.match(r"^[A-Z][A-Z0-9-]{2,}(?:\s+(?:Regulation|Act|Directive))?$", inner.strip()):
        token = inner.strip().split()[0]
        return token if len(token) <= 12 else token[:12]
    if len(inner) <= 40 and not inner.lower().startswith("text with"):
        words = inner.split()
        if len(words) <= 6:
            for phrase, acronym in _ACRONYM_MAP.items():
                if phrase in lower:
                    return acronym
            for phrase, handle in _HANDLE_PHRASE_MAP.items():
                if phrase in lower:
                    return handle
            if len(words) > 1 or lower not in _PAREN_GENERIC:
                if len(words) <= 3:
                    return " ".join(w.capitalize() for w in words)
                return " ".join(w.capitalize() for w in words[:2])
    for phrase, acronym in _ACRONYM_MAP.items():
        if phrase in lower:
            return acronym
    for phrase, handle in _HANDLE_PHRASE_MAP.items():
        if phrase in lower:
            return handle
    return ""


def _instrument_short_label(cleaned: str) -> str:
    for rx, label in _INSTRUMENT_SHORT_PATTERNS:
        if rx.search(cleaned):
            return label
    m = re.search(r"\(([A-Z][A-Z0-9-]{2,})\)", cleaned)
    if m:
        return m.group(1)
    return ""


def _subject_compact_handle(title: str, *, max_words: int = 2) -> str:
    """Build a readable 2-word handle from the subject-matter clause."""
    subject = _subject_from_title(title)
    head = _document_head(title)
    search_text = f"{subject} {head}".lower()
    if not subject and not head:
        return ""
    for phrase, handle in sorted(_HANDLE_PHRASE_MAP.items(), key=lambda x: len(x[0]), reverse=True):
        if phrase in search_text:
            return handle
    lower = (subject or head).lower()
    for phrase, acronym in _ACRONYM_MAP.items():
        if phrase in lower:
            return acronym
    for phrase in sorted(_KNOWN_TOPIC_PHRASES, key=len, reverse=True):
        if phrase in lower:
            words = phrase.split()
            if len(words) <= max_words + 1:
                return " ".join(w.capitalize() for w in words[: max_words + 1])
    words = [
        w
        for w in re.findall(r"[a-z]{3,}", lower)
        if w not in _KEYWORD_STOP
        and w not in _HANDLE_VERB_STOP
        and w not in {"regulation", "directive", "decision", "certain", "aspects", "matters"}
    ]
    if len(words) >= max_words:
        return " ".join(w.capitalize() for w in words[:max_words])
    if words:
        return " ".join(w.capitalize() for w in words)
    return ""


def _acronym_from_parenthetical(inner: str) -> str:
    """Turn 'European Defence Industry Programme (EDIP Regulation)' style into EDIP."""
    tokens = re.findall(r"[A-Z]{2,}", inner)
    if tokens:
        return tokens[0]
    words = [w for w in re.findall(r"[A-Za-z]+", inner) if w.lower() not in _KEYWORD_STOP]
    if len(words) >= 2:
        return "".join(w[0].upper() for w in words[:4])
    return ""


def generate_short_handle(title: str, *, official_number: str = "") -> str:
    """Derive a compact display handle (GDPR, DSA, Impl. Regulation, etc.)."""
    return extract_short_name(title) or _subject_compact_handle(title)


def finalize_display_short(
    title: str,
    candidate: str = "",
    *,
    official_number: str = "",
) -> str:
    """Never return bare instrument type labels when a subject handle exists."""
    parsed = (candidate or "").strip()
    if parsed and parsed not in _GENERIC_INSTRUMENT_SHORTS:
        return parsed

    subject_handle = _subject_compact_handle(title)
    if subject_handle:
        return subject_handle

    primary_code, primary_number, primary_row = catalog_for_primary_document(title, official_number)
    if primary_row:
        return primary_row["short"]

    related_code = infer_related_catalog_code(title, primary_number or official_number)
    if related_code:
        parent = next((r["short"] for r in LAW_CATALOG if r["code"] == related_code), "")
        if parent and subject_handle:
            return subject_handle
        if parent and parsed in _GENERIC_INSTRUMENT_SHORTS:
            return parent

    head = _document_head(title)
    for inner in reversed(_parentheticals_in(head)):
        short = _meaningful_parenthetical_short(inner)
        if short and short not in _GENERIC_INSTRUMENT_SHORTS:
            return short

    number = primary_number or extract_primary_official_number(title) or extract_official_number(title)
    if number:
        return number

    if parsed and parsed not in _GENERIC_INSTRUMENT_SHORTS:
        return parsed
    return ""


def extract_short_name(title: str) -> str:
    _, _, catalog_row = catalog_for_primary_document(title)
    if catalog_row:
        return catalog_row["short"]

    head = _document_head(title)
    for inner in reversed(_parentheticals_in(head)):
        short = _meaningful_parenthetical_short(inner)
        if short and short not in _GENERIC_INSTRUMENT_SHORTS:
            return short
        acronym = _acronym_from_parenthetical(inner)
        if acronym and len(acronym) <= 12:
            return acronym

    m = _PAREN_SHORT_RE.search(head)
    if m:
        short = _meaningful_parenthetical_short(m.group(1).strip())
        if short and short not in _GENERIC_INSTRUMENT_SHORTS:
            return short

    subject_handle = _subject_compact_handle(title)
    if subject_handle:
        return subject_handle

    instrument = _instrument_short_label(head)
    if instrument and instrument not in _GENERIC_INSTRUMENT_SHORTS:
        return instrument

    return finalize_display_short(title, instrument or "")


def title_summary(title: str, *, max_len: int = 300) -> str:
    cleaned = clean_document_title(title)
    if not cleaned:
        return ""
    # Remove trailing parenthetical short name for summary
    summary = _PAREN_SHORT_RE.sub("", cleaned).strip()
    summary = re.sub(r"\s+", " ", summary)
    if len(summary) <= max_len:
        return summary
    return summary[: max_len - 1].rstrip() + "…"


def clean_provision_excerpt(text: str) -> str:
    s = re.sub(r"\s+", " ", (text or "").strip())
    s = re.sub(r"^\(\d+\)\s*", "", s)
    s = re.sub(r"^Article\s+\d+[a-z]?\s+", "", s, flags=re.I)
    return s.strip()


def is_uuid_slug(value: str) -> bool:
    v = (value or "").strip()
    if _UUID_SLUG_RE.match(v):
        return True
    return bool(
        re.match(
            r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            v,
            re.I,
        )
    )


def parse_document_display(
    title: str,
    *,
    official_number: str = "",
    short_name: str = "",
    description: str = "",
    provision_excerpt: str = "",
) -> dict[str, Any]:
    """Build display fields from a Neo4j document title and optional metadata."""
    cleaned_title = clean_document_title(title)
    primary_code, primary_number, primary_row = catalog_for_primary_document(
        title, official_number
    )
    related_code = infer_related_catalog_code(title, primary_number) if not primary_code else ""
    catalog_code = primary_code or related_code
    keyword_catalog = _catalog_keyword_code(title, primary_code, related_code)
    number = primary_number or extract_official_number(title)

    parsed_short = finalize_display_short(
        title,
        (short_name or "").strip() or generate_short_handle(title, official_number=official_number),
        official_number=official_number or primary_number,
    )
    if not parsed_short and primary_row:
        parsed_short = primary_row["short"]

    topics = extract_topic_keywords(
        title,
        catalog_code=catalog_code,
        keyword_catalog_code=keyword_catalog,
        provision_excerpt=provision_excerpt if not keyword_catalog else "",
    )

    full_title = cleaned_title or title or parsed_short
    display_label = parsed_short or (primary_row["short"] if primary_row else "") or ""
    display_label = finalize_display_short(title, display_label, official_number=number)
    return {
        "label": display_label or full_title[:60],
        "full_title": full_title,
        "short": display_label,
        "number": number,
        "description": topics,
        "catalog_code": catalog_code,
        "document_tier": classify_document_tier(title),
    }
