import type { ScopeCitation } from "../../types/chat";

interface Props {
  citation: ScopeCitation;
  className?: string;
  onSelect?: (citation: ScopeCitation) => void;
}

export function ChatCitationLink({ citation, className = "ct-chat-cite-link", onSelect }: Props) {
  const title = [citation.display || citation.label, citation.title, citation.excerpt]
    .filter(Boolean)
    .join(" — ");

  if (onSelect) {
    return (
      <span className={`${className} ct-cite-link--split`} title={title}>
        <button
          type="button"
          className="ct-cite-link-btn"
          onClick={() => onSelect(citation)}
        >
          {citation.label}
        </button>
        {citation.eurlex_url ? (
          <a
            href={citation.eurlex_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ct-cite-link-ext"
            aria-label={`Open ${citation.label} on EUR-Lex`}
            onClick={(e) => e.stopPropagation()}
          >
            <span aria-hidden>↗</span>
          </a>
        ) : null}
      </span>
    );
  }

  if (citation.eurlex_url) {
    return (
      <a
        href={citation.eurlex_url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        title={title}
      >
        {citation.label}
        <span className="ct-cite-ext" aria-hidden>
          ↗
        </span>
      </a>
    );
  }

  return (
    <span className={`${className} ct-cite-link--static`} title={title}>
      {citation.label}
    </span>
  );
}
