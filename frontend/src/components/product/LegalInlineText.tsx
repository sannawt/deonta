import { useMemo } from "react";
import { parseInlineLegalRefs } from "../../lib/legalInlineLinks";

interface Props {
  text: string;
  regKey?: string;
  className?: string;
}

export function LegalInlineText({ text, regKey, className }: Props) {
  const segments = useMemo(() => parseInlineLegalRefs(text, regKey), [text, regKey]);

  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.kind === "link" && seg.href ? (
          <a
            key={i}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer"
            className="ct-scope-inline-link"
          >
            {seg.text}
            <span className="ct-cite-ext" aria-hidden>↗</span>
          </a>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
}
