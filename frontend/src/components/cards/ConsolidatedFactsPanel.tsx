import type { ChatResponse, ConsolidatedFact } from "../../types/chat";
import { predicateOnlyFromCall, sourceDisplayLabel, sourceTagBadgeClass, stripInternalIds } from "../../lib/utils";

interface Props {
  facts?: ConsolidatedFact[];
  factsTable?: ChatResponse["facts_table"];
  playbookError?: string | null;
}

function FactRows({ rows }: { rows: NonNullable<ChatResponse["facts_table"]>["rows"] }) {
  const questionRows = rows.filter((r) => r.source === "question");
  const playbookRows = rows.filter((r) => r.source === "playbook");

  const renderGroup = (label: string, group: typeof rows) => {
    if (group.length === 0) return null;
    return (
      <>
        <div className="facts-section-label">{label}</div>
        {group.map((r, i) => (
          <div key={`${label}-${i}`} style={{ display: "contents" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12.5, color: "var(--txt)" }}>
              {stripInternalIds(r.field)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13, color: "var(--txt2)" }}>
                {stripInternalIds(r.value)}
              </div>
              <span
                className={`badge ${sourceTagBadgeClass(r.source || "question")} text-mono`}
                style={{ width: "fit-content" }}
              >
                {sourceDisplayLabel(r.source || "question")}
              </span>
            </div>
          </div>
        ))}
      </>
    );
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--txt4)", textTransform: "uppercase", letterSpacing: ".08em" }}>
        Field
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--txt4)", textTransform: "uppercase", letterSpacing: ".08em" }}>
        Value
      </div>
      {renderGroup("From question", questionRows)}
      {renderGroup("From company playbook", playbookRows)}
    </div>
  );
}

export function ConsolidatedFactsPanel({ facts, factsTable, playbookError }: Props) {
  const rows = factsTable?.rows || [];
  const title = factsTable?.title || "Facts from the question and playbook";
  if (rows.length === 0 && (!facts || facts.length === 0)) return null;

  const playbookLabel = factsTable?.playbook_company_label;

  return (
    <div className="panel-card">
      <div className="panel-card-head">
        <span>{title}</span>
        <span className="badge badge-gray text-mono">{rows.length > 0 ? rows.length : (facts?.length || 0)}</span>
        {playbookLabel && (
          <span className="badge badge-blue text-mono">{playbookLabel}</span>
        )}
        {playbookError && (
          <span className="badge badge-amber" title={playbookError}>
            playbook unavailable
          </span>
        )}
      </div>

      {rows.length > 0 ? (
        <FactRows rows={rows} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px 12px" }}>
          {(facts || []).map((f, i) => {
            const tag = f.source_tag || "scenario";
            const label = f.playbook_label
              ? `${f.playbook_label} (playbook)`
              : predicateOnlyFromCall(f.predicate);
            return (
              <span
                key={i}
                className={`badge ${sourceTagBadgeClass(tag)} text-mono`}
                title={`${predicateOnlyFromCall(f.predicate)} · ${tag}`}
                style={{ justifyContent: "flex-start" }}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
