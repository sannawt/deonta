from logic.legal_db import engine_mode_for, evidence_pack, list_laws


def test_list_laws_includes_gdpr_and_cra():
    codes = {r["code"] for r in list_laws()}
    assert "gdpr" in codes
    assert "cra" in codes
    assert "us_bundle" in codes


def test_engine_mode_symbolic_for_gdpr():
    assert engine_mode_for("gdpr") == "symbolic"


def test_evidence_pack_returns_documents():
    pack = evidence_pack(["gdpr_0"], ["gdpr"])
    assert pack["documents"]
    assert isinstance(pack["related_laws"], list)
