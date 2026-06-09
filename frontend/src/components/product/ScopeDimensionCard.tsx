import type { ClarifyingQuestion, ScopeDimension } from "../../types/chat";
import { collectDimensionCitations, splitEvidenceRefs } from "../../lib/citations";
import {
  dimensionResultPlain,
  dimensionResultSentence,
  humanizeFactText,
  humanizeMissingQuestion,
  humanizeRuleExplanation,
  isTechnicalAtom,
} from "../../lib/plainLanguage";
import { formatEngineTokens } from "../../lib/utils";
import { eurlexUrlForProvision } from "../../lib/legalLinks";
import { ChatCitationLink } from "../chat/ChatCitationLink";
import { LegalInlineText } from "./LegalInlineText";

interface Props {
  dim: ScopeDimension;
  openQuestions?: ClarifyingQuestion[];
  defaultOpen?: boolean;
  regKey?: string;
}

function splitClauses(text: string): string[] {
  const formatted = formatEngineTokens(text);
  if (!formatted) return [];
  const parts = formatted
    .split(/;\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [formatted];
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

function resultTone(result: string, label: string): "pass" | "fail" | "review" | "neutral" {
  const value = `${result} ${label}`.toLowerCase();
  if (
    result === "PASS" ||
    (value.includes("met") && !value.includes("partly") && !value.includes("not"))
  ) {
    return "pass";
  }
  if (result === "FAIL" || value.includes("not met") || value.includes("out of scope")) {
    return "fail";
  }
  if (
    result === "UNKNOWN" ||
    value.includes("unclear") ||
    value.includes("staged") ||
    value.includes("partly") ||
    value.includes("review")
  ) {
    return "review";
  }
  return "neutral";
}

export function ScopeDimensionCard({
  dim,
  openQuestions = [],
  defaultOpen = false,
  regKey,
}: Props) {
  const dimWithDisplay = dim as ScopeDimension & { result_display?: string };
  const resultLabel =
    dimWithDisplay.result_display?.trim() || dimensionResultPlain(dim.result);
  const tone = resultTone(dim.result, resultLabel);

  // Show LLM interpretation as primary analysis
  const llmBody = dim.llm?.interpretation?.trim() || "";
  // Show evidence separately when it adds different content
  const evidenceBody = (() => {
    const ev = dim.evidence?.trim() || "";
    if (!ev || ev === llmBody) return "";
    // Only show evidence if it has substantive content and isn't just a fallback sentence
    if (ev.length < 20) return "";
    return ev;
  })();

  const primaryAnalysis = llmBody || evidenceBody || dimensionResultSentence(dim.label, dim.result);
  const { body: analysisBody, refs: evidenceRefs } = splitEvidenceRefs(primaryAnalysis);

  const why = dim.llm?.why_result?.trim() || "";
  const rules = dim.rules_invoked ?? [];

  // Proof lines: show those with human-readable notes
  const proofLines = (dim.proof_lines ?? []).filter((pl) => {
    const note = (pl.note || "").trim();
    if (!note) return false;
    if (isTechnicalAtom(note)) return false;
    return note.length > 12;
  });

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

  // Add proof-line notes into supporting facts too
  for (const pl of proofLines) {
    const note = (pl.note || "").trim();
    addUnique(supportingFacts, note);
  }

  const dimQuestions = openQuestions.filter(
    (q) => !q.dimension || q.dimension === dim.id,
  );
  for (const q of dimQuestions) {
    const text = humanizeMissingQuestion(q.text || "");
    if (text) addUnique(unclearFacts, text);
  }

  // Build rule entries — show actual rule_text when it's substantial
  const ruleEntries = rules
    .map((rule) => {
      const ruleText = (rule.rule_text || "").trim();
      const isSubstantial = ruleText.length > 40 && !/^[a-z_]+\(/.test(ruleText);
      return {
        text: isSubstantial ? formatEngineTokens(ruleText) : humanizeRuleExplanation(rule.rule_text, rule.head_atom),
        citation: rule.citation,
        provision_long_id: rule.provision_long_id,
      };
    })
    .filter((entry) => entry.text);

  // Collect proof-line citations (provision_long_id → link)
  const proofLineCitations = proofLines
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

  const legalCitations = collectDimensionCitations(dim, evidenceRefs, regKey);
  const ruleCitationKeys = new Set(
    ruleEntries
      .map((entry) => entry.citation?.provision_long_id || entry.citation?.label)
      .filter(Boolean),
  );
  const standaloneCitations = legalCitations.filter(
    (citation) => !ruleCitationKeys.has(citation.provision_long_id || citation.label),
  );

  // Merge proof-line citations with standalone ones (dedup)
  const existingKeys = new Set([
    ...legalCitations.map((c) => c.provision_long_id || c.label),
  ]);
  const extraProofCitations = proofLineCitations.filter(
    (c) => !existingKeys.has(c.provision_long_id || c.label),
  );

  const hasCitations = ruleEntries.length > 0 || standaloneCitations.length > 0 || extraProofCitations.length > 0;

  const hasDetail =
    analysisBody ||
    evidenceBody ||
    why ||
    supportingFacts.length > 0 ||
    hasCitations ||
    unclearFacts.length > 0;

  const clauses = analysisBody ? splitClauses(analysisBody) : [];
  const evidenceClauses = evidenceBody && evidenceBody !== analysisBody
    ? splitClauses(evidenceBody)
    : [];
  const preview = clauses[0] ?? "";

  return (
    <details
      className={`ct-scope-dim-card ct-scope-dim-card--${tone}`}
      open={defaultOpen}
    >
      <summary className="ct-scope-dim-card-head">
        <span className={`ct-scope-dim-card-icon ct-scope-dim-card-icon--${tone}`} aria-hidden>
          {resultIcon(dim.result)}
        </span>
        <div className="ct-scope-dim-card-head-main">
          <span className="ct-scope-dim-card-title">{dim.label}</span>
          {preview ? (
            <span className="ct-scope-dim-card-preview">
              <LegalInlineText text={preview} regKey={regKey} />
            </span>
          ) : null}
        </div>
        <span className={`ct-scope-dim-card-badge ct-scope-dim-card-badge--${tone}`}>
          {resultLabel}
        </span>
      </summary>

      {hasDetail ? (
        <div className="ct-scope-dim-card-body">
          {clauses.length > 0 ? (
            <section className="ct-scope-dim-section">
              <h5 className="ct-scope-dim-section-title">
                <span className="ct-scope-dim-section-icon">◆</span> Findings
              </h5>
              <ul className="ct-scope-dim-finding-list">
                {clauses.map((clause, i) => (
                  <li key={i}>
                    <LegalInlineText text={clause} regKey={regKey} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {evidenceClauses.length > 0 ? (
            <section className="ct-scope-dim-section ct-scope-dim-section--evidence">
              <h5 className="ct-scope-dim-section-title">
                <span className="ct-scope-dim-section-icon">▸</span> Background
              </h5>
              <ul className="ct-scope-dim-finding-list">
                {evidenceClauses.map((clause, i) => (
                  <li key={i}>
                    <LegalInlineText text={clause} regKey={regKey} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {why ? (
            <section className="ct-scope-dim-section ct-scope-dim-section--conclusion">
              <h5 className="ct-scope-dim-section-title">
                <span className="ct-scope-dim-section-icon">→</span> Conclusion
              </h5>
              <p className="ct-scope-dim-conclusion">
                <LegalInlineText text={formatEngineTokens(why)} regKey={regKey} />
              </p>
            </section>
          ) : null}

          {supportingFacts.length > 0 ? (
            <section className="ct-scope-dim-section ct-scope-dim-section--facts">
              <h5 className="ct-scope-dim-section-title">
                <span className="ct-scope-dim-section-icon">✓</span> Supporting facts
              </h5>
              <ul className="ct-scope-dim-fact-list ct-scope-dim-fact-list--supporting">
                {supportingFacts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {hasCitations ? (
            <section className="ct-scope-dim-section ct-scope-dim-section--legal">
              <h5 className="ct-scope-dim-section-title">
                <span className="ct-scope-dim-section-icon">§</span> Legal basis
              </h5>
              {ruleEntries.map((entry) => (
                <p
                  key={`${entry.text}-${entry.citation?.label || entry.provision_long_id || ""}`}
                  className="ct-scope-dim-legal-line"
                >
                  <LegalInlineText text={entry.text} regKey={regKey} />
                </p>
              ))}
              <div className="ct-scope-dim-citations">
                {ruleEntries
                  .filter((entry) => entry.citation)
                  .map((entry) => (
                    <ChatCitationLink
                      key={entry.citation!.provision_long_id || entry.citation!.label}
                      citation={entry.citation!}
                      className="ct-scope-cite-chip"
                    />
                  ))}
                {standaloneCitations.map((citation) => (
                  <ChatCitationLink
                    key={citation.provision_long_id || citation.label}
                    citation={citation}
                    className="ct-scope-cite-chip"
                  />
                ))}
                {extraProofCitations.map((citation) => (
                  <ChatCitationLink
                    key={citation.provision_long_id || citation.label}
                    citation={citation}
                    className="ct-scope-cite-chip"
                  />
                ))}
              </div>
            </section>
          ) : null}

          {unclearFacts.length > 0 ? (
            <section className="ct-scope-dim-section ct-scope-dim-section--open">
              <h5 className="ct-scope-dim-section-title">
                <span className="ct-scope-dim-section-icon">?</span> Still unclear
              </h5>
              <ul className="ct-scope-dim-fact-list ct-scope-dim-fact-list--unclear">
                {unclearFacts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}
