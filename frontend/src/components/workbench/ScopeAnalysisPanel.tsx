import { useEffect, useState } from "react";
import type { ChatResponse, ScopeAnalysis, ScopeDimension, ScopeInstrument } from "../../types/chat";
import { WorksheetTable } from "../cards/WorksheetTable";
import { stripInternalIds } from "../../lib/utils";

const RESULT_BADGE: Record<string, string> = {
  PASS: "badge-green",
  FAIL: "badge-red",
  UNKNOWN: "badge-amber",
  NOT_REACHED: "badge-gray",
  DEFERRED: "badge-blue",
};

const FACT_KIND_BADGE: Record<string, string> = {
  ground: "badge-green",
  derive: "badge-blue",
  gap: "badge-amber",
  trace_gap: "badge-amber",
  missing: "badge-amber",
  from_question: "badge-green",
  summary: "badge-green",
};

const FACT_KIND_LABEL: Record<string, string> = {
  from_question: "From your question",
  ground: "Supported by facts",
  derive: "Derived by rules",
  gap: "Proof trace gap",
  trace_gap: "Proof trace gap",
  missing: "Still needed",
  summary: "Summary",
};

function ProvisionText({ c }: { c: { excerpt?: string | null; text?: string | null; title?: string | null } }) {
  // Lawyer view should show the actual provision text (not a shortened tooltip excerpt).
  const body = c.text || c.excerpt;
  if (!body) return null;
  return (
    <blockquote className="scope-provision-text">
      {c.title && <div className="scope-provision-text-title">{c.title}</div>}
      {body}
    </blockquote>
  );
}

function dedupeCitations<T extends { provision_long_id?: string; label?: string }>(items: T[]): T[] {
  const out: T[] = [];
  const seen: Set<string> = new Set();
  for (const item of items || []) {
    const key = String(item.provision_long_id || item.label || "").trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function CitationChip({ c }: { c: { label: string; eurlex_url?: string | null; display?: string; excerpt?: string | null } }) {
  const title = [c.display || c.label, c.excerpt].filter(Boolean).join(" — ");
  if (c.eurlex_url) {
    return (
      <a
        href={c.eurlex_url}
        target="_blank"
        rel="noopener noreferrer"
        className="scope-citation-chip"
        title={title}
      >
        {c.label}
        <span className="scope-citation-ext">↗</span>
      </a>
    );
  }
  return (
    <span className="scope-citation-chip scope-citation-chip-static" title={title}>
      {c.label}
    </span>
  );
}

function DimensionBlock({
  dim,
  instrumentLabel,
  viewMode,
}: {
  dim: ScopeDimension;
  instrumentLabel: string;
  viewMode: "lawyer" | "symbolic";
}) {
  void instrumentLabel;
  const [proofOpen, setProofOpen] = useState(false);
  const badge = RESULT_BADGE[dim.result] || "badge-gray";

  const lawyerCitations = dedupeCitations([
    ...(dim.rules_invoked || []).map((r) => r.citation).filter(Boolean) as any[],
    ...(dim.citations || []),
  ]);

  return (
    <details className="scope-dim" open={dim.result === "UNKNOWN"}>
      <summary className="scope-dim-summary">
        <span className="scope-dim-label">{dim.label}</span>
        <span className={`badge ${badge}`}>{dim.result}</span>
      </summary>

      <div className="scope-dim-body">
        {viewMode === "lawyer" && dim.llm?.interpretation ? (
          <>
            <p className="scope-dim-llm">{dim.llm.interpretation}</p>
            {dim.llm?.why_result && (
              <p className="scope-dim-why text-xs text-muted">{dim.llm.why_result}</p>
            )}
            {dim.llm?.key_facts && dim.llm.key_facts.length > 0 && (
              <ul className="scope-key-facts">
                {dim.llm.key_facts.map((f, i) => (
                  <li key={i}>{stripInternalIds(f)}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="scope-dim-evidence">{stripInternalIds(dim.evidence)}</p>
        )}

        {viewMode === "lawyer" && lawyerCitations.length > 0 && (
          <div className="scope-subsection">
            <div className="scope-subsection-title">Legal basis</div>
            {lawyerCitations.map((c, i) => (
              <div key={i} className="scope-provision-card">
                <CitationChip c={c as any} />
                <ProvisionText c={c as any} />
              </div>
            ))}
          </div>
        )}

        {viewMode === "symbolic" && dim.decisive_facts.length > 0 && (
          <div className="scope-subsection">
            <div className="scope-subsection-title">Decisive facts</div>
            <p className="scope-subsection-hint text-xs text-muted">
              Facts you provided and what the symbolic proof used for this gate.{" "}
              <strong>Proof trace gap</strong> means a proof step was not reconstructed — not the same as
              FAIL.
            </p>
            <ul className="scope-fact-list">
              {dim.decisive_facts.map((f, i) => (
                <li key={i} className="scope-fact-item">
                  <span className={`badge ${FACT_KIND_BADGE[f.kind] || "badge-gray"} text-mono`}>
                    {FACT_KIND_LABEL[f.kind] || f.kind.replace(/_/g, " ")}
                  </span>
                  <span className="scope-fact-label">{stripInternalIds(f.label)}</span>
                  {f.note && (
                    <p className="scope-fact-note text-xs text-muted">{stripInternalIds(f.note)}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {viewMode === "symbolic" && dim.rules_invoked.length > 0 && (
          <div className="scope-subsection">
            <div className="scope-subsection-title">Rules invoked</div>
            {dim.rules_invoked.map((r, i) => (
              <div key={i} className="scope-rule-card">
                <div className="scope-rule-head">
                  {r.citation ? (
                    <CitationChip c={r.citation} />
                  ) : (
                    <span className="scope-citation-chip-static">{r.provision_long_id}</span>
                  )}
                  {r.kind && <span className="badge badge-gray text-mono">{r.kind}</span>}
                </div>
                {r.head_atom && (
                  <pre className="scope-rule-atom">{stripInternalIds(r.head_atom)}</pre>
                )}
                {r.rule_text && <p className="scope-rule-text text-xs text-muted">{r.rule_text}</p>}
              </div>
            ))}
          </div>
        )}

        {viewMode === "symbolic" && dim.citations.length > 0 && (
          <div className="scope-subsection">
            <div className="scope-subsection-title">Legal basis</div>
            {dim.citations.map((c, i) => (
              <div key={i} className="scope-provision-card">
                <CitationChip c={c} />
              </div>
            ))}
          </div>
        )}

        {viewMode === "symbolic" && (dim.proof_lines?.length ?? 0) > 0 && (
          <div className="scope-subsection">
            <button
              type="button"
              className="scope-proof-toggle"
              onClick={() => setProofOpen((o) => !o)}
            >
              {proofOpen ? "Hide" : "Show"} proof steps ({dim.proof_lines!.length})
            </button>
            {proofOpen && (
              <ol className="scope-proof-list">
                {dim.proof_lines!.map((p, i) => (
                  <li key={i}>
                    <span className="badge badge-gray text-mono">{p.kind}</span>{" "}
                    <code className="text-mono text-xs">{stripInternalIds(p.atom || "")}</code>
                    {p.provision_long_id && (
                      <span className="text-xs text-muted"> · {p.provision_long_id}</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </details>
  );
}

function InstrumentPanel({
  inst,
  viewMode,
}: {
  inst: ScopeInstrument;
  viewMode: "lawyer" | "symbolic";
}) {
  return (
    <div className="scope-instrument">
      <div className="scope-instrument-head">
        <div>
          <h3 className="scope-instrument-title">{inst.label}</h3>
          <p className="scope-instrument-sub text-xs text-muted">{inst.full_name}</p>
        </div>
        <span className="badge badge-blue">{inst.verdict_display || inst.verdict}</span>
      </div>

      {viewMode === "lawyer" && inst.llm_summary && (
        <p className="scope-instrument-summary">{inst.llm_summary}</p>
      )}
      {!inst.llm_summary && inst.headline && (
        <p className="scope-instrument-summary">{stripInternalIds(inst.headline)}</p>
      )}
      {viewMode === "symbolic" && inst.llm_summary && inst.headline && (
        <p className="scope-instrument-summary">{stripInternalIds(inst.headline)}</p>
      )}

      {inst.risk_category && (
        <span className="badge badge-amber" style={{ marginBottom: 10 }}>
          {inst.risk_category.replace(/_/g, " ")}
        </span>
      )}

      <div className="scope-dimensions">
        {inst.dimensions.map((d) => (
          <DimensionBlock
            key={d.id}
            dim={d}
            instrumentLabel={inst.label}
            viewMode={viewMode}
          />
        ))}
      </div>
    </div>
  );
}

interface Props {
  scopeAnalysis?: ScopeAnalysis | null;
  fallbackWorksheet?: ChatResponse["worksheet"];
  defaultViewMode?: "lawyer" | "symbolic";
  hideViewToggle?: boolean;
}

export function ScopeAnalysisPanel({
  scopeAnalysis,
  fallbackWorksheet,
  defaultViewMode,
  hideViewToggle,
}: Props) {
  const instruments = scopeAnalysis?.instruments || [];
  const [activeTab, setActiveTab] = useState(instruments[0]?.id || "GDPR");
  const [viewMode, setViewMode] = useState<"lawyer" | "symbolic">(
    defaultViewMode ?? (scopeAnalysis?.llm_enriched ? "lawyer" : "symbolic")
  );

  useEffect(() => {
    if (instruments.length && !instruments.some((i) => i.id === activeTab)) {
      setActiveTab(instruments[0].id);
    }
  }, [instruments, activeTab]);

  useEffect(() => {
    if (defaultViewMode) {
      setViewMode(defaultViewMode);
      return;
    }
    if (scopeAnalysis?.llm_enriched) {
      setViewMode("lawyer");
    }
  }, [scopeAnalysis?.llm_enriched, defaultViewMode]);

  if (instruments.length === 0) {
    if (fallbackWorksheet?.rows?.length) {
      return <WorksheetTable worksheet={fallbackWorksheet} />;
    }
    return <p className="text-xs text-muted">No scope analysis available.</p>;
  }

  const active = instruments.find((i) => i.id === activeTab) || instruments[0];

  return (
    <div className="scope-analysis">
      <div className="scope-toolbar">
        <div className="scope-tabs" role="tablist">
          {instruments.map((inst) => (
            <button
              key={inst.id}
              type="button"
              role="tab"
              aria-selected={activeTab === inst.id}
              className={`scope-tab${activeTab === inst.id ? " active" : ""}`}
              onClick={() => setActiveTab(inst.id)}
            >
              {inst.label}
            </button>
          ))}
        </div>

        {!hideViewToggle && (
          <div className="scope-view-toggle" role="tablist" aria-label="Scope view mode">
            <button
              type="button"
              className={`scope-view-btn${viewMode === "lawyer" ? " active" : ""}`}
              onClick={() => setViewMode("lawyer")}
              disabled={!scopeAnalysis?.llm_enriched}
              title={!scopeAnalysis?.llm_enriched ? "LLM summary not available" : "Lawyer summary"}
            >
              Lawyer view
            </button>
            <button
              type="button"
              className={`scope-view-btn${viewMode === "symbolic" ? " active" : ""}`}
              onClick={() => setViewMode("symbolic")}
              title="Symbolic detail"
            >
              Symbolic view
            </button>
          </div>
        )}
      </div>
      <InstrumentPanel inst={active} viewMode={viewMode} />
    </div>
  );
}
