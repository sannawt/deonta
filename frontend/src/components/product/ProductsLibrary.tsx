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
    <div className="ct-block">
      <h2 className="ct-card-title">Products</h2>
      <p className="ct-page-sub" style={{ marginBottom: 20 }}>
        Saved specs and assessment snapshots
      </p>

      <input
        className="input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter products…"
        style={{ width: "100%", marginBottom: 20 }}
      />

      <div className="ct-product-list">
        {filtered.length === 0 && <div className="empty">No products yet. Start the product workflow.</div>}
        {filtered.map((p) => (
          <button
            key={p.id}
            type="button"
            className="ct-list-row"
            onClick={() => onOpen(p.id)}
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

