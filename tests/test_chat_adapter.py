"""
Tests for logic/chat_adapter.py.

Verifies that build_chat_response correctly maps
universal.evaluations → ComplianceTwin trace rows and narrative.
"""

from logic.chat_adapter import build_chat_response, _ct_verdict, _dim_result

# ── Unit: verdict mapping ──────────────────────────────────────────────────

def test_ct_verdict_mapping():
    assert _ct_verdict("in_scope")          == "applies"
    assert _ct_verdict("out_of_scope")      == "does_not_apply"
    assert _ct_verdict("excluded")          == "does_not_apply"
    assert _ct_verdict("needs_clarification") == "cannot_determine"
    assert _ct_verdict("unknown_whatever")  == "cannot_determine"


def test_dim_result_mapping():
    assert _dim_result("pass")             == "pass"
    assert _dim_result("fail")             == "fail"
    assert _dim_result("skipped")          == "not_reached"
    assert _dim_result("cannot_determine") == "cannot_determine"


# ── Fixture helpers ────────────────────────────────────────────────────────

def _make_eval(verdict: str, reg: str = "gdpr") -> dict:
    dim_status = {
        "in_scope":            {"temporal": "pass", "territorial": "pass", "material": "pass", "exclusions": "pass"},
        "out_of_scope":        {"temporal": "pass", "territorial": "fail", "material": "pass", "exclusions": "pass"},
        "needs_clarification": {"temporal": "pass", "territorial": "pass", "material": "cannot_determine", "exclusions": "pass"},
        "excluded":            {"temporal": "pass", "territorial": "pass", "material": "pass", "exclusions": "fail"},
    }.get(verdict, {"temporal": "pass", "territorial": "pass", "material": "pass", "exclusions": "pass"})

    return {
        "regulation": reg,
        "verdict": verdict,
        "indication": "yes" if verdict == "in_scope" else "partial" if verdict == "needs_clarification" else "no",
        "reason": "",
        "blocked_on": None,
        "skip_further": [],
        "headline": f"{reg.upper()} — test headline",
        "derived": {
            "in_force": True,
            "material": dim_status["material"] == "pass",
            "territorial": dim_status["territorial"] == "pass",
            "excluded": dim_status["exclusions"] == "fail",
            "applies": verdict == "in_scope",
            "high_risk_ai": False,
            "active_phases": ["phase_1"],
        },
        "dimension_statuses": dim_status,
        "scope_sections": [
            {"id": "temporal",    "label": "Temporal scope"},
            {"id": "territorial", "label": "Territorial scope"},
            {"id": "material",    "label": "Material scope"},
            {"id": "exclusions",  "label": "Exclusions"},
        ],
        "final_conclusion_label": "APPLIES" if verdict == "in_scope" else "N/A",
        "actors": ["controller"],
        "territorial_links": [],
        "missing_atoms": ["personal_data(scenario_1, helsinki_company)"] if verdict == "needs_clarification" else [],
    }


def _make_flow_response(evals: list, clarification_required: bool = False) -> dict:
    return {
        "universal": {
            "evaluations": evals,
            "provenance": {"groups": []},
        },
        "fact_payload": {
            "all_facts": [
                {"predicate": "controller", "args": ["scenario_1", "fi"], "status": "extracted", "source": "scenario"},
            ],
        },
        "clarification_required": clarification_required,
        "clarifying_questions": [
            {"text": "Does the system process personal data?", "missing_atom": "personal_data(scenario_1, helsinki_company)"}
        ] if clarification_required else [],
        "playbook": {"matches": [], "error": None, "match_count": 0},
        "case_id": "test-session-001",
        "graph_citations": {},
        "extractor_notes": [],
    }


# ── build_chat_response integration ───────────────────────────────────────

def test_applies_narrative():
    flow = _make_flow_response([_make_eval("in_scope", "gdpr")])
    result = build_chat_response(question="Test HR platform in Finland", flow_response=flow, rule_catalog=[])
    assert result["narrative"]["verdict_type"] == "applies"
    assert "GDPR" in result["narrative"]["verdict_line"]


def test_does_not_apply_narrative():
    flow = _make_flow_response([_make_eval("out_of_scope", "gdpr")])
    result = build_chat_response(question="US-only service", flow_response=flow, rule_catalog=[])
    assert result["narrative"]["verdict_type"] == "does_not_apply"


def test_cannot_determine_narrative():
    flow = _make_flow_response(
        [_make_eval("needs_clarification", "gdpr")],
        clarification_required=True,
    )
    result = build_chat_response(question="Platform of unclear scope", flow_response=flow, rule_catalog=[])
    assert result["narrative"]["verdict_type"] == "gathering"
    assert result["clarification_required"] is True
    assert len(result["clarifying_questions"]) == 1


def test_trace_rows_present():
    flow = _make_flow_response([_make_eval("in_scope", "gdpr")])
    result = build_chat_response(question="q", flow_response=flow, rule_catalog=[])
    gdpr = result["symbolic"]["applicability_results"].get("GDPR")
    assert gdpr is not None
    assert gdpr["verdict"] == "applies"
    trace = gdpr["trace"]
    dim_names = [t["dimension"] for t in trace]
    assert "temporal" in dim_names
    assert "territorial" in dim_names
    assert "material" in dim_names


def test_trace_rows_cannot_determine():
    flow = _make_flow_response([_make_eval("needs_clarification", "gdpr")], clarification_required=True)
    result = build_chat_response(question="q", flow_response=flow, rule_catalog=[])
    gdpr = result["symbolic"]["applicability_results"]["GDPR"]
    material_row = next(t for t in gdpr["trace"] if t["dimension"] == "material")
    assert material_row["result"] == "cannot_determine"


def test_ai_act_regulation_key():
    flow = _make_flow_response([_make_eval("in_scope", "ai_act")])
    result = build_chat_response(question="q", flow_response=flow, rule_catalog=[])
    keys = list(result["symbolic"]["applicability_results"].keys())
    assert "EU_AI_ACT" in keys


def test_consolidated_facts_present():
    flow = _make_flow_response([_make_eval("in_scope", "gdpr")])
    result = build_chat_response(question="q", flow_response=flow, rule_catalog=[])
    facts = result["consolidated_facts"]
    assert isinstance(facts, list)
    assert len(facts) >= 1
    assert facts[0]["predicate"] == "controller"


def test_session_title_truncated():
    long_q = "A very long question " * 10
    flow = _make_flow_response([_make_eval("in_scope", "gdpr")])
    result = build_chat_response(question=long_q, flow_response=flow, rule_catalog=[])
    assert len(result["narrative"]["session_title"]) <= 45


def test_playbook_error_surfaced():
    flow = _make_flow_response([_make_eval("in_scope", "gdpr")])
    flow["playbook"] = {"matches": [], "error": "AuthError: bad password", "match_count": 0}
    result = build_chat_response(question="q", flow_response=flow, rule_catalog=[])
    assert result["playbook"]["error"] == "AuthError: bad password"


def test_assessment_includes_scope_analysis():
    flow = _make_flow_response(
        [_make_eval("in_scope", "gdpr"), _make_eval("needs_clarification", "ai_act")],
        clarification_required=True,
    )
    flow["universal"]["provenance"] = {
        "by_regulation": {
            "gdpr": [
                {
                    "dimension": "MATERIAL",
                    "kind": "derive",
                    "atom": 'applies("s1", "current", "gdpr")',
                    "provision_long_id": "GDPR_A4.1",
                }
            ],
            "ai_act": [],
        }
    }
    result = build_chat_response(question="HR platform Finland", flow_response=flow, rule_catalog=[])
    assessment = result.get("assessment") or {}
    sa = assessment.get("scope_analysis") or result.get("scope_analysis")
    assert sa is not None
    ids = [i["id"] for i in sa.get("instruments", [])]
    assert "GDPR" in ids
    assert "EU_AI_ACT" in ids


def test_rule_catalog_provisions_in_citations():
    catalog = [
        {
            "provision_long_id": "gdpr:art:4-1",
            "provision_id": "Art. 4(1)",
            "regulation": "gdpr",
            "scope_tags": ["MATERIAL"],
            "title": "Personal data definition",
            "text": "any information relating to an identified person",
            "datalog_rule": None,
            "rules": [],
        }
    ]
    flow = _make_flow_response([_make_eval("in_scope", "gdpr")])
    result = build_chat_response(question="q", flow_response=flow, rule_catalog=catalog)
    gdpr = result["symbolic"]["applicability_results"]["GDPR"]
    material_row = next(t for t in gdpr["trace"] if t["dimension"] == "material")
    # Catalog provision_long_id should appear in citations
    cites = material_row.get("citations", [])
    assert any("gdpr" in c.lower() or "art" in c.lower() for c in cites)
