import type { ClarifyingQuestion, ScopeDimension } from "../../types/chat";
import { collectDimensionCitations, splitEvidenceRefs } from "../../lib/citations";
import {
  dimensionResultPlain,
  dimensionResultSentence,
  humanizeMissingQuestion,
  isTechnicalAtom,
} from "../../lib/plainLanguage";
import { formatEngineTokens } from "../../lib/utils";
import { eurlexUrlForProvision } from "../../lib/legalLinks";
import { ChatCitationLink } from "../chat/ChatCitationLink";
import { LegalInlineText } from "./LegalInlineText";

interface Props {
  dim: ScopeDimension;
  openQuestions?: ClarifyingQuestion[];
  regKey?: string;
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

function buildFullText(dim: ScopeDimension): string {
  const parts: string[] = [];
  const interp = dim.llm?.interpretation?.trim() || "";
  const evidence = dim.evidence?.trim() || "";
  const why = dim.llm?.why_result?.trim() || "";

  const primary = interp || evidence;
  if (primary) {
    const { body } = splitEvidenceRefs(primary);
    if (body) parts.push(formatEngineTokens(body));
  }
  if (why) {
    const formatted = formatEngineTokens(why);
    const alreadyCovered = parts.some((p) =>
      p.toLowerCase().includes(formatted.slice(0, 40).toLowerCase()),
    );
    if (!alreadyCovered) parts.push(formatted);
  }
  if (!parts.length) parts.push(dimensionResultSentence(dim.label, dim.result));
  return parts.join(" ");
}

export function ScopeDimensionCard({ dim, openQuestions = [], regKey }: Props) {
  const dimWithDisplay = dim as ScopeDimension & { result_display?: string };
  const resultLabel = dimWithDisplay.result_display?.trim() || dimensionResultPlain(dim.result);
  const tone = resultTone(dim.result, resultLabel);
  const fullText = buildFullText(dim);

  // Citations
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
  const allCitations = [
    ...legalCitations,
    ...proofLineCitations.filter((c) => !existingKeys.has(c.provision_long_id || c.label)),
  ];

  // Unclear questions
  const unclearFacts: string[] = [];
  const seen = new Set<string>();
  for (const fact of dim.decisive_facts ?? []) {
    const kind = fact.kind || "";
    if (kind === "missing" || kind === "gap" || kind === "trace_gap") {
      const raw = fact.note || fact.label || fact.atom || "";
      const text = raw.replace(/\s+/g, " ").trim();
      if (text && !isTechnicalAtom(text) && !seen.has(text.toLowerCase())) {
        seen.add(text.toLowerCase());
        unclearFacts.push(text);
      }
    }
  }
  for (const q of openQuestions.filter((q) => !q.dimension || q.dimension === dim.id)) {
    const text = humanizeMissingQuestion(q.text || "");
    if (text && !seen.has(text.toLowerCase())) {
      seen.add(text.toLowerCase());
      unclearFacts.push(text);
    }
  }

  return (
    <div className={`ct-scope-dim-row ct-scope-dim-row--${tone}`}>
      {/* Left column: icon + name + badge */}
      <div className="ct-scope-dim-row-meta">
        <span className={`ct-scope-dim-row-icon ct-scope-dim-row-icon--${tone}`} aria-hidden>
          {resultIcon(dim.result)}
        </span>
        <span className="ct-scope-dim-row-name">{dim.label}</span>
        <span className={`ct-scope-dim-card-badge ct-scope-dim-card-badge--${tone}`}>
          {resultLabel}
        </span>
      </div>

      {/* Right column: text + sources */}
      <div className="ct-scope-dim-row-content">
        {fullText ? (
          <p className="ct-scope-dim-row-text">
            <LegalInlineText text={fullText} regKey={regKey} />
          </p>
        ) : null}

        {allCitations.length > 0 ? (
          <div className="ct-scope-dim-row-sources">
            <span className="ct-scope-dim-sources-label">Sources</span>
            <div className="ct-scope-dim-citations">
              {allCitations.map((citation) => (
                <ChatCitationLink
                  key={citation.provision_long_id || citation.label}
                  citation={citation}
                  className="ct-scope-cite-chip"
                />
              ))}
            </div>
          </div>
        ) : null}

        {unclearFacts.length > 0 ? (
          <div className="ct-scope-dim-row-unclear">
            <span className="ct-scope-dim-sources-label">Still unclear</span>
            <ul className="ct-scope-dim-unclear-list">
              {unclearFacts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
