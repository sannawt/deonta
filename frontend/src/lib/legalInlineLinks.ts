import { resolveExternalSourceUrl } from "./externalLegalSources";
import { eurlexUrlFromRefText } from "./legalLinks";

export interface TextSegment {
  kind: "text" | "link";
  text: string;
  href?: string;
}

/**
 * Inline legal reference pattern:
 *   Art. 6(1)  |  Art 3  |  Arts. 6, 7  |  Article 6  |  Articles 6 and 7
 *   Recital 50  |  Recitals 12, 50, 55
 *   Annex I    |  Annex III point 2
 *   paragraph 1 / para. 1
 */
const INLINE_REF_RE =
  /\b(?:Recitals?\s+\d+(?:\s*[,&and\s]+\d+)*|Articles?\s+\d+(?:\(\d+\))*(?:\([a-z]\))?(?:(?:\s*[,&]\s*|\s+and\s+)\d+(?:\(\d+\))*(?:\([a-z]\))?)*|Arts?\.?\s*\d+(?:\(\d+\))*(?:\([a-z]\))?(?:\s*[,&]\s*\d+(?:\(\d+\))*(?:\([a-z]\))?)*|Annex(?:es)?\s+[IVXLC]+(?:\s+point\s+\d+)?|Chapter\s+[IVXLC]+|Title\s+[IVXLC]+|para(?:graph|\.)\s*\d+(?:\(\d+\))?(?:\([a-z]\))?|Digital Omnibus|AI Act implementation timeline|EDPB guidelines|Cyber Resilience Act \(EC\)|Digital Services Act \(EC\)|Digital Markets Act \(EC\)|NIS2 Directive \(EC\)|EU Data Act \(EC\))\b/gi;

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
    const href =
      resolveExternalSourceUrl(raw) ??
      eurlexUrlFromRefText(raw, regKey) ??
      undefined;
    segments.push({ kind: href ? "link" : "text", text: raw, href });
    lastIndex = start + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: "text", text: text.slice(lastIndex) });
  }

  return segments;
}
