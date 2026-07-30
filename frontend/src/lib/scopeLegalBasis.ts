import type { ScopeCitation, ScopeDimension, ScopeInstrument } from "../types/chat";
import { collectDimensionCitations, dedupeCitations, splitEvidenceRefs } from "./citations";
import { provisionsForDimension, normRegCode } from "./scopeProvisionCatalog";

const DIM_ORDER = ["temporal", "territorial", "material", "exclusions"] as const;

export type ScopeDimensionId = (typeof DIM_ORDER)[number];

export interface LawProvisionEntry {
  provisionLongId: string;
  citation: ScopeCitation;
  scopeNote?: string;
  dimensionIds: ScopeDimensionId[];
}

function catalogScopeNote(regKey: string, dimId: string, plid: string): string | undefined {
  const catalog = provisionsForDimension(normRegCode(regKey), dimId);
  const rule = catalog?.rules.find((r) => r.provision_long_id === plid);
  return rule?.rule_text?.trim() || undefined;
}

function citationsForDimension(dim: ScopeDimension, regKey: string): ScopeCitation[] {
  const { refs: evidenceRefs } = splitEvidenceRefs(
    dim.llm?.interpretation?.trim() || dim.evidence?.trim() || "",
  );
  const fromRules = collectDimensionCitations(dim, evidenceRefs, regKey);
  const proofLineCitations = (dim.proof_lines ?? [])
    .filter((pl) => pl.provision_long_id)
    .map((pl) => {
      const plid = pl.provision_long_id!;
      return {
        provision_long_id: plid,
        label: plid
          .replace(/^[A-Za-z]+_/, "")
          .replace(/^A(\d+)/, "Art. $1")
          .replace(/^R(\d+)/, "Recital $1"),
      } satisfies ScopeCitation;
    });
  return dedupeCitations([...fromRules, ...proofLineCitations]);
}

function ruleScopeNote(dim: ScopeDimension, plid: string): string | undefined {
  const rule = (dim.rules_invoked ?? []).find((r) => r.provision_long_id === plid);
  return rule?.rule_text?.trim() || undefined;
}

export function collectLawProvisions(
  instrument: ScopeInstrument | undefined,
  regKey: string,
): LawProvisionEntry[] {
  if (!instrument?.dimensions?.length) return [];

  const code = normRegCode(regKey || instrument.reg_key || "");
  const byId = new Map<string, LawProvisionEntry>();

  for (const dim of instrument.dimensions) {
    const dimId = dim.id as ScopeDimensionId;
    const citations = citationsForDimension(dim, code);

    for (const citation of citations) {
      const plid = citation.provision_long_id || citation.label;
      if (!plid) continue;

      const scopeNote =
        ruleScopeNote(dim, plid) ||
        catalogScopeNote(code, dimId, plid) ||
        undefined;

      const existing = byId.get(plid);
      if (existing) {
        if (!existing.dimensionIds.includes(dimId)) {
          existing.dimensionIds.push(dimId);
        }
        if (!existing.scopeNote && scopeNote) {
          existing.scopeNote = scopeNote;
        }
        if (!existing.citation.text && citation.text) {
          existing.citation = { ...existing.citation, ...citation };
        }
        continue;
      }

      byId.set(plid, {
        provisionLongId: plid,
        citation,
        scopeNote,
        dimensionIds: [dimId],
      });
    }
  }

  return [...byId.values()].sort((a, b) => a.citation.label.localeCompare(b.citation.label));
}

export function groupProvisionsByDimension(
  entries: LawProvisionEntry[],
): Array<{ dimensionId: ScopeDimensionId; label: string; provisions: LawProvisionEntry[] }> {
  const labels: Record<ScopeDimensionId, string> = {
    temporal: "Temporal",
    territorial: "Territorial",
    material: "Material",
    exclusions: "Exclusions",
  };

  return DIM_ORDER.map((dimensionId) => ({
    dimensionId,
    label: labels[dimensionId],
    provisions: entries.filter((entry) => entry.dimensionIds.includes(dimensionId)),
  })).filter((group) => group.provisions.length > 0);
}

export function collectProvisionIds(instrument: ScopeInstrument | undefined, regKey: string): string[] {
  return collectLawProvisions(instrument, regKey).map((entry) => entry.provisionLongId);
}

export function seedCitationsFromInstrument(
  instrument: ScopeInstrument | undefined,
  regKey: string,
): ScopeCitation[] {
  return collectLawProvisions(instrument, regKey).map((entry) => entry.citation);
}
