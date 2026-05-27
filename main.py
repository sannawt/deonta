import os
import re
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal, Optional
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from neo4j import GraphDatabase, Driver
from pydantic import BaseModel, Field

from logic.corpus import (
    corpus_status,
    ensure_corpus_ready,
    load_citations,
    load_output_predicates,
    load_regulations,
    load_rules_index,
)
from logic.fact_extractor import propose_scope_facts
from logic.fact_payload import (
    FactPayload,
    clarification_facts_for_answers,
    compatibility_facts_for_payload,
    derive_in_force_phases,
    resolve_signal,
)
from logic.chat_intent import classify_chat_mode
from logic.chat_adapter import build_chat_response
from logic.general_answer import build_general_answer_from_rule_catalog
from logic.llm_answer import generate_general_answer_with_llm
from logic.graph_citations import bucket_legal_matches
from logic.local_legal_store import fetch_local_legal_matches, legal_graph_backend
from logic.playbook_store import (
    fetch_playbook_matches,
    list_playbook_companies,
)
from logic.phase_c_scope import analyse_phase_c_scope
from logic.reasoner import run_universal_reasoner
from logic.schema import load_schema_labels, validate_ground_facts
from logic.scenario_store import get_scenario, upsert_scenario
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
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"

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
    instrument_evaluations: list[dict[str, Any]] = Field(default_factory=list)
    missing_facts: list[str] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)
    supported_regulations: list[str] = Field(default_factory=list)


class ApplicabilityFlowBody(BaseModel):
    """Single-field NL pipeline entry (graph + extract + reason)."""

    situation: str = Field(..., min_length=1, max_length=8000)
    case_id: Optional[str] = None
    clarification_answers: dict[str, Literal["yes", "no"]] = Field(default_factory=dict)
    selected_fact_ids: Optional[list[int]] = None
    playbook_company_id: Optional[str] = None


class ApplicabilityFlowResponse(ReasonResponse):
    situation: str = ""
    case_id: str = ""
    proposed_fact_items: list[dict[str, Any]] = Field(default_factory=list)
    graph_citations: dict[str, list[dict[str, Any]]] = Field(default_factory=dict)
    extractor_notes: list[str] = Field(default_factory=list)
    scenario_record: Optional[dict[str, Any]] = None
    clarifying_questions: list[dict[str, Any]] = Field(default_factory=list)
    clarification_required: bool = False
    fact_payload: dict[str, Any] = Field(default_factory=dict)
    universal: Optional[dict[str, Any]] = None


class UniversalReasonBody(BaseModel):
    facts: list[GroundFact] = Field(default_factory=list)
    case_id: Optional[str] = None
    active_phases: dict[str, list[str]] = Field(default_factory=dict)
    signals: dict[str, str] = Field(default_factory=dict)


class UniversalReasonResponse(BaseModel):
    ok: bool
    message: Optional[str] = None
    schema_errors: list[str] = Field(default_factory=list)
    normalized_facts: list[dict[str, Any]] = Field(default_factory=list)
    supported_regulations: list[str] = Field(default_factory=list)
    reasoning: dict[str, Any] = Field(default_factory=dict)
    evaluations: list[dict[str, Any]] = Field(default_factory=list)
    provenance: dict[str, Any] = Field(default_factory=dict)
    defeasibility: dict[str, Any] = Field(default_factory=dict)
    scenario_id: Optional[str] = None


class RuleCatalogRule(BaseModel):
    rule_text: str = ""
    head_atom: str = ""
    head_predicate: str = ""
    scope_tag: str = ""
    body_atoms: list[str] = Field(default_factory=list)
    source_type: str = ""


class RuleCatalogProvision(BaseModel):
    provision_long_id: str
    provision_id: Optional[str] = None
    regulation: str = ""
    type: Optional[str] = None
    scope_tags: list[str] = Field(default_factory=list)
    title: Optional[str] = None
    text: Optional[str] = None
    datalog_rule: Optional[str] = None
    rules: list[RuleCatalogRule] = Field(default_factory=list)


class RuleCatalogResponse(BaseModel):
    supported_regulations: list[str] = Field(default_factory=list)
    provisions: list[RuleCatalogProvision] = Field(default_factory=list)


def shutdown_drivers() -> None:
    global _legal_driver, _playbook_driver
    for d in (_legal_driver, _playbook_driver):
        if d is not None:
            d.close()
    _legal_driver = None
    _playbook_driver = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_corpus_ready()
    yield
    shutdown_drivers()


app = FastAPI(title="Compliance QA", lifespan=lifespan)

if (FRONTEND_DIST / "assets").is_dir():
    app.mount(
        "/assets",
        StaticFiles(directory=FRONTEND_DIST / "assets"),
        name="workbench-assets",
    )

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


def _fetch_legal_playbook(
    terms: list[str],
    *,
    playbook_company_id: Optional[str] = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    legal: dict[str, Any] = {"matches": [], "error": None}
    playbook: dict[str, Any] = {
        "matches": [],
        "error": None,
        "company_id": playbook_company_id,
    }

    if legal_graph_backend() == "local":
        try:
            legal["matches"] = fetch_local_legal_matches(terms)
            legal["backend"] = "local_csv"
        except Exception as e:  # noqa: BLE001
            legal["error"] = f"{type(e).__name__}: {e}"
    else:
        try:
            legal["matches"] = fetch_matches(
                get_legal_driver(),
                resolve_aura_database(
                    os.environ["NEO4J_LEGAL_URI"], "NEO4J_LEGAL_DATABASE"
                ),
                terms,
            )
            legal["backend"] = "neo4j"
        except KeyError as e:
            legal["error"] = f"missing env: {e.args[0]}"
        except ValueError as e:
            legal["error"] = str(e)
        except Exception as e:  # noqa: BLE001
            legal["error"] = f"{type(e).__name__}: {e}"

    try:
        db = resolve_aura_database(
            os.environ["NEO4J_PLAYBOOK_URI"], "NEO4J_PLAYBOOK_DATABASE"
        )
        drv = get_playbook_driver()
        if playbook_company_id:
            playbook["matches"] = fetch_playbook_matches(
                driver=drv,
                database=db,
                company_id=playbook_company_id,
                terms=terms,
                record_to_dict_fn=record_to_dict,
            )
        else:
            playbook["matches"] = []
    except KeyError as e:
        playbook["error"] = f"missing env: {e.args[0]}"
    except ValueError as e:
        playbook["error"] = str(e)
    except Exception as e:  # noqa: BLE001
        playbook["error"] = f"{type(e).__name__}: {e}"

    legal["match_count"] = len(legal["matches"])
    playbook["match_count"] = len(playbook["matches"])
    return legal, playbook


def _effective_payload_signals(payload: FactPayload) -> dict[str, str]:
    return {
        "personal_data": resolve_signal(
            payload.signals.get("personal_data"),
            payload.clarification_answers.get("gdpr_personal_data"),
        ),
        "eu_link": resolve_signal(
            payload.signals.get("eu_link"),
            payload.clarification_answers.get("gdpr_eu_link"),
        ),
        "ai_system": resolve_signal(
            payload.signals.get("ai_system"),
            payload.clarification_answers.get("aiact_ai_system"),
        ),
    }


def _clarifying_questions_for_payload(payload: FactPayload) -> list[dict[str, Any]]:
    signals = _effective_payload_signals(payload)
    questions: list[dict[str, Any]] = []
    if signals["personal_data"] == "unknown":
        questions.append(
            {
                "id": "gdpr_personal_data",
                "regulation": "gdpr",
                "dimension": "material",
                "text": "Does your situation involve processing data about identified or identifiable individuals?",
            }
        )
    if signals["eu_link"] == "unknown":
        questions.append(
            {
                "id": "gdpr_eu_link",
                "regulation": "gdpr",
                "dimension": "territorial",
                "text": "Is your organisation established in the EU, or are you targeting EU-based individuals?",
            }
        )
    if signals["ai_system"] == "unknown":
        questions.append(
            {
                "id": "aiact_ai_system",
                "regulation": "ai_act",
                "dimension": "material",
                "text": "Does this situation involve an AI system using ML, statistical, or logic-based techniques?",
            }
        )
    return questions


def _select_extracted_facts(
    proposed: dict[str, Any],
    selected_fact_ids: Optional[list[int]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    items = [dict(item) for item in (proposed.get("proposed_fact_items") or [])]
    selected_ids = {int(x) for x in (selected_fact_ids or [])}
    use_all = selected_fact_ids is None
    selected_facts: list[dict[str, Any]] = []
    for item in items:
        selected = use_all or int(item.get("id") or 0) in selected_ids
        item["selected"] = selected
        if selected:
            selected_facts.append(
                {
                    "predicate": str(item.get("predicate") or ""),
                    "args": [str(x) for x in (item.get("args") or [])],
                }
            )
    return selected_facts, items


def _build_fact_payload(
    *,
    situation: str,
    proposed: dict[str, Any],
    clarification_answers: dict[str, str],
    selected_fact_ids: Optional[list[int]],
) -> tuple[FactPayload, list[dict[str, Any]], Optional[dict[str, Any]]]:
    extracted_facts, items = _select_extracted_facts(proposed, selected_fact_ids)
    clarified_facts = clarification_facts_for_answers(
        case_id=str(proposed.get("case_id") or ""),
        answers=clarification_answers,
    )
    if (
        clarification_answers.get("aiact_ai_system") == "yes"
        and any(f.get("predicate") == "employment_social_security_law_basis" for f in extracted_facts)
    ):
        clarified_facts.append(
            {
                "predicate": "high_risk_ai_use_case",
                "args": [str(proposed.get("case_id") or "")],
                "source": "clarification",
                "status": "confirmed",
            }
        )
    payload = FactPayload(
        case_id=str(proposed.get("case_id") or ""),
        raw_text=situation,
        extracted_facts=extracted_facts,
        clarified_facts=clarified_facts,
        clarification_answers={k: str(v) for k, v in clarification_answers.items()},
        signals=dict(proposed.get("signals") or {}),
        active_phases=derive_in_force_phases(),
    )
    scenario_record = upsert_scenario(
        payload.case_id,
        facts=[
            {
                "predicate": fact.get("predicate"),
                "args": fact.get("args") or [],
                "source": fact.get("source", "payload"),
                "status": fact.get("status", "selected"),
            }
            for fact in payload.extracted_facts + payload.clarified_facts
        ],
    )
    return payload, items, scenario_record


def _run_reason_core(
    terms: list[str],
    raw_facts: list[dict[str, Any]],
    profile: str,
    legal: Optional[dict[str, Any]] = None,
    playbook: Optional[dict[str, Any]] = None,
    scope_signals: Optional[dict[str, str]] = None,
) -> ReasonResponse:
    try:
        supported_regulations = list(load_regulations())
    except Exception:  # noqa: BLE001
        supported_regulations = []
    if legal is None or playbook is None:
        legal, playbook = _fetch_legal_playbook(terms)

    applicability: Optional[dict[str, Any]] = None
    instrument_evaluations: list[dict[str, Any]] = []
    missing_facts: list[str] = []
    follow_up_questions: list[str] = []

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
        reasoning = run_scope_applicability(
            normalized,
            prefer_souffle=os.environ.get("REASON_USE_SOUFFLE", "").lower()
            in ("1", "true", "yes"),
        )
        if reasoning.get("ok"):
            outputs = reasoning.get("outputs") or {}
            applicability = build_applicability_report(outputs)
            phase_c = analyse_phase_c_scope(normalized, outputs, signals=scope_signals)
            instrument_evaluations = phase_c["instrument_evaluations"]
            missing_facts = phase_c["missing_facts"]
            follow_up_questions = phase_c["follow_up_questions"]
    elif profile == "legacy_gdpr_r14":
        reasoning = run_souffle_golden(normalized)
    else:
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
        instrument_evaluations=instrument_evaluations,
        missing_facts=missing_facts,
        follow_up_questions=follow_up_questions,
        supported_regulations=supported_regulations,
    )


def _split_scope_tags(raw: Any) -> list[str]:
    text = str(raw or "").strip()
    if not text:
        return []
    out: list[str] = []
    for part in text.split(";"):
        tag = part.strip().upper()
        if tag and tag not in out:
            out.append(tag)
    return out


def _build_rule_catalog() -> RuleCatalogResponse:
    citations = load_citations()
    rules = load_rules_index()
    grouped_rules: dict[str, list[dict[str, Any]]] = {}
    for row in rules:
        plid = str(row.get("provision_long_id") or "").strip()
        if not plid:
            continue
        grouped_rules.setdefault(plid, []).append(row)

    provision_ids = sorted(set(citations.keys()) | set(grouped_rules.keys()))
    provisions: list[RuleCatalogProvision] = []
    for plid in provision_ids:
        cite = citations.get(plid) or {}
        reg = str(
            cite.get("regulation")
            or (
                grouped_rules.get(plid, [{}])[0].get("regulation")
                if grouped_rules.get(plid)
                else ""
            )
            or ""
        ).strip()
        scope_tags = _split_scope_tags(cite.get("scope_tag"))
        for row in grouped_rules.get(plid, []):
            for tag in _split_scope_tags(row.get("scope_tag")):
                if tag not in scope_tags:
                    scope_tags.append(tag)
        provisions.append(
            RuleCatalogProvision(
                provision_long_id=plid,
                provision_id=str(cite.get("provision_id") or "").strip() or None,
                regulation=reg,
                type=str(cite.get("type") or "").strip() or None,
                scope_tags=scope_tags,
                title=str(cite.get("title") or "").strip() or None,
                text=str(cite.get("text") or "").strip() or None,
                datalog_rule=str(cite.get("datalog_rule") or "").strip() or None,
                rules=[
                    RuleCatalogRule(
                        rule_text=str(row.get("rule_text") or ""),
                        head_atom=str(row.get("head_atom") or ""),
                        head_predicate=str(row.get("head_predicate") or ""),
                        scope_tag=str(row.get("scope_tag") or ""),
                        body_atoms=[
                            str(atom)
                            for atom in (row.get("body_atoms") or [])
                            if str(atom).strip()
                        ],
                        source_type=str(row.get("source_type") or ""),
                    )
                    for row in grouped_rules.get(plid, [])
                ],
            )
        )

    provisions.sort(
        key=lambda row: (
            row.regulation,
            row.type or "",
            row.provision_long_id,
        )
    )
    return RuleCatalogResponse(
        supported_regulations=list(load_regulations()),
        provisions=provisions,
    )


@app.post("/api/ask", response_model=AskResponse)
def ask(body: AskBody) -> AskResponse:
    terms = terms_from_question(body.question)
    legal, playbook = _fetch_legal_playbook(terms)
    return AskResponse(terms_used=terms, legal=legal, playbook=playbook)


@app.post("/api/reason", response_model=ReasonResponse)
def reason(body: ReasonBody) -> ReasonResponse:
    q = (body.question or "").strip()
    terms = terms_from_question(q) if q else []
    raw_facts = [f.model_dump() for f in body.facts]
    return _run_reason_core(terms, raw_facts, body.profile)


@app.post("/api/applicability-flow", response_model=ApplicabilityFlowResponse)
def applicability_flow(body: ApplicabilityFlowBody) -> ApplicabilityFlowResponse:
    situation = body.situation.strip()
    terms = terms_from_question(situation)
    legal, playbook = _fetch_legal_playbook(
        terms, playbook_company_id=body.playbook_company_id
    )
    proposed = propose_scope_facts(
        situation,
        legal.get("matches") or [],
        playbook.get("matches") or [],
        case_id=body.case_id,
    )
    payload, selected_items, scenario_record = _build_fact_payload(
        situation=situation,
        proposed=proposed,
        clarification_answers=body.clarification_answers,
        selected_fact_ids=body.selected_fact_ids,
    )
    effective_signals = _effective_payload_signals(payload)
    questions = _clarifying_questions_for_payload(payload)
    cites = bucket_legal_matches(legal.get("matches") or [])
    compatibility_facts = compatibility_facts_for_payload(
        case_id=payload.case_id,
        regulations=list(load_regulations()),
        personal_data_signal=effective_signals["personal_data"],
        eu_link_signal=effective_signals["eu_link"],
        active_phases=payload.active_phases,
    )
    core = _run_reason_core(
        terms,
        compatibility_facts,
        "scope_applicability",
        legal,
        playbook,
        scope_signals=effective_signals,
    )
    universal = run_universal_reasoner(
        payload.all_facts,
        case_id=payload.case_id,
        active_phases=payload.active_phases,
        signals=effective_signals,
    )
    return ApplicabilityFlowResponse(
        **{
            **core.model_dump(),
            "situation": situation,
            "case_id": payload.case_id,
            "proposed_fact_items": selected_items,
            "graph_citations": cites,
            "extractor_notes": proposed["extractor_notes"],
            "scenario_record": scenario_record,
            "clarifying_questions": questions,
            "clarification_required": bool(questions),
            "fact_payload": payload.to_dict(),
            "universal": universal,
        }
    )


@app.get("/api/playbook-companies")
def get_playbook_companies() -> dict[str, Any]:
    """List selectable company playbooks (Vaisala, Iloq, Atlas Copco, …)."""
    companies = list_playbook_companies()
    pb_ok = False
    pb_err: str | None = None
    try:
        drv = get_playbook_driver()
        drv.verify_connectivity()
        pb_ok = True
    except Exception as exc:
        pb_err = str(exc)[:200]
    return {"companies": companies, "connected": pb_ok, "error": pb_err}


@app.get("/api/corpus-status")
def get_corpus_status() -> dict[str, Any]:
    return corpus_status()


@app.get("/api/rule-catalog", response_model=RuleCatalogResponse)
def get_rule_catalog() -> RuleCatalogResponse:
    return _build_rule_catalog()


@app.post("/api/universal-reason", response_model=UniversalReasonResponse)
def universal_reason(body: UniversalReasonBody) -> UniversalReasonResponse:
    raw_facts = [f.model_dump() for f in body.facts]
    result = run_universal_reasoner(
        raw_facts,
        case_id=body.case_id,
        active_phases=body.active_phases,
        signals=body.signals,
    )
    return UniversalReasonResponse(**result)


class ChatBody(BaseModel):
    session_id: Optional[str] = None
    question: str = Field(..., min_length=1, max_length=8000)
    company_name: Optional[str] = None
    playbook_company_id: Optional[str] = Field(
        None,
        description="Company playbook tenant: vaisala | iloq | atlascopco; omit for none",
    )


@app.post("/api/chat")
def chat(body: ChatBody) -> dict[str, Any]:
    """
    ComplianceTwin chat endpoint.

    Runs the full applicability-flow pipeline (fact extraction, scope check,
    universal Soufflé reasoner) and returns a { narrative, symbolic } envelope
    that the ComplianceTwin React UI renders as rich worksheet cards.
    """
    session_id = (body.session_id or "").strip() or None
    question = body.question.strip()

    mode = classify_chat_mode(question)

    # ── General Q&A mode (no symbolic worksheet recompute) ─────────────
    if mode == "general":
        rule_catalog_resp = _build_rule_catalog()
        general = build_general_answer_from_rule_catalog(
            question=question, rule_catalog_resp=rule_catalog_resp
        )
        assistant_text: str = str(general.get("assistant_text") or "").strip()

        llm_text = generate_general_answer_with_llm(
            question=question, sources=assistant_text
        )
        if llm_text:
            assistant_text = llm_text
            general["assistant_text"] = assistant_text

        session_title = (
            (question[:42] + "…") if len(question) > 42 else question[:42]
        ) or "Explanation"

        return {
            "mode": "general",
            "assistant_text": assistant_text,
            "general": general,
            # keep schema-compatible keys so the existing UI doesn't crash
            "narrative": {
                "verdict_type": "cannot_determine",
                "verdict_line": assistant_text.splitlines()[0][:160]
                if assistant_text
                else "Explanation",
                "full_analysis": assistant_text,
                "session_title": session_title,
            },
            "symbolic": {"applicability_results": {}},
            "fact_payload": {},
            "consolidated_facts": [],
            "clarifying_questions": [],
            "clarification_required": False,
            "graph_citations": {},
            "playbook": {"matches": [], "error": None, "match_count": 0},
            "extractor_notes": [],
        }

    # ── Applicability mode (symbolic worksheet recompute) ───────────────
    terms = terms_from_question(question)
    playbook_company = (body.playbook_company_id or "").strip() or None
    legal, playbook = _fetch_legal_playbook(
        terms, playbook_company_id=playbook_company
    )

    proposed = propose_scope_facts(
        question,
        legal.get("matches") or [],
        playbook.get("matches") or [],
        case_id=session_id,
    )
    payload, selected_items, scenario_record = _build_fact_payload(
        situation=question,
        proposed=proposed,
        clarification_answers={},
        selected_fact_ids=None,
    )
    effective_signals = _effective_payload_signals(payload)
    questions = _clarifying_questions_for_payload(payload)
    cites = bucket_legal_matches(legal.get("matches") or [])
    compatibility_facts = compatibility_facts_for_payload(
        case_id=payload.case_id,
        regulations=list(load_regulations()),
        personal_data_signal=effective_signals["personal_data"],
        eu_link_signal=effective_signals["eu_link"],
        active_phases=payload.active_phases,
    )
    core = _run_reason_core(
        terms,
        compatibility_facts,
        "scope_applicability",
        legal,
        playbook,
        scope_signals=effective_signals,
    )
    universal = run_universal_reasoner(
        payload.all_facts,
        case_id=payload.case_id,
        active_phases=payload.active_phases,
        signals=effective_signals,
    )
    flow_response = {
        **core.model_dump(),
        "situation": question,
        "case_id": payload.case_id,
        "proposed_fact_items": selected_items,
        "graph_citations": cites,
        "extractor_notes": proposed["extractor_notes"],
        "scenario_record": scenario_record,
        "clarifying_questions": questions,
        "clarification_required": bool(questions),
        "fact_payload": payload.to_dict(),
        "universal": universal,
        "legal": legal,
        "playbook": playbook,
    }
    rule_catalog_resp = _build_rule_catalog()
    rule_catalog_list = [p.model_dump() for p in rule_catalog_resp.provisions]

    resp = build_chat_response(
        question=question,
        flow_response=flow_response,
        rule_catalog=rule_catalog_list,
    )
    resp["mode"] = "applicability"
    return resp


@app.get("/api/health")
def health() -> dict[str, Any]:
    """Return connectivity status for all engine/graph components."""
    from logic.corpus import corpus_status as _cs
    from logic.souffle_runner import souffle_available as _sa

    cs = _cs()
    legal_ok = legal_graph_backend() == "local" or bool(
        (os.environ.get("NEO4J_LEGAL_PASSWORD") or "").strip()
    )
    pb_ok: bool | str = False
    try:
        drv = get_playbook_driver()
        drv.verify_connectivity()
        pb_ok = True
    except Exception as exc:
        pb_ok = str(exc)[:120]
    openai_key_set = bool((os.environ.get("OPENAI_API_KEY") or "").strip())
    return {
        "corpus": cs,
        "souffle": _sa(),
        "legal": {"backend": legal_graph_backend(), "ok": legal_ok},
        "playbook": {"ok": pb_ok is True, "error": None if pb_ok is True else pb_ok},
        "llm": {
            "provider": (os.environ.get("LLM_PROVIDER") or "openai").strip() or "openai",
            "openai_configured": openai_key_set,
            "model": (os.environ.get("OPENAI_MODEL") or "gpt-4o-mini").strip(),
        },
    }


_NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
}


def _ui_meta() -> dict[str, Any]:
    index_path = FRONTEND_DIST / "index.html"
    if not index_path.is_file():
        return {
            "ui": "missing",
            "message": "Run: make frontend",
            "dist_index": str(index_path),
        }
    text = index_path.read_text(encoding="utf-8")
    js_match = re.search(r'/assets/(index-[^"]+\.js)', text)
    return {
        "ui": "compliance_twin",
        "dist_index": str(index_path),
        "js_bundle": js_match.group(1) if js_match else None,
        "legacy_url": "/legacy",
    }


@app.get("/api/ui-meta")
def ui_meta() -> dict[str, Any]:
    """Tell the browser which UI build is active (debug stale-cache issues)."""
    return _ui_meta()


@app.get("/")
def index() -> FileResponse:
    """Serve ComplianceTwin React build only (no silent fallback to static/)."""
    workbench = FRONTEND_DIST / "index.html"
    if workbench.is_file():
        headers = {
            **_NO_CACHE_HEADERS,
            "X-ComplianceTwin-UI": "dist",
        }
        meta = _ui_meta()
        if meta.get("js_bundle"):
            headers["X-ComplianceTwin-JS"] = str(meta["js_bundle"])
        return FileResponse(workbench, headers=headers)
    from fastapi.responses import HTMLResponse

    return HTMLResponse(
        "<h1>ComplianceTwin UI not built</h1>"
        "<p>Run <code>make frontend</code> then restart the server.</p>"
        "<p>Old UI (legacy) is only at <a href='/legacy'>/legacy</a>.</p>",
        status_code=503,
        headers=_NO_CACHE_HEADERS,
    )


@app.get("/legacy")
def legacy_ui() -> FileResponse:
    """Old single-page Compliance Checker (static/index.html)."""
    return FileResponse(STATIC_DIR / "index.html")
