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

export function ScopeDimensionCard({ dim, openQuestions = [], defaultOpen = false }: Props) {
  const resultLabel = dimensionResultPlain(dim.result);

  const analysis =
    dim.llm?.interpretation?.trim() ||
    dim.evidence?.trim() ||
    dimensionResultSentence(dim.label, dim.result);

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

  const proseParts: string[] = [
    formatEngineTokens(analysis),
    why ? formatEngineTokens(why) : "",
    supportingFacts.length
      ? `Supporting facts: ${supportingFacts.join("; ")}.`
      : "",
    rules.length
      ? rules
          .map((r) => {
            const rule = humanizeRuleExplanation(r.rule_text, r.head_atom);
            const cite = r.citation?.label ? ` (${r.citation.label})` : "";
            return `${rule}${cite}`;
          })
          .join(" ")
      : "",
    citations.length
      ? `Legal basis: ${citations.map((c) => c.label).join("; ")}.`
      : "",
    unclearFacts.length ? `Still unclear: ${unclearFacts.join("; ")}.` : "",
  ].filter(Boolean);

  const body = proseParts.join(" ");

  return (
    <details className="ct-scope-dim-card" open={defaultOpen}>
      <summary className="ct-scope-dim-card-head">
        <span className="ct-scope-prose">
          {dim.label} — {resultLabel}
        </span>
      </summary>

      <div className="ct-scope-dim-card-body">
        <p className="ct-scope-prose">{body}</p>
      </div>
    </details>
  );
}
