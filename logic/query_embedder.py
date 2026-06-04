"""Embed user queries with a provider matched to Neo4j stored embedding dimensions."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

from logic.neo4j_embedding_config import EmbeddingProfile, OPENAI_MODEL_DIMENSIONS


def openai_embed_texts(
    texts: list[str],
    *,
    model: str,
    dimensions: int | None = None,
) -> list[list[float]] | None:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key or not texts:
        return None
    base = (os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
    body: dict[str, Any] = {"model": model, "input": texts}
    if dimensions:
        body["dimensions"] = dimensions
    payload = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{base}/embeddings",
        data=payload,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "User-Agent": "compliance-calculator/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())
        items = data.get("data") or []
        items.sort(key=lambda x: x.get("index", 0))
        return [item["embedding"] for item in items if "embedding" in item]
    except (urllib.error.URLError, TimeoutError, KeyError, json.JSONDecodeError, OSError):
        return None


def embed_query(text: str, profile: EmbeddingProfile) -> list[float] | None:
    """Return query vector matching Neo4j embedding dimensions, or None if unavailable."""
    if not profile.usable():
        return None
    query = (text or "").strip()[:8000]
    if not query:
        return None

    if profile.query_provider == "openai" and profile.query_model:
        target_dims = profile.dimensions
        vectors = openai_embed_texts(
            [query],
            model=profile.query_model,
            dimensions=target_dims if target_dims != OPENAI_MODEL_DIMENSIONS.get(profile.query_model) else None,
        )
        if vectors and len(vectors[0]) == target_dims:
            return vectors[0]
        return None

    return None


def embed_query_result(text: str, profile: EmbeddingProfile) -> dict[str, Any]:
    """Metadata about query embedding attempt (no vector in response)."""
    vec = embed_query(text, profile)
    return {
        "embedded": vec is not None,
        "dimensions": len(vec) if vec else 0,
        "provider": profile.query_provider if vec else "",
        "model": profile.query_model if vec else "",
    }
