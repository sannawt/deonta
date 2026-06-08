import type { ScopeChatDocument } from "../../lib/scopeChatNarrative";
import { groupLabel } from "../../lib/scopeChatNarrative";

interface Props {
  document: ScopeChatDocument;
  loading?: boolean;
}

export function ScopeAnalysisChatBlock({ document, loading = false }: Props) {
  let lastGroup: string | null = null;

  return (
    <article className="ct-scope-chat-doc">
      <header className="ct-scope-chat-doc-head">
        <h3 className="ct-scope-chat-doc-title">
          Scope analysis: {document.productTitle}
          {loading ? " (assessing…)" : ""}
        </h3>
      </header>

      {document.intro ? (
        <p className="ct-scope-chat-doc-lead">{document.intro}</p>
      ) : null}
      {document.overview ? (
        <p className="ct-scope-chat-doc-overview">{document.overview}</p>
      ) : null}
      {document.summaryLine ? (
        <p className="ct-scope-chat-doc-summary">{document.summaryLine}</p>
      ) : null}

      <div className="ct-scope-chat-doc-body">
        {document.lawBlocks.map((law) => {
          const showGroup = law.group !== lastGroup;
          if (showGroup) lastGroup = law.group;
          return (
            <section key={`${law.group}-${law.lawTitle}`} className="ct-scope-chat-law">
              {showGroup ? (
                <h4 className="ct-scope-chat-law-group">{groupLabel(law.group)}</h4>
              ) : null}

              <h5 className="ct-scope-chat-law-title">{law.lawTitle}</h5>
              <p className="ct-scope-chat-law-verdict">
                <strong>{law.verdict}</strong>
                {law.confidence ? ` · ${law.confidence} confidence` : ""}
              </p>

              {law.paragraphs.map((p) => (
                <p key={p.slice(0, 48)} className="ct-scope-chat-law-p">
                  {p}
                </p>
              ))}

              {law.dimensionNotes.length > 0 ? (
                <div className="ct-scope-chat-law-dims">
                  <p className="ct-scope-chat-law-dims-label">Per-dimension review</p>
                  {law.dimensionNotes.map((note) => (
                    <p key={note.slice(0, 60)} className="ct-scope-chat-law-dim">
                      {note}
                    </p>
                  ))}
                </div>
              ) : null}

              {law.factsUsed.length > 0 ? (
                <p className="ct-scope-chat-law-facts">
                  <strong>Facts on record:</strong> {law.factsUsed.join("; ")}.
                </p>
              ) : null}

              {law.missingFacts.length > 0 ? (
                <p className="ct-scope-chat-law-missing">
                  <strong>Still to confirm:</strong> {law.missingFacts.join("; ")}.
                </p>
              ) : null}
            </section>
          );
        })}
      </div>

      {document.openQuestions.length > 0 ? (
        <footer className="ct-scope-chat-doc-footer">
          <p className="ct-scope-chat-doc-questions-label">Open questions</p>
          <ul className="ct-scope-chat-doc-questions">
            {document.openQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </footer>
      ) : null}
    </article>
  );
}
