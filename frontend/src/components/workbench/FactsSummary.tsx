import type { Assessment, FactRow, FactsSummary as FactsSummaryType } from "../../types/chat";
import { stripInternalIds } from "../../lib/utils";

function relevanceBadge(relevance?: string) {
  switch (relevance) {
    case "used":
      return { cls: "badge-green", label: "Used in analysis" };
    case "related":
      return { cls: "badge-blue", label: "Related context" };
    default:
      return { cls: "badge-gray", label: "Background" };
  }
}

function BulletList({
  items,
  showRelevance,
}: {
  items: Array<{ label: string; detail: string; relevance?: string }>;
  showRelevance?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="facts-summary-list">
      {items.map((item, i) => {
        const badge = showRelevance && item.relevance ? relevanceBadge(item.relevance) : null;
        return (
          <li key={i} className="facts-summary-item">
            <div className="facts-summary-item-head">
              <span className="facts-summary-label">{stripInternalIds(item.label)}</span>
              {badge && <span className={`badge ${badge.cls} text-mono`}>{badge.label}</span>}
            </div>
            {item.detail ? (
              <p className="facts-summary-detail">{stripInternalIds(item.detail)}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function RawFactTable({ title, rows }: { title: string; rows: FactRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="assessment-fact-block">
      <div className="assessment-section-title">{title}</div>
      <div className="assessment-fact-grid assessment-fact-grid-raw">
        {rows.map((r, i) => (
          <div key={i} className="assessment-fact-raw-row">
            <div className="assessment-fact-field">{stripInternalIds(r.field)}</div>
            <div className="assessment-fact-value-text">{stripInternalIds(r.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  facts: Assessment["facts"];
}

export function FactsSummaryView({ facts }: Props) {
  const summary: FactsSummaryType | undefined = facts.summary;
  const extended = facts.playbook_extended || [];

  const hasSummary =
    summary &&
    (summary.scenario_gist ||
      (summary.from_question && summary.from_question.length > 0) ||
      (summary.from_playbook && summary.from_playbook.length > 0));

  if (!hasSummary) {
    return (
      <>
        <RawFactTable title="Facts you provided" rows={facts.from_question || []} />
        <RawFactTable title="Relevant company playbook context" rows={facts.from_playbook || []} />
        {extended.length > 0 && (
          <details className="assessment-details">
            <summary>All other playbook matches ({extended.length})</summary>
            <RawFactTable title="" rows={extended} />
          </details>
        )}
      </>
    );
  }

  return (
    <div className="facts-summary">
      {summary.scenario_gist ? (
        <p className="facts-summary-gist">{summary.scenario_gist}</p>
      ) : null}

      {(summary.from_question?.length ?? 0) > 0 && (
        <div className="facts-summary-group">
          <div className="facts-summary-group-title">From your question</div>
          <BulletList items={summary.from_question!} />
        </div>
      )}

      {facts.playbook_company_id && (summary.from_playbook?.length ?? 0) > 0 && (
        <div className="facts-summary-group">
          <div className="facts-summary-group-title">
            From {facts.playbook_company_label || "company"} playbook
          </div>
          <BulletList items={summary.from_playbook!} showRelevance />
        </div>
      )}

      {summary.note ? <p className="assessment-panel-note">{summary.note}</p> : null}

      {(facts.playbook_total_matched ?? 0) > (facts.from_playbook?.length ?? 0) && !summary.note && (
        <p className="assessment-panel-note">
          {facts.playbook_total_matched} playbook nodes matched; showing the most relevant in summary.
        </p>
      )}

      <details className="assessment-details facts-summary-raw-toggle">
        <summary>
          Show full fact list (
          {(facts.from_question?.length ?? 0) + (facts.from_playbook?.length ?? 0) + extended.length})
        </summary>
        <div className="facts-summary-raw">
          <RawFactTable title="Facts you provided" rows={facts.from_question || []} />
          <RawFactTable title="Playbook (ranked)" rows={facts.from_playbook || []} />
          {extended.length > 0 && <RawFactTable title="Other playbook matches" rows={extended} />}
        </div>
      </details>
    </div>
  );
}
