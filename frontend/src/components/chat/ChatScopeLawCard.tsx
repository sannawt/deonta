import { useState } from "react";
import type { ScopeChatLawBlock } from "../../lib/scopeChatNarrative";
import { collectDimensionCitations, splitEvidenceRefs } from "../../lib/citations";
import type { ScopeDimension, ScopeInstrument } from "../../types/chat";
import {
  dimensionResultPlain,
  dimensionResultSentence,
  humanizeMissingQuestion,
  isTechnicalAtom,
} from "../../lib/plainLanguage";
import { formatEngineTokens } from "../../lib/utils";
import { ChatCitationLink } from "./ChatCitationLink";

const DIM_ORDER = ["temporal", "territorial", "material", "exclusions"];

interface Props {
  law: ScopeChatLawBlock;
  instrument?: ScopeInstrument;
  openQuestions?: string[];
  defaultExpanded?: boolean;
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

function verdictTone(verdict: string): "likely" | "review" | "unlikely" | "neutral" {
  const v = verdict.toLowerCase();
  if (v.includes("not likely") || v.includes("does not") || v.includes("not in scope")) {
    return "unlikely";
  }
  if (v.includes("in scope") || v.includes("applies") || v.includes("likely")) {
    return "likely";
  }
  if (v.includes("review") || v.includes("unclear") || v.includes("cannot")) {
    return "review";
  }
  return "neutral";
}

function resultTone(result: string): "pass" | "fail" | "open" | "neutral" {
  switch (result) {
    case "PASS":
      return "pass";
    case "FAIL":
      return "fail";
    case "UNKNOWN":
      return "open";
    default:
      return "neutral";
  }
}

function filterQuestions(raw: string[]): string[] {
  const seen = new Set<string>();
  return raw
    .map((q) => humanizeMissingQuestion(q))
    .filter((q) => {
      if (!q || isTechnicalAtom(q)) return false;
      if (/predicate used by/i.test(q)) return false;
      if (seen.has(q)) return false;
      seen.add(q);
      return true;
    })
    .slice(0, 4);
}

function DimensionAccordion({
  dim,
  regKey,
}: {
  dim: ScopeDimension;
  regKey?: string;
}) {
  const [open, setOpen] = useState(false);
  const resultLabel = dimensionResultPlain(dim.result);
  const tone = resultTone(dim.result);
  const rawAnalysis =
    dim.llm?.interpretation?.trim() ||
    dim.evidence?.trim() ||
    dimensionResultSentence(dim.label, dim.result);
  const { body: analysis, refs: evidenceRefs } = splitEvidenceRefs(rawAnalysis);
  const why = dim.llm?.why_result?.trim() || "";
  const citations = collectDimensionCitations(dim, evidenceRefs, regKey);

  return (
    <div className={`ct-chat-dim-acc ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="ct-chat-dim-acc-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="ct-chat-dim-acc-label">{dim.label}</span>
        <span className={`ct-chat-dim-badge ct-chat-dim-badge--${tone}`}>{resultLabel}</span>
        <span className="ct-chat-acc-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div className="ct-chat-dim-acc-body">
          {analysis ? (
            <ul className="ct-chat-scope-finding-list">
              {splitClauses(analysis).map((clause) => (
                <li key={clause}>{clause}</li>
              ))}
            </ul>
          ) : null}
          {why ? <p className="ct-chat-scope-conclusion">{formatEngineTokens(why)}</p> : null}
          {citations.length > 0 ? (
            <div className="ct-chat-scope-legal">
              <p className="ct-chat-scope-legal-label">Legal basis</p>
              <div className="ct-chat-scope-citations">
                {citations.map((c) => (
                  <ChatCitationLink key={c.provision_long_id || c.label} citation={c} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ChatScopeLawCard({
  law,
  instrument,
  openQuestions = [],
  defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [questionsOpen, setQuestionsOpen] = useState(false);

  const summary = law.paragraphs[0] || "";
  const dimensions = [...(instrument?.dimensions ?? [])].sort((a, b) => {
    const ai = DIM_ORDER.indexOf(a.id);
    const bi = DIM_ORDER.indexOf(b.id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const questions = filterQuestions([...openQuestions, ...law.missingFacts]);
  const tone = verdictTone(law.verdict);

  return (
    <article className={`ct-chat-scope-card ${expanded ? "is-expanded" : ""}`}>
      <button
        type="button"
        className="ct-chat-scope-card-head"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="ct-chat-scope-card-head-main">
          <h4 className="ct-chat-scope-card-title">{law.lawTitle}</h4>
          <div className="ct-chat-scope-card-meta">
            <span className={`ct-chat-verdict-pill ct-chat-verdict-pill--${tone}`}>
              {law.verdict}
            </span>
            {law.confidence ? (
              <span className="ct-chat-scope-card-confidence">{law.confidence} confidence</span>
            ) : null}
          </div>
        </div>
        <span className="ct-chat-acc-chevron ct-chat-scope-card-chevron" aria-hidden>
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {expanded ? (
        <div className="ct-chat-scope-card-body">
          {summary ? <p className="ct-chat-scope-card-summary">{summary}</p> : null}

          {dimensions.length > 0 ? (
            <div className="ct-chat-scope-card-section">
              <p className="ct-chat-scope-card-section-label">Scope dimensions</p>
              <div className="ct-chat-dim-acc-stack">
                {dimensions.map((dim) => (
                  <DimensionAccordion
                    key={dim.id}
                    dim={dim}
                    regKey={instrument?.reg_key}
                  />
                ))}
              </div>
            </div>
          ) : law.dimensionNotes.length > 0 ? (
            <div className="ct-chat-scope-card-section">
              <p className="ct-chat-scope-card-section-label">Scope dimensions</p>
              {law.dimensionNotes.map((note) => (
                <p key={note.slice(0, 60)} className="ct-chat-scope-law-dim">
                  {note}
                </p>
              ))}
            </div>
          ) : null}

          {law.factsUsed.length > 0 ? (
            <p className="ct-chat-scope-card-facts">
              <strong>Facts on record:</strong> {law.factsUsed.join("; ")}
            </p>
          ) : null}

          {questions.length > 0 ? (
            <div className={`ct-chat-questions-acc ${questionsOpen ? "is-open" : ""}`}>
              <button
                type="button"
                className="ct-chat-questions-acc-head"
                onClick={() => setQuestionsOpen((v) => !v)}
                aria-expanded={questionsOpen}
              >
                <span>Open questions ({questions.length})</span>
                <span className="ct-chat-acc-chevron" aria-hidden>
                  {questionsOpen ? "▾" : "▸"}
                </span>
              </button>
              {questionsOpen ? (
                <ul className="ct-chat-scope-law-questions">
                  {questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
