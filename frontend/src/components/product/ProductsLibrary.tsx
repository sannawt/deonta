import { useMemo, useState } from "react";
import type { ProductRecord } from "../../lib/productStore";

interface Props {
  products: ProductRecord[];
  onOpen: (productId: string) => void;
}

function fmt(ts: number): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

export function ProductsLibrary({ products, onOpen }: Props) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return products;
    return products.filter((p) => (p.label || "").toLowerCase().includes(t));
  }, [products, q]);

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="card-title">Products</div>
      <div className="card-subtitle">Saved product specs and assessment snapshots (local only)</div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter products…"
          style={{ flex: 1 }}
        />
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        {filtered.length === 0 && <div className="empty">No products yet. Run a New assessment first.</div>}
        {filtered.map((p) => (
          <button
            key={p.id}
            type="button"
            className="sess-item"
            onClick={() => onOpen(p.id)}
            style={{ textAlign: "left" }}
          >
            <div className="sb-item-title">{p.label}</div>
            <div className="sb-item-sub">
              Updated {fmt(p.updated_at)} {p.lastAssessment ? "• assessment saved" : "• no assessment yet"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

