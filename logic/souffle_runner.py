import csv
import shutil
import subprocess
import tempfile
from collections import defaultdict
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[1]
SCOPE_APPLICABILITY_DL = REPO / "rules" / "golden" / "scope_applicability.dl"
LEGACY_GDPR_R14_DL = REPO / "rules" / "golden" / "gdpr_r14_recital.dl"


def souffle_available() -> bool:
    return shutil.which("souffle") is not None


def _write_facts(work_dir: Path, facts: list[tuple[str, tuple[str, ...]]]) -> None:
    by_pred: dict[str, list[str]] = defaultdict(list)
    for pred, args in facts:
        by_pred[pred].append("\t".join(args))
    for pred, lines in by_pred.items():
        (work_dir / f"{pred}.facts").write_text("\n".join(lines) + "\n", encoding="utf-8")


def _read_output_csv(out_dir: Path, relation: str) -> list[list[str]]:
    p = out_dir / f"{relation}.csv"
    if not p.is_file():
        return []
    rows: list[list[str]] = []
    with p.open(newline="", encoding="utf-8") as f:
        for row in csv.reader(f):
            rows.append(row)
    return rows


def _run_souffle(
    program_source: Path,
    facts: list[tuple[str, tuple[str, ...]]],
    output_relations: list[str],
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "ok": False,
        "skipped": False,
        "message": None,
        "outputs": {},
        "stderr": "",
        "stdout": "",
        "program": str(program_source.relative_to(REPO)),
    }
    if not souffle_available():
        result["skipped"] = True
        result["message"] = "Soufflé not installed (brew install souffle)"
        return result

    if not program_source.is_file():
        result["message"] = f"missing {program_source}"
        return result

    with tempfile.TemporaryDirectory(prefix="souffle_") as tmp:
        work = Path(tmp)
        out_dir = work / "out"
        out_dir.mkdir()
        _write_facts(work, facts)
        program = work / "program.dl"
        program.write_text(program_source.read_text(encoding="utf-8"), encoding="utf-8")

        cmd = [
            "souffle",
            str(program),
            "-F",
            str(work),
            "-D",
            str(out_dir),
        ]
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
        result["stdout"] = proc.stdout or ""
        result["stderr"] = proc.stderr or ""
        if proc.returncode != 0:
            result["message"] = f"souffle exit {proc.returncode}"
            return result

        for rel in output_relations:
            result["outputs"][rel] = _read_output_csv(out_dir, rel)
        result["ok"] = True
        result["message"] = "ok"
    return result


def run_scope_applicability(
    facts: list[tuple[str, tuple[str, ...]]],
) -> dict[str, Any]:
    """Applicability check: material, territorial, temporal, exclusion → law_applies."""
    return _run_souffle(
        SCOPE_APPLICABILITY_DL,
        facts,
        [
            "material_scope_ok",
            "territorial_scope_ok",
            "temporal_scope_ok",
            "excluded",
            "law_applies",
        ],
    )


def run_souffle_golden(
    facts: list[tuple[str, tuple[str, ...]]],
) -> dict[str, Any]:
    """Legacy GDPR R14 recital fragment (narrow demo)."""
    return _run_souffle(
        LEGACY_GDPR_R14_DL,
        facts,
        ["gdpr_protects", "not_personal_data", "recital_principle"],
    )
