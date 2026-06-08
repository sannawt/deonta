import type { ScopeChatDocument } from "../../lib/scopeChatNarrative";
import type { ScopeCitation, ScopeDimension, ScopeInstrument } from "../../types/chat";
import {
  dimensionResultPlain,
  dimensionResultSentence,
} from "../../lib/plainLanguage";
import { formatEngineTokens } from "../../lib/utils";
import { ChatCitationLink } from "./ChatCitationLink";

const DIM_ORDER = ["temporal", "territorial", "material", "exclusions"];

interface Props {
  document: ScopeChatDocument;
  instruments: ScopeInstrument[];
  loading?: boolean;
}

function dedupeCitations(items: (ScopeCitation | undefined | null)[]): ScopeCitation[] {
  const seen = new Set<string>();
  const out: ScopeCitation[] = [];
  for (const item of items) {
    if (!item?.label) continue;
    const key = item.provision_long_id || item.label;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
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

function ChatScopeDimension({ dim }: { dim: ScopeDimension }) {
  const resultLabel = dimensionResultPlain(dim.result);
  const analysis =
    dim.llm?.interpretation?.trim() ||
    dim.evidence?.trim() ||
    dimensionResultSentence(dim.label, dim.result);
  const why = dim.llm?.why_result?.trim() || "";
  const citations = dedupeCitations([
    ...(dim.citations ?? []),
    ...(dim.rules_invoked ?? []).map((r) => r.citation),
  ]);

  return (
    <div className="ct-chat-scope-dim">
      <h6 className="ct-chat-scope-dim-title">
        {dim.label}
        <span className="ct-chat-scope-dim-result">— {resultLabel}</span>
      </h6>

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
  );
}

function instrumentForLaw(
  instruments: ScopeInstrument[],
  lawTitle: string,
): ScopeInstrument | undefined {
  const norm = lawTitle.toLowerCase();
  return instruments.find((inst) => {
    const candidates = [inst.full_name, inst.label, inst.id].filter(Boolean).map((v) =>
      String(v).toLowerCase(),
    );
    return candidates.some((c) => norm.includes(c) || c.includes(norm.split("—")[0].trim()));
  });
}

export function ChatScopeTextReport({ document, instruments, loading = false }: Props) {
  return (
    <article className="ct-chat-scope-report">
      <header className="ct-chat-scope-report-head">
        <h3 className="ct-chat-scope-report-title">
          Scope review: {document.productTitle}
          {loading ? " (assessing…)" : ""}
        </h3>
      </header>

      {document.intro ? <p className="ct-chat-scope-report-lead">{document.intro}</p> : null}
      {document.overview ? (
        <p className="ct-chat-scope-report-overview">{document.overview}</p>
      ) : null}
      {document.summaryLine ? (
        <p className="ct-chat-scope-report-summary">{document.summaryLine}</p>
      ) : null}

      <div className="ct-chat-scope-report-body">
        {document.lawBlocks.map((law) => {
          const instrument = instrumentForLaw(instruments, law.lawTitle);
          const dimensions = [...(instrument?.dimensions ?? [])].sort((a, b) => {
            const ai = DIM_ORDER.indexOf(a.id);
            const bi = DIM_ORDER.indexOf(b.id);
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
          });

          return (
            <section key={law.lawTitle} className="ct-chat-scope-law">
              <h4 className="ct-chat-scope-law-title">{law.lawTitle}</h4>
              <p className="ct-chat-scope-law-verdict">
                <strong>{law.verdict}</strong>
                {law.confidence ? ` · ${law.confidence} confidence` : ""}
              </p>

              {law.paragraphs.map((p) => (
                <p key={p.slice(0, 48)} className="ct-chat-scope-law-p">
                  {p}
                </p>
              ))}

              {dimensions.length > 0 ? (
                <div className="ct-chat-scope-dims">
                  <p className="ct-chat-scope-dims-label">Scope dimensions</p>
                  {dimensions.map((dim) => (
                    <ChatScopeDimension key={dim.id} dim={dim} />
                  ))}
                </div>
              ) : law.dimensionNotes.length > 0 ? (
                <div className="ct-chat-scope-dims">
                  <p className="ct-chat-scope-dims-label">Scope dimensions</p>
                  {law.dimensionNotes.map((note) => (
                    <p key={note.slice(0, 60)} className="ct-chat-scope-law-dim">
                      {note}
                    </p>
                  ))}
                </div>
              ) : null}

              {law.factsUsed.length > 0 ? (
                <p className="ct-chat-scope-law-facts">
                  <strong>Facts on record:</strong> {law.factsUsed.join("; ")}.
                </p>
              ) : null}

              {law.missingFacts.length > 0 ? (
                <p className="ct-chat-scope-law-missing">
                  <strong>Still to confirm:</strong> {law.missingFacts.join("; ")}.
                </p>
              ) : null}
            </section>
          );
        })}
      </div>

      {document.openQuestions.length > 0 ? (
        <footer className="ct-chat-scope-report-footer">
          <p className="ct-chat-scope-report-questions-label">Open questions</p>
          <ul className="ct-chat-scope-report-questions">
            {document.openQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </footer>
      ) : null}
    </article>
  );
}
