"""Per-account assessment product records (filesystem JSON)."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Optional

from logic.account_store import account_dir, ensure_account

PRODUCTS_FILE = "products.json"


def _products_path(account_id: str) -> Path:
    return account_dir(account_id) / PRODUCTS_FILE


def load_account_products(account_id: str) -> list[dict[str, Any]]:
    ensure_account(account_id)
    path = _products_path(account_id)
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    if not isinstance(data, dict) or data.get("version") != 1:
        return []
    products = data.get("products")
    if not isinstance(products, list):
        return []
    return products


def save_account_products(account_id: str, products: list[dict[str, Any]]) -> None:
    ensure_account(account_id)
    path = _products_path(account_id)
    payload = {"version": 1, "products": products, "updated_at": time.time()}
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def get_account_product(account_id: str, product_id: str) -> Optional[dict[str, Any]]:
    for row in load_account_products(account_id):
        if str(row.get("id") or "") == product_id:
            return row
    return None


def upsert_account_product(account_id: str, product: dict[str, Any]) -> dict[str, Any]:
    pid = str(product.get("id") or "").strip()
    if not pid:
        raise ValueError("Product id required")
    products = load_account_products(account_id)
    idx = next((i for i, p in enumerate(products) if str(p.get("id") or "") == pid), -1)
    now = time.time()
    row = {**product, "id": pid, "updated_at": product.get("updated_at") or now}
    if idx >= 0:
        products[idx] = row
    else:
        if not row.get("created_at"):
            row["created_at"] = now
        products.insert(0, row)
    save_account_products(account_id, products)
    return row
