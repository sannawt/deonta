import os
import re
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal, Optional
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import FileResponse
from neo4j import GraphDatabase, Driver
from pydantic import BaseModel, Field

from logic.schema import load_schema_labels, validate_ground_facts
from logic.scope_applicability import build_applicability_report, validate_scope_facts
from logic.souffle_runner import (
    run_scope_applicability,
    run_souffle_golden,
    souffle_available,
)

BASE_DIR = Path(__file__).resolve().parent
# Explicit paths: some setups never persist passwords inside `.env` (buffer vs disk).
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR / ".env.local", override=True)
load_dotenv(BASE_DIR / "compliance_secrets.env", override=True)

STATIC_DIR = BASE_DIR / "static"

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


RETRIEVAL_CYPHER = """
MATCH (n)
WHERE any(k IN keys(n) WHERE n[k] IS NOT NULL AND toString(n[k]) <> '' AND
      any(t IN $terms WHERE toLower(toString(n[k])) CONTAINS t))
RETURN labels(n) AS labels, elementId(n) AS id, properties(n) AS props
LIMIT 40
"""

# When schemas/nodes.json exists, restrict to those labels (from workbook export).
RETRIEVAL_CYPHER_LABELED = """
MATCH (n)
WHERE any(l IN labels(n) WHERE l IN $labels)
  AND (
    size($terms) = 0
    OR any(k IN keys(n) WHERE n[k] IS NOT NULL AND toString(n[k]) <> '' AND
         any(t IN $terms WHERE toLower(toString(n[k])) CONTAINS t))
  )
RETURN labels(n) AS labels, elementId(n) AS id, properties(n) AS props
LIMIT 40
"""


def json_safe(value: Any) -> Any:
    """Neo4j returns temporal/spatial types that Pydantic/JSON cannot serialize."""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, dict):
        return {str(k): json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(v) for v in value]
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    mod = getattr(type(value), "__module__", "")
    if mod == "neo4j.time":
        fmt = getattr(value, "iso_format", None)
        if callable(fmt):
            return fmt()
        return str(value)
    if mod.startswith("neo4j."):
        return str(value)
    return str(value)


def record_to_dict(record: dict[str, Any]) -> dict[str, Any]:
    props = record.get("props") or {}
    return {
        "labels": record.get("labels") or [],
        "id": record.get("id"),
        "properties": json_safe(dict(props)),
    }


def aura_instance_id(uri: str) -> Optional[str]:
    """Neo4j Aura hostnames look like ``<id>.databases.neo4j.io`` — that id is the DB user and DB name."""
    try:
        normalized = (
            uri.replace("neo4j+s://", "https://", 1)
            .replace("neo4j+ssc://", "https://", 1)
            .replace("neo4j://", "https://", 1)
            .replace("bolt+s://", "https://", 1)
            .replace("bolt+ssc://", "https://", 1)
            .replace("bolt://", "http://", 1)
        )
        host = (urlparse(normalized).hostname or "").lower()
        if not host.endswith(".databases.neo4j.io"):
            return None
        prefix = host.split(".")[0]
        return prefix or None
    except Exception:  # noqa: BLE001
        return None


def resolve_aura_user(uri: str, env_key: str) -> str:
    aid = aura_instance_id(uri)
    raw = (os.environ.get(env_key) or "").strip()
    if aid and (not raw or raw.lower() == "neo4j"):
        return aid
    return raw or "neo4j"


def resolve_aura_database(uri: str, env_key: str) -> str:
    aid = aura_instance_id(uri)
    raw = (os.environ.get(env_key) or "").strip()
    if aid and (not raw or raw.lower() == "neo4j"):
        return aid
    return raw or "neo4j"


def open_driver(uri: str, user: str, password: str) -> Driver:
    if not password:
        raise ValueError("password is empty")
    return GraphDatabase.driver(uri, auth=(user, password))


def fetch_matches(driver: Driver, database: str, terms: list[str]) -> list[dict[str, Any]]:
    labels = list(load_schema_labels())
    with driver.session(database=database) as session:
        if labels:
            rows = session.run(
                RETRIEVAL_CYPHER_LABELED,
                terms=terms,
                labels=labels,
            )
        else:
            if not terms:
                return []
            rows = session.run(RETRIEVAL_CYPHER, terms=terms)
        return [record_to_dict(r.data()) for r in rows]


class AskBody(BaseModel):
    question: str = Field(..., min_length=1, max_length=4000)


class AskResponse(BaseModel):
    terms_used: list[str]
    legal: dict[str, Any]
    playbook: dict[str, Any]


class GroundFact(BaseModel):
    predicate: str
    args: list[str] = Field(default_factory=list)


class ReasonBody(BaseModel):
    """Neo4j context (optional question) + ground facts for applicability / scope tests."""

    question: Optional[str] = Field(default=None, max_length=4000)
    facts: list[GroundFact] = Field(default_factory=list)
    profile: Literal["scope_applicability", "legacy_gdpr_r14", "full_schema"] = Field(
        default="scope_applicability",
        description=(
            "scope_applicability: MATERIAL/TERRITORIAL/TEMPORAL/EXCLUSION toy orchestration; "
            "legacy_gdpr_r14: recital demo + required_facts validation; "
            "full_schema: required_facts validation + same legacy Soufflé."
        ),
    )


class ReasonResponse(BaseModel):
    terms_used: list[str]
    legal: dict[str, Any]
    playbook: dict[str, Any]
    schema_errors: list[str]
    normalized_facts: list[dict[str, Any]]
    reasoning: dict[str, Any]
    souffle_installed: bool
    profile: str
    applicability: Optional[dict[str, Any]] = None


def shutdown_drivers() -> None:
    global _legal_driver, _playbook_driver
    for d in (_legal_driver, _playbook_driver):
        if d is not None:
            d.close()
    _legal_driver = None
    _playbook_driver = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    shutdown_drivers()


app = FastAPI(title="Compliance QA", lifespan=lifespan)

_legal_driver: Optional[Driver] = None
_playbook_driver: Optional[Driver] = None


def get_legal_driver() -> Driver:
    global _legal_driver
    if _legal_driver is None:
        uri = os.environ["NEO4J_LEGAL_URI"]
        user = resolve_aura_user(uri, "NEO4J_LEGAL_USER")
        _legal_driver = open_driver(uri, user, os.environ["NEO4J_LEGAL_PASSWORD"])
    return _legal_driver


def get_playbook_driver() -> Driver:
    global _playbook_driver
    if _playbook_driver is None:
        uri = os.environ["NEO4J_PLAYBOOK_URI"]
        user = resolve_aura_user(uri, "NEO4J_PLAYBOOK_USER")
        _playbook_driver = open_driver(uri, user, os.environ["NEO4J_PLAYBOOK_PASSWORD"])
    return _playbook_driver


@app.post("/api/ask", response_model=AskResponse)
def ask(body: AskBody) -> AskResponse:
    terms = terms_from_question(body.question)
    legal: dict[str, Any] = {"matches": [], "error": None}
    playbook: dict[str, Any] = {"matches": [], "error": None}

    try:
        legal["matches"] = fetch_matches(
            get_legal_driver(),
            resolve_aura_database(os.environ["NEO4J_LEGAL_URI"], "NEO4J_LEGAL_DATABASE"),
            terms,
        )
    except KeyError as e:
        legal["error"] = f"missing env: {e.args[0]}"
    except ValueError as e:
        legal["error"] = str(e)
    except Exception as e:  # noqa: BLE001
        legal["error"] = f"{type(e).__name__}: {e}"

    try:
        playbook["matches"] = fetch_matches(
            get_playbook_driver(),
            resolve_aura_database(
                os.environ["NEO4J_PLAYBOOK_URI"], "NEO4J_PLAYBOOK_DATABASE"
            ),
            terms,
        )
    except KeyError as e:
        playbook["error"] = f"missing env: {e.args[0]}"
    except ValueError as e:
        playbook["error"] = str(e)
    except Exception as e:  # noqa: BLE001
        playbook["error"] = f"{type(e).__name__}: {e}"

    return AskResponse(terms_used=terms, legal=legal, playbook=playbook)


@app.post("/api/reason", response_model=ReasonResponse)
def reason(body: ReasonBody) -> ReasonResponse:
    q = (body.question or "").strip()
    terms = terms_from_question(q) if q else []

    legal: dict[str, Any] = {"matches": [], "error": None}
    playbook: dict[str, Any] = {"matches": [], "error": None}

    try:
        legal["matches"] = fetch_matches(
            get_legal_driver(),
            resolve_aura_database(os.environ["NEO4J_LEGAL_URI"], "NEO4J_LEGAL_DATABASE"),
            terms,
        )
    except KeyError as e:
        legal["error"] = f"missing env: {e.args[0]}"
    except ValueError as e:
        legal["error"] = str(e)
    except Exception as e:  # noqa: BLE001
        legal["error"] = f"{type(e).__name__}: {e}"

    try:
        playbook["matches"] = fetch_matches(
            get_playbook_driver(),
            resolve_aura_database(
                os.environ["NEO4J_PLAYBOOK_URI"], "NEO4J_PLAYBOOK_DATABASE"
            ),
            terms,
        )
    except KeyError as e:
        playbook["error"] = f"missing env: {e.args[0]}"
    except ValueError as e:
        playbook["error"] = str(e)
    except Exception as e:  # noqa: BLE001
        playbook["error"] = f"{type(e).__name__}: {e}"

    raw_facts = [f.model_dump() for f in body.facts]
    profile = body.profile
    applicability: Optional[dict[str, Any]] = None

    if profile == "scope_applicability":
        errors, normalized = validate_scope_facts(raw_facts)
    else:
        errors, normalized = validate_ground_facts(raw_facts)

    norm_payload = [
        {"predicate": p, "args": list(a)} for p, a in normalized
    ]
    if errors:
        reasoning = {
            "ok": False,
            "skipped": not souffle_available(),
            "message": "validation failed; Soufflé not run",
            "outputs": {},
            "stderr": "",
            "stdout": "",
        }
    elif profile == "scope_applicability":
        reasoning = run_scope_applicability(normalized)
        if reasoning.get("ok"):
            applicability = build_applicability_report(
                reasoning.get("outputs") or {}
            )
    elif profile == "legacy_gdpr_r14":
        reasoning = run_souffle_golden(normalized)
    else:  # full_schema
        reasoning = run_souffle_golden(normalized)

    return ReasonResponse(
        terms_used=terms,
        legal=legal,
        playbook=playbook,
        schema_errors=errors,
        normalized_facts=norm_payload,
        reasoning=reasoning,
        souffle_installed=souffle_available(),
        profile=profile,
        applicability=applicability,
    )


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")
