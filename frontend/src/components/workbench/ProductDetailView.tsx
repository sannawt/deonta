import { useEffect, useState } from "react";
import type { Assessment, ScopeAnalysis } from "../../types/chat";
import { fetchProduct } from "../../lib/products";
import { FactsSummaryView } from "./FactsSummary";
import { ScopeAnalysisPanel } from "./ScopeAnalysisPanel";

function toAssessment(raw: unknown): Assessment | null {
  if (!raw || typeof raw !== "object") return null;
  // Minimal shape for our current backend stub (facts only).
  const a = raw as Partial<Assessment>;
  if (!a.facts) return null;
  return a as Assessment;
}

interface Props {
  productId: string;
  onBack: () => void;
}

export function ProductDetailView({ productId, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState(productId);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [scopeAnalysis, setScopeAnalysis] = useState<ScopeAnalysis | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchProduct(productId)
      .then((p) => {
        if (cancelled) return;
        setLabel(p.label || productId);
        const a = toAssessment(p.assessment ?? null);
        setAssessment(a);
        // If a future backend returns scope_analysis, show it.
        const sa = (a?.scope_analysis ?? null) as ScopeAnalysis | null;
        setScopeAnalysis(sa);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load product");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div className="card-title">{label}</div>
          <div className="card-subtitle">Product knowledge (facts + legal basis + trace)</div>
        </div>
        <button type="button" className="hdr-btn" onClick={onBack}>
          Back
        </button>
      </div>

      {loading && <div className="empty" style={{ marginTop: 12 }}>Loading…</div>}
      {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}

      {!loading && !error && (
        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {assessment?.facts ? (
            <FactsSummaryView facts={assessment.facts} />
          ) : (
            <div className="empty">No saved facts yet for this product.</div>
          )}

          {scopeAnalysis ? (
            <ScopeAnalysisPanel scopeAnalysis={scopeAnalysis} />
          ) : (
            <div className="empty">
              No scope analysis stored for this product yet. Run a chat assessment to generate a full reasoning trace.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

