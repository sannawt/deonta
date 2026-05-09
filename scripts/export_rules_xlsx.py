#!/usr/bin/env python3
"""
Export ComplianceCalculatorRules.xlsx → JSON schemas under schemas/ and
Soufflé-oriented bundles under rules/.

Usage:
  python scripts/export_rules_xlsx.py [path/to/ComplianceCalculatorRules.xlsx]

Default xlsx path: ../Desktop/ComplianceCalculatorRules.xlsx relative to repo root,
or set COMPLIANCE_RULES_XLSX.

Workbook notation (cells) is normalized for Soufflé-ish output:
  - rule implication:  <=  →  :-
  - conjunction:      &  →  ,
  - line comments:      %  →  //
  - ensure each rule line ends with '.'
"""
from __future__ import annotations

import argparse
import json
import os
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

try:
    import openpyxl
except ImportError as e:  # pragma: no cover
    raise SystemExit("Install openpyxl: pip install openpyxl") from e

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_XLSX = Path.home() / "Desktop" / "ComplianceCalculatorRules.xlsx"


def trim_rows(rows: list[tuple[Any, ...]]) -> list[tuple[Any, ...]]:
    while rows and all(v is None or (isinstance(v, str) and not v.strip()) for v in rows[-1]):
        rows.pop()
    return rows


def sheet_as_dicts(ws: Any) -> list[dict[str, Any]]:
    raw = list(ws.iter_rows(values_only=True))
    raw = trim_rows(raw)
    if not raw:
        return []
    headers = [str(h).strip() if h is not None else "" for h in raw[0]]
    # drop trailing empty header names from Excel padding
    while headers and not headers[-1]:
        headers.pop()
    out: list[dict[str, Any]] = []
    for row in raw[1:]:
        if row is None or all(c is None or (isinstance(c, str) and not str(c).strip()) for c in row):
            continue
        d: dict[str, Any] = {}
        for i, name in enumerate(headers):
            if not name:
                continue
            val = row[i] if i < len(row) else None
            if isinstance(val, float) and val == int(val):
                val = int(val)
            d[name] = val
        out.append(d)
    return out


def normalize_datalog_cell(text: str | None) -> str:
    if not text or not str(text).strip():
        return ""
    lines = []
    for line in str(text).splitlines():
        s = line.rstrip()
        if not s.strip():
            lines.append("")
            continue
        if s.lstrip().startswith("%"):
            idx = s.index("%")
            s = s[:idx] + "//" + s[idx + 1 :]
        if "<=" in s and "->" not in s:  # avoid touching Unicode arrows
            s = s.replace("<=", ":-")
        s = re.sub(r"\s*&\s*", ", ", s)
        if s.strip() and not s.strip().startswith("//"):
            st = s.strip()
            if ":-" in st:
                if not st.endswith("."):
                    s = s.rstrip() + "."
            elif re.match(r"^[A-Za-z_][A-Za-z0-9_]*\s*\(", st) and not st.endswith("."):
                # ground fact / nullary-style atom without body
                s = s.rstrip() + "."
        lines.append(s)
    return "\n".join(lines).rstrip() + ("\n" if lines else "")


def head_predicate_arity(line: str) -> tuple[str, int] | None:
    """Parse `pred(A,B,...)` at start of a Soufflé rule line."""
    line = line.strip()
    if line.startswith("//") or not line:
        return None
    m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*\(", line)
    if not m:
        return None
    name = m.group(1)
    depth = 0
    start = line.index("(")
    for i, ch in enumerate(line[start:], start):
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                inner = line[start + 1 : i]
                if not inner.strip():
                    return name, 0
                arity = 1 + inner.count(",")
                return name, arity
    return None


def collect_heads_from_datalog(datalog: str) -> dict[str, int]:
    """Map predicate name → max arity seen in rule heads."""
    seen: dict[str, int] = defaultdict(int)
    for line in datalog.splitlines():
        if ":-" not in line or line.strip().startswith("//"):
            continue
        head = line.split(":-", 1)[0].strip()
        parsed = head_predicate_arity(head)
        if parsed:
            name, ar = parsed
            seen[name] = max(seen[name], ar)
    return dict(seen)


def build_declarations(
    required_rows: list[dict[str, Any]], rule_heads: dict[str, int]
) -> str:
    arities: dict[str, int] = {}
    for row in required_rows:
        pred = row.get("predicate")
        if pred is None:
            continue
        p = str(pred).strip()
        if not p:
            continue
        ar = row.get("arity")
        try:
            arities[p] = int(float(ar)) if ar is not None else 0
        except (TypeError, ValueError):
            arities[p] = 0
    for name, ar in rule_heads.items():
        arities[name] = max(arities.get(name, 0), ar)
    lines = [
        "// Auto-generated predicate declarations (all arguments: symbol).",
        "// Edit the workbook and re-run scripts/export_rules_xlsx.py",
        "",
    ]
    for name in sorted(arities.keys()):
        n = max(0, arities[name])
        args = ", ".join(f"v{i}: symbol" for i in range(n))
        inner = f"({args})" if args else "()"
        lines.append(f".decl {name}{inner}")
    lines.append("")
    return "\n".join(lines)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "xlsx",
        nargs="?",
        default=None,
        help="Path to ComplianceCalculatorRules.xlsx (default: $COMPLIANCE_RULES_XLSX or ~/Desktop/...)",
    )
    ap.add_argument(
        "--repo",
        type=Path,
        default=REPO_ROOT,
        help="Repository root (default: parent of scripts/)",
    )
    args = ap.parse_args()
    repo: Path = args.repo
    xlsx = (
        Path(args.xlsx).expanduser().resolve()
        if args.xlsx
        else Path(os.environ.get("COMPLIANCE_RULES_XLSX", str(DEFAULT_XLSX))).expanduser().resolve()
    )
    if not xlsx.is_file():
        raise SystemExit(f"Workbook not found: {xlsx}")

    wb = openpyxl.load_workbook(xlsx, data_only=True)

    articles = sheet_as_dicts(wb["Articles + Rules"])
    required = sheet_as_dicts(wb["Required facts"])
    nodes = sheet_as_dicts(wb["Nodes"])
    rels = sheet_as_dicts(wb["Relationships"])
    props = sheet_as_dicts(wb["Properties"])
    legend = sheet_as_dicts(wb["Legend"])
    wb.close()

    schemas = repo / "schemas"
    rules_dir = repo / "rules"
    frag_dir = rules_dir / "datalog_fragments"
    frag_dir.mkdir(parents=True, exist_ok=True)

    write_json(schemas / "required_facts.json", required)
    write_json(schemas / "articles_rules.json", articles)
    write_json(schemas / "nodes.json", nodes)
    write_json(schemas / "relationships.json", rels)
    write_json(schemas / "properties.json", props)
    write_json(schemas / "legend.json", legend)

    manifest: list[dict[str, Any]] = []
    all_heads: dict[str, int] = {}
    bundle_parts: list[str] = [
        "// Merged Datalog rules exported from Articles + Rules (normalized for Soufflé).",
        "// Source: " + str(xlsx),
        "",
    ]

    for row in articles:
        pid = row.get("provision_id")
        plid = row.get("provision_long_id")
        raw_dl = row.get("datalog_rule")
        norm = normalize_datalog_cell(raw_dl if isinstance(raw_dl, str) else "")
        slug = str(plid or pid or "unknown").strip()
        safe = re.sub(r"[^a-zA-Z0-9_.-]+", "_", slug)[:120]
        frag_path = frag_dir / f"{safe}.dl"
        frag_path.write_text(
            f"// provision_long_id={plid} provision_id={pid}\n{norm}\n",
            encoding="utf-8",
        )
        heads = collect_heads_from_datalog(norm)
        for k, v in heads.items():
            all_heads[k] = max(all_heads.get(k, 0), v)
        manifest.append(
            {
                "provision_id": pid,
                "provision_long_id": plid,
                "regulation": row.get("regulation"),
                "type": row.get("type"),
                "number": row.get("number"),
                "scope_tag": row.get("scope_tag"),
                "datalog_fragment_file": str(frag_path.relative_to(repo)),
            }
        )
        bundle_parts.append(f"// ---- {slug} ({row.get('regulation')}) ----")
        bundle_parts.append(norm)
        bundle_parts.append("")

    write_json(rules_dir / "manifest.json", manifest)

    decl_text = build_declarations(required, all_heads)
    (rules_dir / "predicate_decls.dl").write_text(decl_text, encoding="utf-8")

    bundle = "\n".join(bundle_parts)
    (rules_dir / "datalog_rules_exported.dl").write_text(bundle, encoding="utf-8")

    combined = decl_text + "\n// ---- rules (same as datalog_rules_exported.dl) ----\n\n" + bundle
    (rules_dir / "export_bundle.dl").write_text(combined, encoding="utf-8")

    readme = """# Exported rules (from Excel)

Generated by `scripts/export_rules_xlsx.py`. Re-run after editing the workbook.

## Files

| Path | Content |
|------|---------|
| `../schemas/required_facts.json` | **Required facts** sheet — EDB predicate contract. |
| `../schemas/articles_rules.json` | **Articles + Rules** — full rows including `text`. |
| `../schemas/nodes.json` … | Graph design reference sheets. |
| `manifest.json` | One row per provision → `datalog_fragment_file`. |
| `predicate_decls.dl` | `.decl` for every predicate in Required facts plus rule heads found in fragments. |
| `datalog_fragments/*.dl` | One file per `provision_long_id` with normalized rules. |
| `datalog_rules_exported.dl` | All fragments concatenated. |
| `export_bundle.dl` | Declarations + all rules (single file for Soufflé experiments). |

## Notation normalization

Excel cells use `<=` and `&`; export uses Soufflé-style `:-` and `,`. `%` comments become `//`.

## Soufflé quick test

Requires [Soufflé](https://souffle-lang.org/) installed.

```bash
souffle rules/export_bundle.dl -D /tmp/souffle-out
```

You may need `.input` directives and fact files for extensional predicates before full evaluation succeeds; this export focuses on **schemas + rule text + declarations** so you can iterate on compilation errors.

"""
    (rules_dir / "README.md").write_text(readme, encoding="utf-8")

    print(f"Wrote schemas/ and rules/ from {xlsx}")
    print(f"  articles rows: {len(articles)}, required facts: {len(required)}, fragments: {len(manifest)}")


if __name__ == "__main__":
    main()
