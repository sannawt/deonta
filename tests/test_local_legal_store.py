from logic.local_legal_store import (
    fetch_local_legal_matches,
    legal_graph_backend,
    local_legal_available,
    resolve_legal_csv_dir,
)


def test_local_legal_data_present():
    assert local_legal_available()
    assert resolve_legal_csv_dir().is_dir()
    assert legal_graph_backend() == "local"


def test_gdpr_personal_data_search():
    matches = fetch_local_legal_matches(
        ["gdpr", "personal", "data", "processing"]
    )
    assert len(matches) > 0
    assert all(m.get("id") for m in matches)
    blob = " ".join(
        str(v)
        for m in matches
        for v in (m.get("properties") or {}).values()
    ).lower()
    assert "personal" in blob or "gdpr" in blob
