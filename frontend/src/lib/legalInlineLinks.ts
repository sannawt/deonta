import { eurlexUrlFromRefText } from "./legalLinks";

export interface TextSegment {
  kind: "text" | "link";
  text: string;
  href?: string;
}

/**
 * Inline legal reference pattern:
 *   Art. 6(1)  |  Art 3  |  Arts. 6, 7  |  Recital 50  |  Recitals 12, 50, 55
 *   Annex I    |  Annex III point 2
 */
const INLINE_REF_RE =
  /\b(?:Recitals?\s+\d+(?:\s*[,&]\s*\d+)*|Arts?\.?\s*\d+(?:\(\d+\))?(?:\s*[,&]\s*\d+(?:\(\d+\))?)*|Annex\s+[IVX]+(?:\s+point\s+\d+)?)\b/gi;

/**
 * Split a plain-text string into segments. Each "link" segment represents
 * a legal reference (Art. X, Recital Y, Annex Z) that can be linked to EUR-Lex.
 */
export function parseInlineLegalRefs(
  text: string,
  regKey?: string,
): TextSegment[] {
  if (!text) return [];

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_REF_RE)) {
    const start = match.index!;
    if (start > lastIndex) {
      segments.push({ kind: "text", text: text.slice(lastIndex, start) });
    }
    const raw = match[0];
    const href = eurlexUrlFromRefText(raw, regKey) ?? undefined;
    segments.push({ kind: href ? "link" : "text", text: raw, href });
    lastIndex = start + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: "text", text: text.slice(lastIndex) });
  }

  return segments;
}
