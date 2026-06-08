import type { ScopeCitation } from "../../types/chat";

interface Props {
  citation: ScopeCitation;
  className?: string;
}

export function ChatCitationLink({ citation, className = "ct-chat-cite-link" }: Props) {
  const title = [citation.display || citation.label, citation.title, citation.excerpt]
    .filter(Boolean)
    .join(" — ");

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
