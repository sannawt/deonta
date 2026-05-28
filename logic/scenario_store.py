from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

_STORE: dict[str, dict[str, Any]] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def upsert_scenario(
    scenario_id: str,
    *,
    facts: list[dict[str, Any]],
    source: str = "user_statement",
    status: str = "candidate",
) -> dict[str, Any]:
    existing = _STORE.get(scenario_id, {"scenario_id": scenario_id, "facts": [], "updated_at": _now()})
    records: list[dict[str, Any]] = []
    for fact in facts:
        pred = str(fact.get("predicate") or "").strip()
        args = [str(x) for x in (fact.get("args") or [])]
        records.append(
            {
                "predicate": pred,
                "args": args,
                "source": fact.get("source", source),
                "status": fact.get("status", status),
                "recorded_at": fact.get("recorded_at", _now()),
            }
        )
    existing["facts"] = records
    existing["updated_at"] = _now()
    _STORE[scenario_id] = existing
    return existing


def append_fact(
    scenario_id: str,
    *,
    predicate: str,
    args: list[str],
    source: str = "human_confirmed",
    status: str = "confirmed",
) -> dict[str, Any]:
    current = _STORE.setdefault(
        scenario_id,
        {"scenario_id": scenario_id, "facts": [], "updated_at": _now()},
    )
    key = (predicate, tuple(args))
    has = any((f.get("predicate"), tuple(f.get("args") or [])) == key for f in current["facts"])
    if not has:
        current["facts"].append(
            {
                "predicate": predicate,
                "args": list(args),
                "source": source,
                "status": status,
                "recorded_at": _now(),
            }
        )
    current["updated_at"] = _now()
    return current


def get_scenario(scenario_id: str) -> dict[str, Any] | None:
    return _STORE.get(scenario_id)


def list_scenarios() -> list[dict[str, Any]]:
    """In-memory list of scenario records (for product knowledge view)."""
    return sorted(
        (dict(v) for v in _STORE.values()),
        key=lambda r: str(r.get("updated_at") or ""),
        reverse=True,
    )


def clear_scenarios() -> None:
    _STORE.clear()
