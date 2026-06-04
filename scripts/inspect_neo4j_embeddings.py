#!/usr/bin/env python3
"""Print Neo4j legal graph embedding metadata (no raw vectors)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from dotenv import load_dotenv

load_dotenv(REPO / ".env")
load_dotenv(REPO / ".env.local", override=True)

from logic.neo4j_embedding_discovery import discover_embedding_profile, discover_regulation_linkage
from main import get_legal_driver, resolve_aura_database
import os


def main() -> int:
    uri = (os.environ.get("NEO4J_LEGAL_URI") or os.environ.get("NEO4J_URI") or "").strip()
    if not uri:
        print("NEO4J_LEGAL_URI not set", file=sys.stderr)
        return 1
    driver = get_legal_driver()
    database = resolve_aura_database(uri, "NEO4J_LEGAL_DATABASE")

    def session_runner(cypher: str, params: dict) -> list:
        with driver.session(database=database) as session:
            return [r.data() for r in session.run(cypher, **params)]

    profile = discover_embedding_profile(session_runner)
    linkage = discover_regulation_linkage(session_runner)
    out = {"embedding_profile": profile, "regulation_linkage": linkage}
    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
