/**
 * Per-regulation scope provisions for narrative enrichment and citation chips.
 */

import type { ScopeCitation, ScopeRuleInvoked } from "../types/chat";

export interface DimensionProvisionSet {
  rules: ScopeRuleInvoked[];
  /** Inline ref string woven into analysis prose (parsed by LegalInlineText). */
  refsLine: string;
}

function rule(
  provision_long_id: string,
  label: string,
  rule_text: string,
): ScopeRuleInvoked {
  const citation: ScopeCitation = { provision_long_id, label };
  return { provision_long_id, citation, rule_text };
}

type Catalog = Record<string, Partial<Record<string, DimensionProvisionSet>>>;

const CATALOG: Catalog = {
  ai_act: {
    temporal: {
      refsLine: "Art. 113, Art. 2, Recital 25",
      rules: [
        rule("AIAct_A113", "Art. 113", "Entry into force and application dates for the AI Act."),
        rule("AIAct_A2", "Art. 2", "Scope — AI systems placed on the market, put into service, or used in the Union."),
        rule("AIAct_R25", "Recital 25", "Machine-based systems designed to operate with varying levels of autonomy."),
      ],
    },
    territorial: {
      refsLine: "Art. 2(1), Art. 3, Recital 22",
      rules: [
        rule("AIAct_A2", "Art. 2(1)", "Territorial scope for placement on the Union market and use in the Union."),
        rule("AIAct_A3", "Art. 3", "Definitions of provider, deployer, and importer."),
        rule("AIAct_R22", "Recital 22", "Embedded and component AI systems placed on the Union market."),
      ],
    },
    material: {
      refsLine: "Art. 3(1), Art. 6, Annex III, Recital 25",
      rules: [
        rule("AIAct_A3", "Art. 3(1)", "Definition of AI system."),
        rule("AIAct_A6", "Art. 6", "Classification rules for high-risk AI systems."),
        rule("AIAct_AnnexIII", "Annex III", "High-risk AI systems (employment, credit, biometrics, etc.)."),
        rule("AIAct_R25", "Recital 25", "Autonomy and adaptiveness of AI systems."),
      ],
    },
    exclusions: {
      refsLine: "Art. 2(3), Art. 2(5), Recital 14",
      rules: [
        rule("AIAct_A2", "Art. 2(3)", "Exclusions for national security, R&D, and non-professional use."),
        rule("AIAct_A2", "Art. 2(5)", "Relationship with other Union law including GDPR."),
        rule("AIAct_R14", "Recital 14", "Consistent high level of protection without fragmenting the internal market."),
      ],
    },
  },
  gdpr: {
    temporal: {
      refsLine: "Art. 99, Recital 171",
      rules: [
        rule("GDPR_A99", "Art. 99", "Entry into force and application of the GDPR."),
        rule("GDPR_R171", "Recital 171", "Application from 25 May 2018."),
      ],
    },
    territorial: {
      refsLine: "Art. 3, Recital 24, Recital 26",
      rules: [
        rule("GDPR_A3", "Art. 3", "Territorial scope — establishment, offering, monitoring."),
        rule("GDPR_R24", "Recital 24", "Processing in the context of activities of an establishment."),
        rule("GDPR_R26", "Recital 26", "Not applicable to processing by natural persons in a household context."),
      ],
    },
    material: {
      refsLine: "Art. 4, Art. 6, Art. 9, Recital 30",
      rules: [
        rule("GDPR_A4", "Art. 4", "Definitions of personal data and processing."),
        rule("GDPR_A6", "Art. 6", "Lawful bases for processing."),
        rule("GDPR_A9", "Art. 9", "Special categories of personal data."),
        rule("GDPR_R30", "Recital 30", "Online identifiers may constitute personal data."),
      ],
    },
    exclusions: {
      refsLine: "Art. 2, Recital 29",
      rules: [
        rule("GDPR_A2", "Art. 2", "Material scope — processing of personal data."),
        rule("GDPR_R29", "Recital 29", "Household exemption for purely personal activity."),
      ],
    },
  },
  cra: {
    temporal: {
      refsLine: "Art. 59, Art. 2, Recital 91",
      rules: [
        rule("CRA_A59", "Art. 59", "Entry into force and application of the Cyber Resilience Act."),
        rule("CRA_A2", "Art. 2", "Scope of products with digital elements."),
        rule("CRA_R91", "Recital 91", "Staged application for different product categories."),
      ],
    },
    territorial: {
      refsLine: "Art. 2(1), Art. 2(2), Recital 30",
      rules: [
        rule("CRA_A2", "Art. 2(1)", "Products with digital elements made available on the Union market."),
        rule("CRA_A2", "Art. 2(2)", "Economic operators placing products on the market."),
        rule("CRA_R30", "Recital 30", "Products with digital elements regardless of sale or free distribution."),
      ],
    },
    material: {
      refsLine: "Art. 2, Art. 10, Annex I, Recital 30",
      rules: [
        rule("CRA_A2", "Art. 2", "Definition of product with digital elements."),
        rule("CRA_A10", "Art. 10", "Essential cybersecurity requirements."),
        rule("CRA_AnnexI", "Annex I", "Categories of products with digital elements."),
        rule("CRA_R30", "Recital 30", "Software, firmware, and connected devices in scope."),
      ],
    },
    exclusions: {
      refsLine: "Art. 2(4), Art. 2(5), Recital 31",
      rules: [
        rule("CRA_A2", "Art. 2(4)", "Exclusions for products already covered by sector-specific Union law."),
        rule("CRA_A2", "Art. 2(5)", "Exclusions for medical devices, aviation, and motor vehicles."),
        rule("CRA_R31", "Recital 31", "Relationship with existing harmonised product legislation."),
      ],
    },
  },
  dsa: {
    temporal: {
      refsLine: "Art. 93, Art. 2",
      rules: [
        rule("DSA_A93", "Art. 93", "Entry into force and application of the DSA."),
        rule("DSA_A2", "Art. 2", "Scope of intermediary services."),
      ],
    },
    territorial: {
      refsLine: "Art. 2, Art. 3, Recital 7",
      rules: [
        rule("DSA_A2", "Art. 2", "Scope for intermediary services offered in the Union."),
        rule("DSA_A3", "Art. 3", "Definitions of intermediary services and recipients."),
      ],
    },
    material: {
      refsLine: "Art. 3, Art. 14, Art. 16, Recital 16",
      rules: [
        rule("DSA_A3", "Art. 3", "Definitions of hosting, online platform, and VLOP."),
        rule("DSA_A14", "Art. 14", "Liability regime for hosting services."),
        rule("DSA_A16", "Art. 16", "Notice and action mechanisms."),
      ],
    },
    exclusions: {
      refsLine: "Art. 2(3), Recital 8",
      rules: [rule("DSA_A2", "Art. 2(3)", "Exclusions for certain small enterprises and activity types.")],
    },
  },
  dma: {
    temporal: {
      refsLine: "Art. 54, Art. 2",
      rules: [
        rule("DMA_A54", "Art. 54", "Entry into force and application."),
        rule("DMA_A2", "Art. 2", "Scope of core platform services."),
      ],
    },
    territorial: {
      refsLine: "Art. 2, Art. 3, Recital 11",
      rules: [
        rule("DMA_A2", "Art. 2", "Scope for gatekeepers providing core platform services in the Union."),
        rule("DMA_A3", "Art. 3", "Gatekeeper designation criteria."),
      ],
    },
    material: {
      refsLine: "Art. 3, Art. 5, Annex I",
      rules: [
        rule("DMA_A3", "Art. 3", "Gatekeeper designation thresholds."),
        rule("DMA_A5", "Art. 5", "Obligations for gatekeepers."),
        rule("DMA_AnnexI", "Annex I", "Core platform services."),
      ],
    },
    exclusions: {
      refsLine: "Art. 2(2), Recital 10",
      rules: [rule("DMA_A2", "Art. 2(2)", "Exclusions for undertakings below gatekeeper thresholds.")],
    },
  },
  nis2: {
    temporal: {
      refsLine: "Art. 41, Art. 2",
      rules: [
        rule("NIS2_A41", "Art. 41", "Transposition deadline and application."),
        rule("NIS2_A2", "Art. 2", "Scope of essential and important entities."),
      ],
    },
    territorial: {
      refsLine: "Art. 2, Art. 3, Recital 8",
      rules: [
        rule("NIS2_A2", "Art. 2", "Scope for entities providing services in the Union."),
        rule("NIS2_A3", "Art. 3", "Essential and important entities."),
      ],
    },
    material: {
      refsLine: "Art. 3, Art. 21, Annex I, Annex II",
      rules: [
        rule("NIS2_A3", "Art. 3", "Definitions of essential and important entities."),
        rule("NIS2_A21", "Art. 21", "Cybersecurity risk-management measures."),
        rule("NIS2_AnnexI", "Annex I", "Sectors using the general approach."),
        rule("NIS2_AnnexII", "Annex II", "Sectors using the sector-specific approach."),
      ],
    },
    exclusions: {
      refsLine: "Art. 2(3), Art. 2(4), Recital 12",
      rules: [rule("NIS2_A2", "Art. 2(3)", "Exclusions for entities below size thresholds.")],
    },
  },
  data_act: {
    temporal: {
      refsLine: "Art. 50, Art. 2",
      rules: [
        rule("DataAct_A50", "Art. 50", "Entry into force and application."),
        rule("DataAct_A2", "Art. 2", "Scope of the Data Act."),
      ],
    },
    territorial: {
      refsLine: "Art. 2, Art. 3, Recital 8",
      rules: [
        rule("DataAct_A2", "Art. 2", "Scope for connected products and related services in the Union."),
        rule("DataAct_A3", "Art. 3", "Definitions."),
      ],
    },
    material: {
      refsLine: "Art. 3, Art. 4, Art. 23, Recital 14",
      rules: [
        rule("DataAct_A3", "Art. 3", "Connected product and related service definitions."),
        rule("DataAct_A4", "Art. 4", "User access to data."),
        rule("DataAct_A23", "Art. 23", "Switching between data processing services."),
      ],
    },
    exclusions: {
      refsLine: "Art. 2(3), Recital 9",
      rules: [rule("DataAct_A2", "Art. 2(3)", "Exclusions for SMEs and certain data uses.")],
    },
  },
  eprivacy: {
    temporal: {
      refsLine: "Art. 15, Art. 2",
      rules: [
        rule("ePrivacy_A15", "Art. 15", "Implementation by Member States."),
        rule("ePrivacy_A2", "Art. 2", "Scope of the ePrivacy Directive."),
      ],
    },
    territorial: {
      refsLine: "Art. 2, Art. 3, Recital 8",
      rules: [
        rule("ePrivacy_A2", "Art. 2", "Scope for electronic communications services in the Union."),
        rule("ePrivacy_A3", "Art. 3", "Definitions."),
      ],
    },
    material: {
      refsLine: "Art. 5, Art. 6, Art. 13",
      rules: [
        rule("ePrivacy_A5", "Art. 5", "Confidentiality of communications."),
        rule("ePrivacy_A6", "Art. 6", "Traffic data."),
        rule("ePrivacy_A13", "Art. 13", "Unsolicited communications."),
      ],
    },
    exclusions: {
      refsLine: "Art. 2(2), Recital 12",
      rules: [rule("ePrivacy_A2", "Art. 2(2)", "Exclusions for certain public security activities.")],
    },
  },
  dora: {
    temporal: {
      refsLine: "Art. 123, Art. 2",
      rules: [
        rule("DORA_A123", "Art. 123", "Entry into force and application of DORA."),
        rule("DORA_A2", "Art. 2", "Scope of DORA."),
      ],
    },
    territorial: {
      refsLine: "Art. 2, Art. 3, Recital 8",
      rules: [
        rule("DORA_A2", "Art. 2", "Scope for financial entities in the Union."),
        rule("DORA_A3", "Art. 3", "Definitions."),
      ],
    },
    material: {
      refsLine: "Art. 2, Art. 5, Art. 28",
      rules: [
        rule("DORA_A2", "Art. 2", "Financial entities and ICT third-party providers."),
        rule("DORA_A5", "Art. 5", "ICT risk management framework."),
        rule("DORA_A28", "Art. 28", "ICT third-party risk."),
      ],
    },
    exclusions: {
      refsLine: "Art. 2(3), Recital 14",
      rules: [rule("DORA_A2", "Art. 2(3)", "Proportionality and entity-level exclusions.")],
    },
  },
  gpsr: {
    temporal: {
      refsLine: "Art. 51, Art. 2",
      rules: [
        rule("GPSR_A51", "Art. 51", "Entry into force and application."),
        rule("GPSR_A2", "Art. 2", "Scope of GPSR."),
      ],
    },
    territorial: {
      refsLine: "Art. 2, Art. 4, Recital 10",
      rules: [
        rule("GPSR_A2", "Art. 2", "Products made available on the Union market."),
        rule("GPSR_A4", "Art. 4", "Definitions."),
      ],
    },
    material: {
      refsLine: "Art. 5, Art. 6, Art. 22",
      rules: [
        rule("GPSR_A5", "Art. 5", "General safety requirements."),
        rule("GPSR_A6", "Art. 6", "Specific product requirements."),
        rule("GPSR_A22", "Art. 22", "Product traceability."),
      ],
    },
    exclusions: {
      refsLine: "Art. 2(3), Recital 15",
      rules: [rule("GPSR_A2", "Art. 2(3)", "Exclusions for antiques and certain second-hand goods.")],
    },
  },
  red: {
    temporal: {
      refsLine: "Art. 58, Art. 2",
      rules: [
        rule("RED_A58", "Art. 58", "Transitional provisions."),
        rule("RED_A2", "Art. 2", "Scope of RED."),
      ],
    },
    territorial: {
      refsLine: "Art. 2, Art. 3, Recital 8",
      rules: [
        rule("RED_A2", "Art. 2", "Radio equipment placed on the Union market."),
        rule("RED_A3", "Art. 3", "Essential requirements."),
      ],
    },
    material: {
      refsLine: "Art. 3, Annex I, Art. 10",
      rules: [
        rule("RED_A3", "Art. 3", "Essential requirements for radio equipment."),
        rule("RED_AnnexI", "Annex I", "Product categories."),
        rule("RED_A10", "Art. 10", "Conformity assessment."),
      ],
    },
    exclusions: {
      refsLine: "Art. 1(2), Recital 12",
      rules: [rule("RED_A1", "Art. 1(2)", "Exclusions for certain military and custom equipment.")],
    },
  },
  rohs: {
    temporal: {
      refsLine: "Art. 26, Art. 2",
      rules: [
        rule("RoHS_A26", "Art. 26", "Entry into force."),
        rule("RoHS_A2", "Art. 2", "Scope of RoHS."),
      ],
    },
    territorial: {
      refsLine: "Art. 2, Art. 3, Recital 6",
      rules: [
        rule("RoHS_A2", "Art. 2", "EEE placed on the Union market."),
        rule("RoHS_A3", "Art. 3", "Definitions."),
      ],
    },
    material: {
      refsLine: "Art. 4, Annex II, Annex I",
      rules: [
        rule("RoHS_A4", "Art. 4", "Restricted substances."),
        rule("RoHS_AnnexII", "Annex II", "Restriction list."),
        rule("RoHS_AnnexI", "Annex I", "Categories of EEE."),
      ],
    },
    exclusions: {
      refsLine: "Art. 2(4), Annex I",
      rules: [rule("RoHS_A2", "Art. 2(4)", "Exclusions for certain equipment categories.")],
    },
  },
  weee: {
    temporal: {
      refsLine: "Art. 27, Art. 2",
      rules: [
        rule("WEEE_A27", "Art. 27", "Entry into force."),
        rule("WEEE_A2", "Art. 2", "Scope of WEEE."),
      ],
    },
    territorial: {
      refsLine: "Art. 2, Art. 3, Recital 7",
      rules: [
        rule("WEEE_A2", "Art. 2", "EEE placed on the Union market."),
        rule("WEEE_A3", "Art. 3", "Definitions."),
      ],
    },
    material: {
      refsLine: "Art. 14, Annex I, Art. 7",
      rules: [
        rule("WEEE_A14", "Art. 14", "Producer responsibility."),
        rule("WEEE_AnnexI", "Annex I", "Categories of EEE."),
        rule("WEEE_A7", "Art. 7", "Collection and treatment."),
      ],
    },
    exclusions: {
      refsLine: "Art. 2(4), Annex II",
      rules: [rule("WEEE_A2", "Art. 2(4)", "Exclusions for certain equipment types.")],
    },
  },
  reach: {
    temporal: {
      refsLine: "Art. 140, Art. 2",
      rules: [
        rule("REACH_A140", "Art. 140", "Entry into force."),
        rule("REACH_A2", "Art. 2", "Scope of REACH."),
      ],
    },
    territorial: {
      refsLine: "Art. 2, Art. 3, Recital 8",
      rules: [
        rule("REACH_A2", "Art. 2", "Substances, mixtures, and articles in the Union."),
        rule("REACH_A3", "Art. 3", "Definitions."),
      ],
    },
    material: {
      refsLine: "Art. 7, Art. 33, Art. 59",
      rules: [
        rule("REACH_A7", "Art. 7", "Registration of substances."),
        rule("REACH_A33", "Art. 33", "SVHC communication in articles."),
        rule("REACH_A59", "Art. 59", "Substances of very high concern."),
      ],
    },
    exclusions: {
      refsLine: "Art. 2(5), Annex IV",
      rules: [rule("REACH_A2", "Art. 2(5)", "Exclusions for certain substances and uses.")],
    },
  },
  product_liability: {
    temporal: {
      refsLine: "Art. 22, Art. 2",
      rules: [
        rule("PLD_A22", "Art. 22", "Entry into force and application."),
        rule("PLD_A2", "Art. 2", "Scope of the Product Liability Directive."),
      ],
    },
    territorial: {
      refsLine: "Art. 2, Art. 3, Recital 9",
      rules: [
        rule("PLD_A2", "Art. 2", "Products placed on the Union market."),
        rule("PLD_A3", "Art. 3", "Definitions."),
      ],
    },
    material: {
      refsLine: "Art. 6, Art. 8, Art. 2",
      rules: [
        rule("PLD_A6", "Art. 6", "Defect."),
        rule("PLD_A8", "Art. 8", "Damages."),
        rule("PLD_A2", "Art. 2", "Products including software-related defects."),
      ],
    },
    exclusions: {
      refsLine: "Art. 2(3), Recital 14",
      rules: [rule("PLD_A2", "Art. 2(3)", "Exclusions for certain professional products.")],
    },
  },
  market_surveillance: {
    temporal: {
      refsLine: "Art. 47, Art. 2",
      rules: [
        rule("MSR_A47", "Art. 47", "Entry into force."),
        rule("MSR_A2", "Art. 2", "Scope of market surveillance."),
      ],
    },
    territorial: {
      refsLine: "Art. 2, Art. 4, Recital 6",
      rules: [
        rule("MSR_A2", "Art. 2", "Products made available on the Union market."),
        rule("MSR_A4", "Art. 4", "Economic operators."),
      ],
    },
    material: {
      refsLine: "Art. 4, Art. 15, Art. 11",
      rules: [
        rule("MSR_A4", "Art. 4", "Obligations of economic operators."),
        rule("MSR_A15", "Art. 15", "EU responsible person."),
        rule("MSR_A11", "Art. 11", "Market surveillance powers."),
      ],
    },
    exclusions: {
      refsLine: "Art. 2(3), Recital 10",
      rules: [rule("MSR_A2", "Art. 2(3)", "Exclusions for products outside harmonisation scope.")],
    },
  },
  eecc: {
    temporal: {
      refsLine: "Art. 123, Art. 2",
      rules: [
        rule("EECC_A123", "Art. 123", "Transposition and application."),
        rule("EECC_A2", "Art. 2", "Scope of EECC."),
      ],
    },
    territorial: {
      refsLine: "Art. 2, Art. 3, Recital 7",
      rules: [
        rule("EECC_A2", "Art. 2", "Electronic communications networks and services in the Union."),
        rule("EECC_A3", "Art. 3", "Definitions."),
      ],
    },
    material: {
      refsLine: "Art. 3, Art. 61, Art. 17",
      rules: [
        rule("EECC_A3", "Art. 3", "Definitions of ECS and ECN."),
        rule("EECC_A61", "Art. 61", "Access obligations."),
        rule("EECC_A17", "Art. 17", "General authorisation."),
      ],
    },
    exclusions: {
      refsLine: "Art. 2(3), Recital 11",
      rules: [rule("EECC_A2", "Art. 2(3)", "Exclusions for certain information society services.")],
    },
  },
};

export function normRegCode(code: string): string {
  const c = (code || "").toLowerCase().replace(/-/g, "_");
  if (c === "eu_ai_act" || c === "aiact") return "ai_act";
  return c.replace(/^eu_/, "");
}

export function provisionsForDimension(
  code: string,
  dimId: string,
): DimensionProvisionSet | null {
  const key = normRegCode(code);
  return CATALOG[key]?.[dimId] ?? null;
}

export function mergeRules(
  existing: ScopeRuleInvoked[] | undefined,
  catalog: DimensionProvisionSet | null,
): ScopeRuleInvoked[] {
  if (!catalog?.rules.length) return existing ?? [];
  const seen = new Set((existing ?? []).map((r) => r.provision_long_id || r.citation?.label));
  const merged = [...(existing ?? [])];
  for (const r of catalog.rules) {
    const key = r.provision_long_id || r.citation?.label || "";
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push(r);
    }
  }
  return merged;
}

export function citationsFromRules(rules: ScopeRuleInvoked[]): ScopeCitation[] {
  return rules
    .map((r) => r.citation)
    .filter((c): c is ScopeCitation => Boolean(c?.label));
}
