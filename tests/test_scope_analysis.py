from logic.scope_analysis import build_scope_analysis


def _applicability():
    return {
        "GDPR": {
            "verdict": "applies",
            "headline": "GDPR applies",
            "missing_atoms": [],
            "trace": [
                {
                    "dimension": "material",
                    "result": "pass",
                    "evidence": "Processing of personal data confirmed.",
                    "citations": ["GDPR_A4.1"],
                },
                {
                    "dimension": "territorial",
                    "result": "pass",
                    "evidence": "EU connection.",
                    "citations": ["GDPR_A3"],
                },
            ],
        },
        "EU_AI_ACT": {
            "verdict": "cannot_determine",
            "headline": "AI Act open",
            "missing_atoms": ['has_feature("x", "machine_based")'],
            "trace": [
                {
                    "dimension": "material",
                    "result": "cannot_determine",
                    "evidence": "AI system not confirmed.",
                    "citations": ["AIAct_A3.1"],
                },
            ],
        },
    }


def _provenance():
    return {
        "by_regulation": {
            "gdpr": [
                {
                    "dimension": "MATERIAL",
                    "kind": "derive",
                    "atom": 'applies("s1", "current", "gdpr")',
                    "provision_long_id": "GDPR_A4.1",
                    "note": "GDPR applies rule",
                },
                {
                    "dimension": "MATERIAL",
                    "kind": "ground",
                    "atom": 'personal_data("s1", "hr")',
                    "provision_long_id": None,
                    "note": "Fact supplied",
                },
            ],
            "ai_act": [
                {
                    "dimension": "MATERIAL",
                    "kind": "gap",
                    "atom": 'has_feature("s1", "machine_based")',
                    "provision_long_id": "AIAct_A3.1",
                    "note": "Not grounded",
                },
            ],
        }
    }


def test_build_scope_analysis_separate_instruments():
    out = build_scope_analysis(
        applicability_results=_applicability(),
        provenance=_provenance(),
        rule_catalog=[
            {
                "provision_long_id": "GDPR_A4.1",
                "title": "Definitions",
                "text": "Personal data means...",
                "rules": [{"rule_text": "applies rule", "head_atom": "applies(S,C,gdpr)"}],
            }
        ],
        question_facts=[{"field": "Personal data", "value": "employees", "predicate": "personal_data"}],
    )
    insts = out["instruments"]
    assert len(insts) == 2
    assert insts[0]["id"] == "GDPR"
    assert insts[1]["id"] == "EU_AI_ACT"
    gdpr_mat = next(d for d in insts[0]["dimensions"] if d["id"] == "material")
    ai_mat = next(d for d in insts[1]["dimensions"] if d["id"] == "material")
    assert gdpr_mat["result"] == "PASS"
    assert ai_mat["result"] == "UNKNOWN"
    assert any(f["kind"] == "missing" for f in ai_mat["decisive_facts"])
    assert gdpr_mat["rules_invoked"][0]["citation"].get("eurlex_url")
    assert gdpr_mat["rules_invoked"][0].get("citation", {}).get("text") or gdpr_mat["rules_invoked"][0].get(
        "citation", {}
    ).get("excerpt")


def test_build_scope_analysis_rules_invoked():
    out = build_scope_analysis(
        applicability_results=_applicability(),
        provenance=_provenance(),
        rule_catalog=[
            {
                "provision_long_id": "GDPR_A4.1",
                "rules": [{"rule_text": "test rule", "head_atom": "applies(X,Y,Z)"}],
            }
        ],
    )
    gdpr = out["instruments"][0]
    mat = next(d for d in gdpr["dimensions"] if d["id"] == "material")
    assert len(mat["rules_invoked"]) >= 1
    assert mat["rules_invoked"][0]["provision_long_id"] == "GDPR_A4.1"


def test_build_scope_analysis_merges_llm_instruments():
    llm_gpsr = {
        "id": "GPSR",
        "label": "GPSR",
        "full_name": "General Product Safety Regulation",
        "reg_key": "gpsr",
        "verdict": "cannot_determine",
        "verdict_display": "Cannot conclude yet",
        "headline": "GPSR scope open",
        "dimensions": [
            {
                "id": "material",
                "label": "Material scope",
                "result": "UNKNOWN",
                "evidence": "",
                "decisive_facts": [],
                "citations": [],
                "rules_invoked": [],
            }
        ],
        "legal_tests": [{"label": "Consumer product on EU market?", "answer": "unknown"}],
        "assessment_source": "llm_assisted",
    }
    out = build_scope_analysis(
        applicability_results=_applicability(),
        provenance=_provenance(),
        rule_catalog=[],
        llm_instruments=[llm_gpsr],
        selected_laws=[
            {"code": "gdpr"},
            {"code": "ai_act"},
            {"code": "gpsr"},
            {"code": "red"},
        ],
    )
    ids = {i["id"] for i in out["instruments"]}
    assert "GDPR" in ids
    assert "EU_AI_ACT" in ids
    assert "GPSR" in ids
    assert "RED" in ids
    gpsr = next(i for i in out["instruments"] if i["id"] == "GPSR")
    assert gpsr["assessment_source"] == "llm_assisted"
    gdpr = next(i for i in out["instruments"] if i["id"] == "GDPR")
    assert gdpr["assessment_source"] == "symbolic"


def test_build_scope_analysis_per_reg_missing_atoms():
    missing = [
        {
            "regulation": "gdpr",
            "dimension": "material",
            "predicate": "processing",
            "example": "processing(case, data)",
            "description": "Is there processing?",
        }
    ]
    out = build_scope_analysis(
        applicability_results=_applicability(),
        provenance=_provenance(),
        rule_catalog=[],
        missing_predicates=missing,
        selected_laws=[{"code": "gdpr"}, {"code": "gpsr"}],
        llm_instruments=[
            {
                "id": "GPSR",
                "label": "GPSR",
                "full_name": "GPSR",
                "reg_key": "gpsr",
                "verdict": "cannot_determine",
                "dimensions": [],
                "assessment_source": "llm_assisted",
            }
        ],
    )
    gdpr = next(i for i in out["instruments"] if i["id"] == "GDPR")
    gpsr = next(i for i in out["instruments"] if i["id"] == "GPSR")
    assert any("processing" in a for a in gdpr.get("missing_atoms") or [])
    assert not any("processing" in a for a in gpsr.get("missing_atoms") or [])
