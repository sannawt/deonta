import type { ClarifyingQuestion, ScopeDimension } from "../../types/chat";
import { collectDimensionCitations, splitEvidenceRefs } from "../../lib/citations";
import { eurlexUrlForProvision } from "../../lib/legalLinks";
import type { ScopeCitation } from "../../types/chat";
import { ChatCitationLink } from "../chat/ChatCitationLink";
import { LegalInlineText } from "./LegalInlineText";
import { compactDimensionSummary } from "../../lib/scopeDimensionSummary";

interface Props {
  dim: ScopeDimension;
  openQuestions?: ClarifyingQuestion[];
  regKey?: string;
  compact?: boolean;
  onCitationSelect?: (provisionId: string) => void;
}

function resultIcon(result: string): string {
  switch (result) {
    case "PASS":    return "✓";
    case "FAIL":    return "×";
    case "UNKNOWN": return "◇";
    default:        return "△";
  }
}

function resultTone(result: string, label: string): "pass" | "fail" | "review" | "neutral" {
  const value = `${result} ${label}`.toLowerCase();
  if (result === "PASS" || (value.includes("met") && !value.includes("partly") && !value.includes("not"))) return "pass";
  if (result === "FAIL" || value.includes("not met") || value.includes("out of scope")) return "fail";
  if (result === "UNKNOWN" || value.includes("unclear") || value.includes("staged") || value.includes("partly") || value.includes("review")) return "review";
  return "neutral";
}

function collectCitations(dim: ScopeDimension, regKey?: string): ScopeCitation[] {
  const { refs: evidenceRefs } = splitEvidenceRefs(
    dim.llm?.interpretation?.trim() || dim.evidence?.trim() || "",
  );
  const legalCitations = collectDimensionCitations(dim, evidenceRefs, regKey);
  const proofLineCitations = (dim.proof_lines ?? [])
    .filter((pl) => pl.provision_long_id)
    .map((pl) => {
      const plid = pl.provision_long_id!;
      const url = eurlexUrlForProvision(plid);
      const label = plid
        .replace(/^[A-Za-z]+_/, "")
        .replace(/^A(\d+)/, "Art. $1")
        .replace(/^R(\d+)/, "Recital $1");
      return { provision_long_id: plid, label, eurlex_url: url };
    });
  const existingKeys = new Set(legalCitations.map((c) => c.provision_long_id || c.label));
  return [
    ...legalCitations,
    ...proofLineCitations.filter((c) => !existingKeys.has(c.provision_long_id || c.label)),
  ];
}

export function ScopeDimensionCard({ dim, regKey, compact = true, onCitationSelect }: Props) {
  const tone = resultTone(dim.result, dim.label);
  const summary = compactDimensionSummary(dim, regKey);
  const citations = collectCitations(dim, regKey).slice(0, 5);
  const external = (dim.external_sources ?? []).slice(0, 2);

  if (!compact) {
    const summary = compactDimensionSummary(dim, regKey);
    return (
      <div className={`ct-scope-dim-row ct-scope-dim-row--${tone}`}>
        <div className="ct-scope-dim-row-inner">
          <p className="ct-scope-dim-row-text">
            <LegalInlineText text={summary} regKey={regKey} />
          </p>
        </div>
      </div>
    );
  }

  const handleCitationSelect = (citation: ScopeCitation) => {
    const plid = citation.provision_long_id || citation.label;
    if (plid) onCitationSelect?.(plid);
  };

  return (
    <div
      id={`ct-scope-dim-${dim.id}`}
      className={`ct-scope-dim-row ct-scope-dim-row--compact ct-scope-dim-row--${tone}`}
    >
      <div className="ct-scope-dim-compact-grid">
        <span className={`ct-scope-dim-row-icon ct-scope-dim-row-icon--${tone}`} aria-hidden>
          {resultIcon(dim.result)}
        </span>
        <span className="ct-scope-dim-row-name">{dim.label}</span>
        <p className="ct-scope-dim-compact-summary">
          <LegalInlineText text={summary} regKey={regKey} />
        </p>
        <div className="ct-scope-dim-compact-refs">
          {citations.map((citation) => (
            <ChatCitationLink
              key={citation.provision_long_id || citation.label}
              citation={citation}
              className="ct-scope-cite-chip ct-scope-cite-chip--sm"
              onSelect={onCitationSelect ? handleCitationSelect : undefined}
            />
          ))}
          {external.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ct-scope-cite-chip ct-scope-cite-chip--sm ct-scope-external-chip"
            >
              {source.label}
              <span className="ct-cite-ext" aria-hidden>↗</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
