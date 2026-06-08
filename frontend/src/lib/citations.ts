import type { ScopeCitation } from "../types/chat";
import { eurlexUrlForProvision, eurlexUrlFromRefText } from "./legalLinks";

export function splitEvidenceRefs(text: string): { body: string; refs: string } {
  const match = text.match(/\s*Refs:\s*(.+)$/i);
  if (!match || match.index === undefined) {
    return { body: text.trim(), refs: "" };
  }
  return {
    body: text.slice(0, match.index).trim(),
    refs: match[1].trim(),
  };
}

export function dedupeCitations(items: (ScopeCitation | undefined | null)[]): ScopeCitation[] {
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

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

function extractArticleLabel(segment: string): string {
  const match = segment.match(/(?:Recital\s+\d+|Arts?\.?\s*\d+(?:\(\d+\))*(?:\([a-z]\))*)/i);
  return (match?.[0] || segment).trim();
}

function enrichCitation(citation: ScopeCitation, regKey?: string): ScopeCitation {
  const url =
    citation.eurlex_url ||
    eurlexUrlForProvision(citation.provision_long_id) ||
    eurlexUrlFromRefText(citation.label, regKey);
  return url ? { ...citation, eurlex_url: url } : citation;
}

export function collectDimensionCitations(
  dim: {
    citations?: ScopeCitation[];
    rules_invoked?: Array<{ citation?: ScopeCitation }>;
  },
  evidenceRefs = "",
  regKey?: string,
): ScopeCitation[] {
  const structured = dedupeCitations([
    ...(dim.citations ?? []),
    ...(dim.rules_invoked ?? []).map((rule) => rule.citation),
  ]).map((citation) => enrichCitation(citation, regKey));

  if (!evidenceRefs.trim()) {
    return structured;
  }

  const segments = evidenceRefs
    .split(/;\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const fromEvidence: ScopeCitation[] = [];
  for (const segment of segments) {
    const label = extractArticleLabel(segment);
    const normalized = normalizeLabel(label);
    const known = structured.find(
      (citation) =>
        normalizeLabel(citation.label) === normalized ||
        segment.toLowerCase().includes(citation.label.toLowerCase()),
    );
    if (known) {
      fromEvidence.push(known);
      continue;
    }

    const url = eurlexUrlFromRefText(label, regKey);
    fromEvidence.push({
      provision_long_id: label,
      label,
      eurlex_url: url,
    });
  }

  return dedupeCitations([...structured, ...fromEvidence]).map((citation) =>
    enrichCitation(citation, regKey),
  );
}
