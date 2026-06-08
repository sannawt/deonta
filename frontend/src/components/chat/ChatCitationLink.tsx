import type { ScopeCitation } from "../../types/chat";

interface Props {
  citation: ScopeCitation;
}

export function ChatCitationLink({ citation }: Props) {
  const title = [citation.display || citation.label, citation.title, citation.excerpt]
    .filter(Boolean)
    .join(" — ");

  if (citation.eurlex_url) {
    return (
      <a
        href={citation.eurlex_url}
        target="_blank"
        rel="noopener noreferrer"
        className="ct-chat-cite-link"
        title={title}
      >
        {citation.label}
        <span className="ct-chat-cite-ext" aria-hidden>
          ↗
        </span>
      </a>
    );
  }

  return (
    <span className="ct-chat-cite-link ct-chat-cite-link--static" title={title}>
      {citation.label}
    </span>
  );
}
