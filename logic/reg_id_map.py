"""Map Neo4j regulation identifiers to app law catalog codes."""

from __future__ import annotations

import re

from logic.legal_db import LAW_CATALOG

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.I,
)

REG_ID_TO_CODE: dict[str, str] = {
    "REG_GDPR": "gdpr",
    "REG_AIACT": "ai_act",
    "REG_AI_ACT": "ai_act",
    "REG_CRA": "cra",
    "REG_DORA": "dora",
    "REG_NIS2": "nis2",
    "REG_NIS_2": "nis2",
    "REG_DATA_ACT": "data_act",
    "REG_EPRIVACY": "eprivacy",
    "REG_GPSR": "gpsr",
    "REG_DMA": "dma",
    "REG_DSA": "dsa",
}


def reg_id_to_code(reg_id: str) -> str:
    key = (reg_id or "").strip().upper()
    if key in REG_ID_TO_CODE:
        return REG_ID_TO_CODE[key]
    if key.startswith("REG_"):
        slug = key[4:].lower().replace("-", "_")
        for row in LAW_CATALOG:
            if row["code"] == slug or slug in row["code"]:
                return row["code"]
        if slug == "aiact":
            return "ai_act"
        return slug
    return key.lower().replace("-", "_")


def normalize_reg_key(reg_key: str) -> str:
    key = (reg_key or "").strip()
    if not key:
        return ""
    if _UUID_RE.match(key):
        return key.lower()
    upper = key.upper()
    if upper.startswith("REG_"):
        return upper
    code = reg_id_to_code(key)
    if code:
        return "REG_" + code.upper().replace("AI_ACT", "AIACT")
    return upper
