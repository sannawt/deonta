import json
from pathlib import Path

import pytest

from scripts.build_corpus import build_corpus


def test_build_corpus_emits_universal_applies_only(tmp_path: Path):
    xlsx = Path.home() / "Compliance calculator.xlsx"
    if not xlsx.is_file():
        pytest.skip("Workbook not present on this machine")
    summary = build_corpus(xlsx, tmp_path)
    assert summary["errors"] == []

    text = (tmp_path / "corpus.dl").read_text(encoding="utf-8")
    assert "applies(S, T, R) :-" in text
    assert 'regulation_material("gdpr", S) :- gdpr_material(S).' in text
    assert 'regulation_material("ai_act", S) :- ai_act_material(S).' in text
    assert 'applies(S, T, "gdpr")' not in text
    assert 'applies(S, T, "ai_act")' not in text

    regs = json.loads((tmp_path / "regulations.json").read_text(encoding="utf-8"))
    assert regs == ["ai_act", "gdpr"] or regs == ["gdpr", "ai_act"]
