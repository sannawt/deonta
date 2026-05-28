import type { ChatResponse } from "../../types/chat";
import type { ProductRecord } from "../../lib/productStore";
import { resolveAssessment } from "../../lib/assessment";
import { FactsSummaryView } from "../workbench/FactsSummary";
import { ScopeAnalysisPanel } from "../workbench/ScopeAnalysisPanel";
import { ProductGraph, buildProductGraph } from "./ProductGraph";
import { useMemo, useState } from "react";

interface Props {
  product: ProductRecord;
}

export function ProductPage({ product }: Props) {
  const resp: ChatResponse | null = product.lastAssessment?.response ?? null;
  const assessment = resolveAssessment(resp);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const graph = useMemo(
    () =>
      buildProductGraph({
        productId: product.id,
        productLabel: product.label,
        response: resp,
      }),
    [product.id, product.label, resp]
  );

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="card-title font-serif">{product.label}</div>
      <div className="card-subtitle">Record of applicability • authoritative sources + trace</div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 12, alignItems: "start" }}>
        <ProductGraph model={graph} selectedNodeId={selectedNodeId} onSelect={setSelectedNodeId} />

        <div style={{ display: "grid", gap: 12 }}>
          <div className="glass" style={{ padding: 12, borderRadius: 12 }}>
            <div className="text-label">Product spec</div>
            <div className="text-sm" style={{ marginTop: 6 }}>
              {product.spec.summary || "—"}
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 8 }}>
              Signals: personal data {product.spec.processesPersonalData}, EU link {product.spec.euLink}, AI system {product.spec.aiSystem}
            </div>
          </div>

          {assessment?.facts ? (
            <div className="glass" style={{ padding: 12, borderRadius: 12 }}>
              <div className="text-label">Facts</div>
              <div style={{ marginTop: 8 }}>
                <FactsSummaryView facts={assessment.facts} />
              </div>
            </div>
          ) : (
            <div className="empty">No assessment snapshot yet. Run “New assessment”.</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {assessment?.scope_analysis ? (
          <div className="glass" style={{ padding: 12, borderRadius: 12 }}>
            <div className="text-label">Applicability & trace</div>
            <div style={{ marginTop: 8 }}>
              <ScopeAnalysisPanel scopeAnalysis={assessment.scope_analysis} />
            </div>
          </div>
        ) : (
          <div className="empty">No scope analysis available yet for this product snapshot.</div>
        )}
      </div>
    </div>
  );
}

