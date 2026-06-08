#!/usr/bin/env python3
"""CLI: draft Soufflé scope rules for a catalog law code via OpenAI."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from logic.llm_rule_drafter import draft_scope_rules  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Draft scope rules for a law catalog code")
    parser.add_argument("--code", required=True, help="Catalog code, e.g. gpsr, red, cra")
    parser.add_argument(
        "--no-write",
        action="store_true",
        help="Return JSON to stdout without writing rules/drafts/",
    )
    args = parser.parse_args()

    result = draft_scope_rules(args.code, write_files=not args.no_write)
    import json

    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
