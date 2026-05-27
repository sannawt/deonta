from __future__ import annotations

from typing import Any

SCOPE_SECTION_ORDER = ("temporal", "territorial", "material", "exclusions")
SCOPE_SECTION_LABELS = {
    "temporal": "Temporal scope",
    "territorial": "Territorial scope",
    "material": "Material scope",
    "exclusions": "Exclusions",
}
FINAL_CONCLUSION_LABEL = "Final conclusion"

_DIMENSION_TO_SECTION_ID = {
    "TEMPORAL": "temporal",
    "TERRITORIAL": "territorial",
    "MATERIAL": "material",
    "EXCLUSION": "exclusions",
    "EXCLUSIONS": "exclusions",
}

_SKIP_TOKEN_TO_SECTION_ID = {
    "TEMPORAL": "temporal",
    "TERRITORIAL": "territorial",
    "MATERIAL": "material",
    "EXCLUSION": "exclusions",
    "EXCLUSIONS": "exclusions",
    "temporal": "temporal",
    "territorial": "territorial",
    "material": "material",
    "exclusion": "exclusions",
    "exclusions": "exclusions",
}


def scope_section_label(section_id: str) -> str:
    return SCOPE_SECTION_LABELS.get(section_id, section_id)


def section_id_for_dimension(dimension: str | None) -> str | None:
    if not dimension:
        return None
    return _DIMENSION_TO_SECTION_ID.get(str(dimension).strip().upper())


def normalize_skip_further(skip_further: list[str] | None) -> list[str]:
    out: list[str] = []
    for raw in skip_further or []:
        section_id = _SKIP_TOKEN_TO_SECTION_ID.get(str(raw).strip())
        if section_id and section_id not in out:
            out.append(section_id)
    return out


def build_scope_sections(
    *,
    statuses: dict[str, str],
    pair_data: dict[str, dict[str, Any]] | None = None,
    skip_further: list[str] | None = None,
) -> list[dict[str, Any]]:
    skipped = set(normalize_skip_further(skip_further))
    pair_data = pair_data or {}
    sections: list[dict[str, Any]] = []
    for section_id in SCOPE_SECTION_ORDER:
        section_pairs = pair_data.get(section_id) or {}
        sections.append(
            {
                "id": section_id,
                "label": scope_section_label(section_id),
                "status": str(statuses.get(section_id) or "cannot_determine"),
                "skipped": section_id in skipped,
                "passed_pairs": list(section_pairs.get("passed_pairs") or []),
                "triggered_pairs": list(section_pairs.get("triggered_pairs") or []),
            }
        )
    return sections
