import { useState } from "react";
import type { ApplicabilityResult } from "../../types/chat";
import { dimBadgeClass, dimLabel, verdictBadgeClass, verdictLabel } from "../../lib/utils";
import { lookupProvision } from "../../lib/ruleCatalog";

const DIM_LABELS: Record<string, string> = {
  temporal:    "Temporal",
  territorial: "Territorial",
  material:    "Material",
  exclusion:   "Exclusion",
  exclusions:  "Exclusion",
  overall:     "Overall",
};

const REG_FULL_NAMES: Record<string, string> = {
  GDPR:       "General Data Protection Regulation",
  EU_AI_ACT:  "EU Artificial Intelligence Act",
  AI_ACT:     "EU Artificial Intelligence Act",
};

interface Props {
  iid: string;
  result: ApplicabilityResult;
}

export function ApplicabilityDimensionCard({ iid, result }: Props) {
  const [open, setOpen] = useState(true);
  const fullName = REG_FULL_NAMES[iid] || iid;
  const dims = result.trace.filter((t) => t.dimension !== "overall");
  const overall = result.trace.find((t) => t.dimension === "overall");

  return (
    <div className="reg-card">
      <button
        type="button"
        className="reg-card-head"
        onClick={() => setOpen((o) => !o)}
        style={{ borderBottom: open ? "1px solid var(--bdr)" : "none" }}
      >
        <span style={{ flex: 1 }}>
          <span className="reg-card-head-title">{iid}</span>
          <span className="reg-card-head-sub">{fullName}</span>
        </span>
        <span className={`badge ${verdictBadgeClass(result.verdict)}`}>
          {verdictLabel(result.verdict)}
        </span>
        {result.risk_category && (
          <span className="badge badge-amber">{result.risk_category.replace(/_/g, " ").toUpperCase()}</span>
        )}
        <span className="text-muted">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 14px 12px" }}>
          {dims.map((dim, i) => (
            <div
              key={i}
              className="dim-row"
              style={{
                background:
                  dim.result === "cannot_determine"
                    ? "var(--amber-l)"
                    : dim.result === "fail"
                    ? "var(--red-l)"
                    : "transparent",
              }}
            >
              <span className="text-sm text-strong" style={{ width: 88, flexShrink: 0 }}>
                {DIM_LABELS[dim.dimension] || dim.dimension}
              </span>
              <span className={`badge ${dimBadgeClass(dim.result)}`}>{dimLabel(dim.result)}</span>
              <span className="text-sm" style={{ flex: 1 }}>{dim.evidence}</span>
              {(dim.citations || []).length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {(dim.citations || []).map((c, ci) => {
                    const prov = lookupProvision(c);
                    const tooltip = prov
                      ? [prov.title, prov.text?.slice(0, 200)].filter(Boolean).join(" — ")
                      : undefined;
                    return (
                      <span
                        key={ci}
                        className="badge badge-blue text-mono"
                        title={tooltip}
                        style={{ cursor: prov ? "help" : "default" }}
                      >
                        {c}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {overall && (
            <div className="dim-row" style={{ marginTop: 6, borderTop: "1px solid var(--bdr)", background: "var(--cloud1)" }}>
              <span className="text-sm text-strong" style={{ width: 88, flexShrink: 0 }}>Verdict</span>
              <span className={`badge ${verdictBadgeClass(result.verdict)}`}>{verdictLabel(result.verdict)}</span>
              <span className="text-sm" style={{ flex: 1 }}>{result.headline}</span>
            </div>
          )}

          {(result.actors || []).length > 0 && (
            <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {result.actors!.map((a, i) => (
                <span key={i} className="badge badge-gray">{a}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
