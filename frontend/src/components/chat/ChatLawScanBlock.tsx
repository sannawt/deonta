import { useState } from "react";
import type { LawScanResult } from "../../lib/api";

interface Props {
  laws: LawScanResult[];
  primaryCount: number;
}

function lawLabel(law: LawScanResult): string {
  return law.ui_label || law.label || law.short || law.code;
}

export function ChatLawScanBlock({ laws, primaryCount }: Props) {
  const [showMore, setShowMore] = useState(false);

  if (!laws.length) {
    return <p className="ct-chat-prose">No regulations matched above the relevance threshold.</p>;
  }

  const top = laws.slice(0, primaryCount);
  const rest = laws.slice(primaryCount);

  return (
    <div className="ct-chat-law-scan-card">
      <p className="ct-chat-prose">
        I found <strong>{laws.length}</strong> potentially applicable regulation
        {laws.length === 1 ? "" : "s"}. Assessing these first:
      </p>
      <ul className="ct-chat-law-chips">
        {top.map((law) => (
          <li key={law.code} className="ct-chat-law-chip">
            <span className="ct-chat-law-chip-name">{lawLabel(law)}</span>
            {law.number ? <span className="ct-chat-law-chip-num">{law.number}</span> : null}
          </li>
        ))}
      </ul>
      {rest.length > 0 ? (
        <div className="ct-chat-law-more">
          <button
            type="button"
            className="ct-chat-law-more-btn"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
          >
            {showMore ? "Hide" : "Show"} {rest.length} other match{rest.length === 1 ? "" : "es"}
            <span className="ct-chat-acc-chevron" aria-hidden>
              {showMore ? " ▾" : " ▸"}
            </span>
          </button>
          {showMore ? (
            <ul className="ct-chat-law-more-list">
              {rest.map((law) => (
                <li key={law.code}>
                  {lawLabel(law)}
                  {law.number ? ` · ${law.number}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
