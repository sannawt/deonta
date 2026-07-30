import type { ScopeCitation } from "../../types/chat";
import { ProvisionText } from "../legal/ProvisionText";

interface Props {
  citation: ScopeCitation;
  scopeNote?: string;
  selected?: boolean;
  onSelect?: () => void;
}

export function ScopeProvisionCard({ citation, scopeNote, selected = false, onSelect }: Props) {
  const hasOfficialText = Boolean(citation.text?.trim() || citation.excerpt?.trim());

  return (
    <article
      className={`ct-scope-provision-card${selected ? " ct-scope-provision-card--selected" : ""}`}
      id={`ct-scope-provision-${citation.provision_long_id || citation.label}`}
    >
      <header className="ct-scope-provision-card-head">
        <button
          type="button"
          className={`ct-scope-cite-chip ct-scope-cite-chip--sm ct-scope-provision-chip${selected ? " ct-scope-provision-chip--selected" : ""}`}
          onClick={onSelect}
        >
          {citation.label}
        </button>
        {citation.eurlex_url ? (
          <a
            href={citation.eurlex_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ct-scope-provision-eurlex"
          >
            Open on EUR-Lex
            <span className="ct-cite-ext" aria-hidden>
              ↗
            </span>
          </a>
        ) : null}
      </header>

      {hasOfficialText ? (
        <ProvisionText
          title={citation.title}
          text={citation.text}
          excerpt={citation.excerpt}
          className="ct-scope-provision-text"
        />
      ) : scopeNote ? (
        <div className="ct-scope-provision-fallback">
          <p className="ct-scope-provision-fallback-label">Scope note</p>
          <p className="ct-scope-provision-fallback-text">{scopeNote}</p>
          {citation.eurlex_url ? (
            <p className="ct-scope-provision-fallback-hint">
              Full statutory text is not loaded in-app for this provision. Use EUR-Lex for the
              official wording.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="ct-scope-provision-fallback-hint">
          No in-app text available for this provision.
          {citation.eurlex_url ? " Open on EUR-Lex for the official wording." : ""}
        </p>
      )}

      {hasOfficialText && scopeNote ? (
        <p className="ct-scope-provision-scope-note">
          <span className="ct-scope-provision-scope-note-label">Scope note:</span> {scopeNote}
        </p>
      ) : null}
    </article>
  );
}
