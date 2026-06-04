import { useEffect, useState } from "react";
import { fetchCorpusStatus } from "../lib/api";
import { ThinkingSpinner } from "../components/ui/ThinkingSpinner";
import type { ProductRecord } from "../lib/productStore";

interface Props {
  products: ProductRecord[];
}

export function MonitoringPage({ products }: Props) {
  const [corpus, setCorpus] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchCorpusStatus()
      .then(setCorpus)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="ct-page">
      <h1 className="ct-page-title">Monitoring</h1>
      <p className="ct-page-sub">Track whether product records may be stale vs the current rules corpus.</p>

      {error && <div className="err">{error}</div>}

      <div className="ct-block">
        <h2 className="ct-card-title">Corpus status</h2>
        {loading ? (
          <ThinkingSpinner active label="Loading corpus status…" size={44} />
        ) : corpus ? (
          <pre className="text-xs" style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(corpus, null, 2)}
          </pre>
        ) : (
          <div className="empty">No corpus data.</div>
        )}
      </div>

      <div className="ct-block" style={{ marginTop: 32 }}>
        <h2 className="ct-card-title">Product snapshots</h2>
        {products.length === 0 ? (
          <div className="empty">No product records yet.</div>
        ) : (
          <table className="ct-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Last assessed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.label}</td>
                  <td>
                    {p.lastAssessment
                      ? new Date(p.lastAssessment.created_at).toLocaleString()
                      : "—"}
                  </td>
                  <td>
                    {p.lastAssessment
                      ? corpus?.ready === false
                        ? "Re-run recommended"
                        : "Current"
                      : "No assessment"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
