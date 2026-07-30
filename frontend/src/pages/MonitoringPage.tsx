import { useEffect, useState } from "react";
import { fetchCorpusStatus } from "../lib/api";
import { ThinkingSpinner } from "../components/ui/ThinkingSpinner";
import { ReportsPage } from "./ReportsPage";
import type { ProductRecord } from "../lib/productStore";

interface Props {
  products: ProductRecord[];
  initialTab?: "monitoring" | "reports";
}

export function MonitoringPage({ products, initialTab = "monitoring" }: Props) {
  const [tab, setTab] = useState<"monitoring" | "reports">(initialTab);
  const [corpus, setCorpus] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setLoading(true);
    fetchCorpusStatus()
      .then(setCorpus)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="ct-page ct-app-page">
      <header className="ct-app-page-header ct-monitoring-header">
        <h1 className="ct-dashboard-title">Monitoring</h1>
        <div className="ct-monitoring-tabs" role="tablist" aria-label="Monitoring views">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "monitoring"}
            className={`ct-monitoring-tab${tab === "monitoring" ? " ct-monitoring-tab--active" : ""}`}
            onClick={() => setTab("monitoring")}
          >
            Monitoring
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "reports"}
            className={`ct-monitoring-tab${tab === "reports" ? " ct-monitoring-tab--active" : ""}`}
            onClick={() => setTab("reports")}
          >
            Reports
          </button>
        </div>
      </header>

      {tab === "reports" ? (
        <ReportsPage products={products} embedded />
      ) : (
        <>
          {error && <div className="err">{error}</div>}

          <section className="ct-panel ct-monitoring-panel">
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
          </section>

          <section className="ct-panel ct-monitoring-panel" style={{ marginTop: 20 }}>
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
          </section>
        </>
      )}
    </div>
  );
}
