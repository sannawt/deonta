import type { ClarifyingQuestion, ScopeDimension } from "../../types/chat";
import {
  dimensionResultPlain,
  dimensionResultSentence,
  humanizeFactText,
  humanizeMissingQuestion,
  humanizeRuleExplanation,
  isTechnicalAtom,
} from "../../lib/plainLanguage";
import { formatEngineTokens } from "../../lib/utils";

interface Props {
  dim: ScopeDimension;
  openQuestions?: ClarifyingQuestion[];
  defaultOpen?: boolean;
}

function splitRefs(text: string): { body: string; refs: string } {
  const match = text.match(/\s*Refs:\s*(.+)$/i);
  if (!match || match.index === undefined) {
    return { body: text.trim(), refs: "" };
  }
  return {
    body: text.slice(0, match.index).trim(),
    refs: match[1].trim(),
  };
}

function resultIcon(result: string): string {
  switch (result) {
    case "PASS":
      return "✓";
    case "FAIL":
      return "×";
    case "UNKNOWN":
      return "◇";
    default:
      return "△";
  }
}

export function ScopeDimensionCard({ dim, openQuestions = [], defaultOpen = false }: Props) {
  const dimWithDisplay = dim as ScopeDimension & { result_display?: string };
  const resultLabel =
    dimWithDisplay.result_display?.trim() || dimensionResultPlain(dim.result);

  const rawAnalysis =
    dim.llm?.interpretation?.trim() ||
    dim.evidence?.trim() ||
    dimensionResultSentence(dim.label, dim.result);

  const { body: analysisBody, refs: evidenceRefs } = splitRefs(rawAnalysis);
  const why = dim.llm?.why_result?.trim() || "";

  const rules = dim.rules_invoked ?? [];
  const citations = dim.citations ?? [];

  const supportingFacts: string[] = [];
  const unclearFacts: string[] = [];
  const seen = new Set<string>();

  const addUnique = (list: string[], raw: string) => {
    const text = humanizeFactText(raw);
    if (!text || isTechnicalAtom(text)) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    list.push(text);
  };

  for (const fact of dim.decisive_facts ?? []) {
    const kind = fact.kind || "";
    const raw = fact.label || fact.atom || "";
    if (kind === "missing" || kind === "gap" || kind === "trace_gap") {
      const note = fact.note ? humanizeFactText(fact.note) : "";
      addUnique(unclearFacts, note || raw);
    } else {
      addUnique(supportingFacts, raw);
    }
  }

  for (const f of dim.llm?.key_facts ?? []) {
    addUnique(supportingFacts, f);
  }

  const dimQuestions = openQuestions.filter(
    (q) => !q.dimension || q.dimension === dim.id,
  );
  for (const q of dimQuestions) {
    const text = humanizeMissingQuestion(q.text || "");
    if (text) addUnique(unclearFacts, text);
  }

  const ruleRefs = rules
    .map((r) => {
      const rule = humanizeRuleExplanation(r.rule_text, r.head_atom);
      const cite = r.citation?.label ? ` (${r.citation.label})` : "";
      return `${rule}${cite}`;
    })
    .filter(Boolean);

  const citationRefs = citations.map((c) => c.label).filter(Boolean);
  const legalRefs = [
    evidenceRefs,
    ...ruleRefs,
    citationRefs.length ? citationRefs.join("; ") : "",
  ]
    .filter(Boolean)
    .join("; ");

  return (
    <details className={`ct-scope-dim-card ct-scope-dim-${dim.result.toLowerCase()}`} open={defaultOpen}>
      <summary className="ct-scope-dim-card-head">
        <span className="ct-scope-dim-icon" aria-hidden>
          {resultIcon(dim.result)}
        </span>
        <span className="ct-scope-dim-title">
          <strong>{dim.label}</strong>
          <span className="ct-scope-dim-result">— {resultLabel}</span>
        </span>
      </summary>

      <div className="ct-scope-dim-card-body">
        {analysisBody ? (
          <p className="ct-scope-dim-analysis">{formatEngineTokens(analysisBody)}</p>
        ) : null}
        {why ? <p className="ct-scope-dim-why">{formatEngineTokens(why)}</p> : null}

        {supportingFacts.length > 0 ? (
          <div className="ct-scope-dim-block">
            <p className="ct-scope-dim-block-label">Supporting facts</p>
            <ul className="ct-scope-dim-fact-list">
              {supportingFacts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {legalRefs ? (
          <div className="ct-scope-dim-block">
            <p className="ct-scope-dim-block-label">Legal basis</p>
            <p className="ct-scope-dim-refs">{legalRefs}</p>
          </div>
        ) : null}

        {unclearFacts.length > 0 ? (
          <div className="ct-scope-dim-block ct-scope-dim-block--unclear">
            <p className="ct-scope-dim-block-label">Still unclear</p>
            <ul className="ct-scope-dim-fact-list">
              {unclearFacts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}
