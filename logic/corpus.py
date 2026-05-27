from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[1]
BUILD_DIR = REPO / "build"
DEFAULT_WORKBOOK = Path.home() / "Compliance calculator.xlsx"
BUILD_FILES = (
    "corpus.dl",
    "predicates.json",
    "citations.json",
    "regulations.json",
    "rules_index.json",
)
BUILD_SCRIPT = REPO / "scripts" / "build_corpus.py"


class CorpusNotReadyError(RuntimeError):
    pass


def workbook_path() -> Path:
    raw = os.environ.get("COMPLIANCE_CORPUS_XLSX", str(DEFAULT_WORKBOOK))
    return Path(raw).expanduser().resolve()


def build_path(name: str) -> Path:
    return BUILD_DIR / name


def corpus_status() -> dict[str, Any]:
    xlsx = workbook_path()
    missing = [name for name in BUILD_FILES if not build_path(name).is_file()]
    stale = False
    if xlsx.is_file() and not missing:
        src_mtime = max(
            xlsx.stat().st_mtime,
            BUILD_SCRIPT.stat().st_mtime if BUILD_SCRIPT.is_file() else 0,
        )
        stale = any(build_path(name).stat().st_mtime < src_mtime for name in BUILD_FILES)
    return {
        "workbook": str(xlsx),
        "workbook_exists": xlsx.is_file(),
        "build_dir": str(BUILD_DIR),
        "missing": missing,
        "stale": stale,
        "ready": xlsx.is_file() and not missing and not stale,
    }


def ensure_corpus_ready() -> None:
    status = corpus_status()
    if status["ready"]:
        return
    raise CorpusNotReadyError(
        "Corpus build is missing or stale. Run "
        "`python scripts/build_corpus.py \"/Users/sannawong-toropainen/Compliance calculator.xlsx\" -o build/`."
    )


def _load_json(name: str) -> Any:
    ensure_corpus_ready()
    return json.loads(build_path(name).read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_predicate_catalog() -> tuple[dict[str, Any], ...]:
    data = _load_json("predicates.json")
    if not isinstance(data, list):
        return tuple()
    return tuple(row for row in data if isinstance(row, dict))


@lru_cache(maxsize=1)
def load_predicate_index() -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for row in load_predicate_catalog():
        pred = str(row.get("predicate") or "").strip()
        if pred:
            out[pred] = dict(row)
    return out


@lru_cache(maxsize=1)
def load_regulations() -> tuple[str, ...]:
    data = _load_json("regulations.json")
    if not isinstance(data, list):
        return tuple()
    return tuple(str(x) for x in data if str(x).strip())


@lru_cache(maxsize=1)
def load_citations() -> dict[str, Any]:
    data = _load_json("citations.json")
    return data if isinstance(data, dict) else {}


@lru_cache(maxsize=1)
def load_rules_index() -> tuple[dict[str, Any], ...]:
    data = _load_json("rules_index.json")
    if not isinstance(data, list):
        return tuple()
    return tuple(row for row in data if isinstance(row, dict))


@lru_cache(maxsize=1)
def load_corpus_text() -> str:
    ensure_corpus_ready()
    return build_path("corpus.dl").read_text(encoding="utf-8")


@lru_cache(maxsize=1)
def load_output_predicates() -> tuple[str, ...]:
    out: list[str] = []
    for row in load_predicate_catalog():
        pred = str(row.get("predicate") or "").strip()
        kind = str(row.get("kind") or "").strip().lower()
        if pred and kind != "extensional":
            out.append(pred)
    return tuple(sorted(set(out)))


def extensional_predicates() -> tuple[dict[str, Any], ...]:
    return tuple(
        row
        for row in load_predicate_catalog()
        if str(row.get("kind") or "").strip().lower() in {"extensional", "reference"}
    )


def clear_corpus_caches() -> None:
    load_predicate_catalog.cache_clear()
    load_predicate_index.cache_clear()
    load_regulations.cache_clear()
    load_citations.cache_clear()
    load_rules_index.cache_clear()
    load_corpus_text.cache_clear()
    load_output_predicates.cache_clear()
