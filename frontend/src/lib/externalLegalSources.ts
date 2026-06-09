/** Named external legal sources (non-EUR-Lex) linkable from scope analysis prose. */

export interface ExternalLegalSource {
  id: string;
  label: string;
  url: string;
  /** Alternate phrases that should link to this source in inline text. */
  aliases: string[];
}

export const EXTERNAL_LEGAL_SOURCES: ExternalLegalSource[] = [
  {
    id: "digital_omnibus",
    label: "Digital Omnibus",
    url: "https://commission.europa.eu/news-and-media/news/simplification-digital-rules-omnibus-2025_en",
    aliases: ["Digital Omnibus", "EU Digital Omnibus", "Omnibus package"],
  },
  {
    id: "ai_act_ec",
    label: "AI Act implementation timeline",
    url: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
    aliases: [
      "AI Act implementation timeline",
      "EC AI Act page",
      "EU AI Act regulatory framework",
    ],
  },
  {
    id: "cra_ec",
    label: "Cyber Resilience Act (EC)",
    url: "https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act",
    aliases: ["CRA EC guidance", "Cyber Resilience Act EC page"],
  },
  {
    id: "gdpr_edpb",
    label: "EDPB guidelines",
    url: "https://www.edpb.europa.eu/our-work-tools/general-guidance/guidelines-recommendations-best-practices_en",
    aliases: ["EDPB guidelines", "EDPB guidance"],
  },
  {
    id: "dsa_ec",
    label: "Digital Services Act (EC)",
    url: "https://digital-strategy.ec.europa.eu/en/policies/digital-services-act-package",
    aliases: ["DSA EC page", "Digital Services Act EC"],
  },
  {
    id: "dma_ec",
    label: "Digital Markets Act (EC)",
    url: "https://digital-strategy.ec.europa.eu/en/policies/digital-markets-act",
    aliases: ["DMA EC page", "Digital Markets Act EC"],
  },
  {
    id: "nis2_ec",
    label: "NIS2 Directive (EC)",
    url: "https://digital-strategy.ec.europa.eu/en/policies/nis2-directive",
    aliases: ["NIS2 EC page", "NIS2 implementation"],
  },
  {
    id: "data_act_ec",
    label: "EU Data Act (EC)",
    url: "https://digital-strategy.ec.europa.eu/en/policies/data-act",
    aliases: ["Data Act EC page", "EU Data Act EC"],
  },
];

const SOURCE_BY_ID = Object.fromEntries(
  EXTERNAL_LEGAL_SOURCES.map((s) => [s.id, s]),
) as Record<string, ExternalLegalSource>;

/** External sources commonly cited per regulation and scope dimension. */
const LAW_DIM_EXTERNAL: Record<string, Partial<Record<string, string[]>>> = {
  ai_act: {
    temporal: ["digital_omnibus", "ai_act_ec"],
    material: ["ai_act_ec"],
    territorial: ["ai_act_ec"],
  },
  cra: {
    temporal: ["cra_ec", "digital_omnibus"],
    material: ["cra_ec"],
    territorial: ["cra_ec"],
    exclusions: ["cra_ec"],
  },
  gdpr: {
    material: ["gdpr_edpb"],
    territorial: ["gdpr_edpb"],
  },
  dsa: {
    temporal: ["dsa_ec", "digital_omnibus"],
    material: ["dsa_ec"],
  },
  dma: {
    temporal: ["dma_ec", "digital_omnibus"],
    material: ["dma_ec"],
  },
  nis2: {
    temporal: ["nis2_ec"],
    material: ["nis2_ec"],
  },
  data_act: {
    temporal: ["data_act_ec", "digital_omnibus"],
    material: ["data_act_ec"],
  },
};

export function externalSourcesForLawDim(
  code: string,
  dimId: string,
): ExternalLegalSource[] {
  const key = code.toLowerCase().replace(/-/g, "_").replace(/^eu_/, "");
  const ids = LAW_DIM_EXTERNAL[key]?.[dimId] ?? [];
  return ids.map((id) => SOURCE_BY_ID[id]).filter(Boolean);
}

export function resolveExternalSourceUrl(text: string): string | null {
  const trimmed = (text || "").trim();
  for (const source of EXTERNAL_LEGAL_SOURCES) {
    if (source.label.toLowerCase() === trimmed.toLowerCase()) return source.url;
    for (const alias of source.aliases) {
      if (alias.toLowerCase() === trimmed.toLowerCase()) return source.url;
    }
  }
  return null;
}
