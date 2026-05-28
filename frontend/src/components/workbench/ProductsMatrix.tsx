import { useEffect, useMemo, useState } from "react";
import { fetchProducts, type ProductListRow } from "../../lib/products";

const INSTRUMENTS = [
  { id: "gdpr", label: "GDPR" },
  { id: "ai_act", label: "EU AI Act" },
] as const;

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

interface Props {
  playbookCompanyId?: string;
  onOpenProduct: (productId: string) => void;
}

export function ProductsMatrix({ playbookCompanyId, onOpenProduct }: Props) {
  const [rows, setRows] = useState<ProductListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    fetchProducts(playbookCompanyId)
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load products");
      });
    return () => {
      cancelled = true;
    };
  }, [playbookCompanyId]);

  const products = useMemo(() => rows ?? [], [rows]);

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="card-header" style={{ marginBottom: 10 }}>
        <div className="card-title">Products × instruments</div>
        <div className="card-subtitle">
          Browse saved sessions and (optionally) playbook products. Click a row to open details.
        </div>
      </div>

      {error && <div className="err">{error}</div>}
      {!rows && !error && <div className="empty">Loading products…</div>}

      {rows && (
        <div style={{ overflowX: "auto" }}>
          <table className="worksheet-table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ width: 360 }}>Product</th>
                {INSTRUMENTS.map((i) => (
                  <th key={i.id} style={{ width: 140 }}>
                    {i.label}
                  </th>
                ))}
                <th style={{ width: 220 }}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr>
                  <td colSpan={INSTRUMENTS.length + 2} className="empty">
                    No products yet. Ask a question in chat to create a session product.
                  </td>
                </tr>
              )}
              {products.map((p) => (
                <tr
                  key={p.product_id}
                  style={{ cursor: "pointer" }}
                  onClick={() => onOpenProduct(p.product_id)}
                  title="Open product detail"
                >
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.label}</div>
                    <div className="text-xs text-muted">{p.source === "session" ? "From chat session" : "From playbook"}</div>
                  </td>
                  {INSTRUMENTS.map((i) => (
                    <td key={i.id}>
                      <span className="badge badge-gray">—</span>
                    </td>
                  ))}
                  <td className="text-xs text-muted">{fmtDate(p.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

