import { useMemo, useState } from "react";
import type { ChatResponse } from "../../types/chat";
import { resolveAssessment } from "../../lib/assessment";
import { FactsSummaryView } from "../workbench/FactsSummary";
import { ScopeAnalysisPanel } from "../workbench/ScopeAnalysisPanel";
import { ProductGraph, buildProductGraph } from "./ProductGraph";
import { AssessmentTable } from "./AssessmentTable";

type Tab = "graph" | "table" | "summary";

interface Props {
  productId: string;
  productLabel: string;
  response: ChatResponse;
}

export function AssessmentResults({ productId, productLabel, response }: Props) {
  const [tab, setTab] = useState<Tab>("graph");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const assessment = resolveAssessment(response);
  const graph = useMemo(
    () => buildProductGraph({ productId, productLabel, response }),
    [productId, productLabel, response]
  );

  return (
    <div className="ct-results">
      <div className="ct-tabs">
        {(["graph", "table", "summary"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`ct-tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "graph" ? "Graph" : t === "table" ? "Table" : "Summary"}
          </button>
        ))}
      </div>

      {tab === "graph" && (
        <ProductGraph model={graph} selectedNodeId={selectedNodeId} onSelect={setSelectedNodeId} />
      )}
      {tab === "table" && <AssessmentTable response={response} />}
      {tab === "summary" && (
        <div className="ct-summary-panel">
          {assessment?.facts && (
            <div className="glass" style={{ padding: 12, borderRadius: 12, marginBottom: 12 }}>
              <div className="text-label">Facts</div>
              <FactsSummaryView facts={assessment.facts} />
            </div>
          )}
          {assessment?.scope_analysis ? (
            <div className="glass" style={{ padding: 12, borderRadius: 12 }}>
              <div className="text-label">Applicability trace</div>
              <ScopeAnalysisPanel scopeAnalysis={assessment.scope_analysis} />
            </div>
          ) : (
            <div className="empty">No scope analysis in this record.</div>
          )}
        </div>
      )}
    </div>
  );
}
