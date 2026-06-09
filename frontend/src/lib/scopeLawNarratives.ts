/**
 * Per-law scope narratives for all instruments in the product catalog.
 * Used by dimension summaries, product assessments, and fallback scope building.
 */

import { lawSummaryForCode } from "./lawSummaries";
import { normRegCode, provisionsForDimension } from "./scopeProvisionCatalog";
import type { ScopeDimension } from "../types/chat";

type DimResult = string;
type DimId = "temporal" | "territorial" | "material" | "exclusions";

interface DimTexts {
  pass: string;
  fail?: string;
  unknown: string;
}

interface LawNarratives {
  temporal: DimTexts;
  territorial: DimTexts;
  material: DimTexts;
  exclusions: DimTexts;
  assessment: {
    applies: string;
    does_not_apply: string;
    cannot_determine: string;
  };
}

function pick(result: DimResult, texts: DimTexts): string {
  if (result === "PASS") return texts.pass;
  if (result === "FAIL") return texts.fail ?? texts.unknown;
  return texts.unknown;
}

function withRefs(text: string, code: string, dimId: DimId): string {
  const prov = provisionsForDimension(code, dimId);
  if (!prov?.refsLine || text.includes(prov.refsLine.split(",")[0])) return text;
  return `${text} Relevant provisions include ${prov.refsLine}.`;
}

const NARRATIVES: Record<string, LawNarratives> = {
  ai_act: {
    temporal: {
      pass: "The EU AI Act is in force with staged application by risk class under Art. 113. General provisions, Title II prohibitions, and Chapter V GPAI rules are already active. High-risk obligations under Title III and Annex III phase in on later dates depending on your use case.",
      unknown: "Whether the AI Act application timeline covers your product launch is not fully confirmed. Art. 113 sets the staged application schedule. Check implementation guidance for dates relevant to your risk category.",
    },
    territorial: {
      pass: "An EU territorial link is indicated from your markets or establishment signals. Art. 2 applies to AI systems placed on the market, put into service, or used in the Union. Recital 22 confirms embedded or component AI is caught when the overall product is placed in the Union.",
      fail: "No sufficient EU territorial link is established on current facts. Art. 2 requires placement on the market, putting into service, or use in the Union.",
      unknown: "EU territorial scope under Art. 2 is not yet confirmed. Clarify whether the product is offered in EU markets or used by people in the Union.",
    },
    material: {
      pass: "AI usage is indicated — the product likely falls within AI Act material scope under Art. 3(1). Recital 25 supports a broad definition covering autonomy and adaptiveness after deployment. Check Annex III and Art. 6 if use cases include recruitment, credit, biometrics, or other high-risk categories.",
      fail: "The product does not appear to be an AI system under Art. 3(1) on these facts. Purely rule-based automation without inference may fall outside scope.",
      unknown: "Whether the product is an AI system under Art. 3(1) cannot be confirmed yet. Describe ML, generative AI, or adaptive inference in your product intake.",
    },
    exclusions: {
      pass: "No Art. 2(3) exclusion appears to apply on current facts. The product is not described as purely personal use, national-security-only, or pre-market R&D exempt. This continues the analysis to substantive rules rather than ending compliance work.",
      unknown: "Whether an Art. 2(3) exclusion applies has not been ruled out. Confirm the product is not solely for non-professional personal use, pure R&D, or national-security contexts.",
    },
    assessment: {
      applies: "Based on your intake, the {title} appears likely to apply. Temporal scope is satisfied under Art. 113; territorial and material gates under Art. 2 and Art. 3(1) are met on a provisional reading. Next determine risk class under Art. 6 and Annex III, provider/deployer role, and any Art. 2(3) exclusion before treating this as a final legal conclusion.",
      does_not_apply: "On the current facts, the {title} does not appear to apply. Territorial scope under Art. 2 or material scope under Art. 3(1) is not established, or an exclusion applies. Revisit if you add AI functionality or place the system on the EU market.",
      cannot_determine: "The {title} may apply, but scope is not yet conclusive. Review all four dimensions below and confirm EU placement, AI system characteristics, Annex III use case, and Art. 2(3) carve-outs.",
    },
  },
  gdpr: {
    temporal: {
      pass: "The GDPR has applied since 25 May 2018 across the EU/EEA. Temporal scope is satisfied for processing during your product's operational period. Former Directive 95/46/EC transitional rules no longer affect new products.",
      unknown: "GDPR temporal scope is generally satisfied for current products, but confirm no legacy processing period requires separate analysis.",
    },
    territorial: {
      pass: "An EU territorial link appears present from markets or establishment signals. Art. 3 applies for EU establishment, offering to people in the Union, or monitoring behaviour. Recital 24 supports applying the Regulation to processing linked to an EU establishment.",
      fail: "No EU territorial link is established under Art. 3 on these facts.",
      unknown: "Territorial scope under Art. 3 cannot be confirmed yet. Check EU establishment, offering to data subjects, or behaviour monitoring.",
    },
    material: {
      pass: "Personal data processing is indicated, so GDPR material scope is likely engaged under Art. 4. Online identifiers may be personal data where Recital 30 applies. Identify lawful bases under Art. 6 and assess Art. 9 for special categories.",
      fail: "Personal data processing does not appear present, so GDPR material scope may not apply.",
      unknown: "Whether personal data is processed under Art. 4 cannot be confirmed from intake.",
    },
    exclusions: {
      pass: "No household or purely personal-use exclusion is indicated for this commercial product. Recital 29 removes scope only for purely personal or household activity without professional connection.",
      unknown: "Whether Recital 29 or another Art. 2 carve-out applies is not confirmed.",
    },
    assessment: {
      applies: "Based on your intake, the {title} appears likely to apply. The Regulation is in force, an EU link under Art. 3 is indicated, and personal data processing under Art. 4 appears present. Next confirm lawful bases under Art. 6, transparency duties, Art. 28 processor terms if relevant, and Art. 9 or Art. 22 where applicable.",
      does_not_apply: "On current facts, the {title} does not appear to apply — Art. 3 territorial scope or Art. 4 material scope is not established, or Recital 29 may apply.",
      cannot_determine: "The {title} may apply but scope is not fully confirmed. Review territorial link under Art. 3, personal data under Art. 4, and Recital 29 exclusions below.",
    },
  },
  cra: {
    temporal: {
      pass: "The Cyber Resilience Act is in force with staged obligations under Art. 59. Confirm your go-to-market date against the CRA application timeline. General cybersecurity duties may apply before sector-specific conformity deadlines.",
      unknown: "CRA temporal application for your product timeline should be checked against Art. 59 and implementation guidance.",
    },
    territorial: {
      pass: "The product appears placed on or offered in the EU market. Art. 2(1) covers products with digital elements made available in the Union whether sold or supplied free of charge. Recital 30 confirms software, firmware, and connected devices are in scope.",
      unknown: "EU placement under Art. 2 is not confirmed on current facts.",
    },
    material: {
      pass: "Product type and connectivity suggest a product with digital elements under Art. 2 and Annex I. Essential requirements under Art. 10 apply across the lifecycle. Overlap with RED, medical devices, or the AI Act should be assessed separately.",
      unknown: "Whether the product falls within CRA material scope under Art. 2 is unclear.",
    },
    exclusions: {
      pass: "No Art. 2(4)–(5) sector exclusion is indicated. Products fully regulated under specific Union harmonisation law may still need overlap analysis under Recital 31.",
      unknown: "Whether an Art. 2(4)–(5) exclusion applies (medical devices, aviation, motor vehicles) is not ruled out.",
    },
    assessment: {
      applies: "Based on your intake, the {title} appears likely to apply to this connected or digital product. Temporal, territorial, and material scope gates are provisionally satisfied under Art. 2 and Annex I. Next map essential requirements under Art. 10, vulnerability handling, conformity assessment class, and overlap with sector-specific product law.",
      does_not_apply: "On current facts, the {title} does not appear to apply — EU placement or digital-element material scope is not established, or a sector exclusion may apply.",
      cannot_determine: "The {title} may apply to your product with digital elements. Review Art. 2 placement, Annex I category, and Art. 2(4)–(5) exclusions in the dimension breakdown.",
    },
  },
  dsa: {
    temporal: {
      pass: "The Digital Services Act is in force with application dates under Art. 93. Obligations for intermediary services and online platforms are active for services offered in the Union. Very large online platforms face additional duties on the staged timeline.",
      unknown: "DSA application timing under Art. 93 should be checked against your service launch and platform size.",
    },
    territorial: {
      pass: "An EU territorial link is indicated for your intermediary or platform service. Art. 2 catches services offered to recipients in the Union regardless of provider establishment. Recital 7 supports a broad Union-facing scope for digital services.",
      unknown: "Whether your service is offered to recipients in the Union under Art. 2 is not confirmed.",
    },
    material: {
      pass: "Your product appears to operate as an intermediary service, hosting service, or online platform within Art. 3. Material scope depends on service type — hosting, marketplace, social network, or VLOP. Due diligence, notice-and-action, and transparency duties scale with service category under Arts. 14–24.",
      unknown: "Whether the product is an intermediary service or online platform under Art. 3 cannot be confirmed from intake.",
    },
    exclusions: {
      pass: "No Art. 2(3) micro/small enterprise exclusion or activity carve-out is indicated on current facts.",
      unknown: "Whether an Art. 2(3) exclusion for size or activity type applies is not ruled out.",
    },
    assessment: {
      applies: "Based on your intake, the {title} appears likely to apply. Your service appears offered in the Union and falls within intermediary or platform material scope under Art. 3. Next classify service type, assess notice-and-action under Art. 16, transparency under Art. 24 if an online platform, and VLOP duties if thresholds are met.",
      does_not_apply: "On current facts, the {title} does not appear to apply — the product does not appear to be an intermediary service offered in the Union.",
      cannot_determine: "The {title} may apply if you operate a hosting service, marketplace, or platform reaching EU users. Confirm service type under Art. 3 and Union-facing offering under Art. 2.",
    },
  },
  dma: {
    temporal: {
      pass: "The Digital Markets Act is in force under Art. 54. Gatekeeper obligations apply once designation occurs; core platform service providers should monitor designation criteria continuously.",
      unknown: "DMA temporal scope is satisfied for designated gatekeepers; confirm whether designation or application dates affect your service.",
    },
    territorial: {
      pass: "An EU market link is indicated for your core platform services. Art. 2 applies to gatekeepers providing core platform services in the Union. Services used by business users or end users in the EU are caught.",
      unknown: "Whether core platform services are provided in the Union under Art. 2 is not confirmed.",
    },
    material: {
      pass: "Your undertaking may meet gatekeeper designation thresholds under Art. 3 — size, entrenched position, and impact on internal market. Material scope is narrow: DMA applies to designated gatekeepers providing Annex I core platform services, not to all digital products.",
      fail: "The product does not appear to meet gatekeeper designation criteria under Art. 3 on these facts.",
      unknown: "Whether designation thresholds under Art. 3 are met cannot be confirmed without revenue, user, and market-cap data.",
    },
    exclusions: {
      pass: "No Art. 2(2) exclusion for undertakings below gatekeeper thresholds is indicated — if thresholds are not met, DMA may not apply despite EU presence.",
      unknown: "Gatekeeper threshold analysis under Art. 3 is incomplete; undertakings below thresholds fall outside material scope.",
    },
    assessment: {
      applies: "Based on your intake, the {title} may apply if your undertaking is or could be designated a gatekeeper. Core platform services in the Union under Art. 2 and Art. 3 thresholds appear potentially engaged. Confirm designation status, Annex I service category, and Art. 5 obligations if designated.",
      does_not_apply: "On current facts, the {title} does not appear to apply — gatekeeper thresholds under Art. 3 are unlikely met or no core platform service is offered in the Union.",
      cannot_determine: "The {title} applies only to gatekeepers. Review whether your undertaking meets Art. 3 criteria and provides Annex I core platform services in the Union.",
    },
  },
  nis2: {
    temporal: {
      pass: "The NIS2 Directive applies following Member State transposition under Art. 41. National cybersecurity rules for essential and important entities are in force across the EU. Confirm the transposition date in markets where you operate.",
      unknown: "NIS2 temporal application depends on national transposition; verify deadlines under Art. 41 for your Member States.",
    },
    territorial: {
      pass: "An EU operational link is indicated. Art. 2 covers essential and important entities providing services in the Union. Entities established in the EU or offering covered services to the Union are within territorial scope.",
      unknown: "Whether services are provided in the Union under Art. 2 is not confirmed.",
    },
    material: {
      pass: "Your organisation or product may fall within a sector listed in Annex I or Annex II as an essential or important entity. Art. 21 cybersecurity risk-management measures and Art. 23 incident notification may apply. Size thresholds and sector classification determine material scope.",
      unknown: "Whether you are an essential or important entity under Art. 3 and Annex I/II cannot be confirmed from intake.",
    },
    exclusions: {
      pass: "No Art. 2(3)–(4) size or sector exclusion is clearly established on current facts.",
      unknown: "Whether size thresholds or sector exclusions under Art. 2(3)–(4) remove your entity from scope is not ruled out.",
    },
    assessment: {
      applies: "Based on your intake, the {title} appears likely relevant. An EU service link and sector signals suggest essential or important entity status under Art. 3 and Annex I/II. Next confirm national transposition, Art. 21 risk-management measures, Art. 23 incident reporting, and supply-chain duties.",
      does_not_apply: "On current facts, the {title} does not appear to apply — sector or size thresholds for essential/important entities are not met.",
      cannot_determine: "The {title} may apply if you operate in an Annex I/II sector in the Union. Confirm entity classification, size thresholds, and national implementing rules.",
    },
  },
  dora: {
    temporal: {
      pass: "The Digital Operational Resilience Act is in force with application from January 2025 for financial entities. ICT risk management, incident reporting, and third-party oversight rules are active for in-scope entities.",
      unknown: "DORA application timing should be confirmed against your entity type and authorization date.",
    },
    territorial: {
      pass: "An EU establishment or authorization link is indicated. DORA applies to financial entities operating in the Union and their ICT service providers where relevant.",
      unknown: "Whether your entity is established or authorized in the Union is not confirmed.",
    },
    material: {
      pass: "Your organisation may qualify as a financial entity or critical ICT third-party provider within DORA scope. Material scope covers banks, insurers, investment firms, and specified ICT providers — not general software products unless they supply critical ICT services to financial entities.",
      unknown: "Whether you are a financial entity or in-scope ICT provider cannot be confirmed from intake.",
    },
    exclusions: {
      pass: "No clear DORA exclusion is indicated on current facts for micro-enterprises below thresholds where applicable.",
      unknown: "Entity-level exclusions and proportionality rules have not been fully assessed.",
    },
    assessment: {
      applies: "Based on your intake, the {title} appears likely relevant for your financial-sector or ICT service activities in the Union. Confirm entity classification, ICT risk management, incident reporting, and third-party register duties.",
      does_not_apply: "On current facts, the {title} does not appear to apply — you do not appear to be a financial entity or critical ICT third-party provider in scope.",
      cannot_determine: "The {title} may apply to financial entities and certain ICT providers. Review entity type, EU authorization, and ICT service role.",
    },
  },
  data_act: {
    temporal: {
      pass: "The EU Data Act is in force with staged application under Art. 50. Obligations for connected products and related services phase in over 2025–2027.",
      unknown: "Data Act application dates under Art. 50 should be matched to your product launch timeline.",
    },
    territorial: {
      pass: "An EU market link is indicated for connected products or related services. Art. 2 covers products placed on the Union market and services offered in the Union.",
      unknown: "EU placement or service offering under Art. 2 is not confirmed.",
    },
    material: {
      pass: "Your product appears to generate data from connected products or related services under Art. 3. Users may have access rights under Art. 4; cloud switching rules under Art. 23 may apply to data processing services. Overlap with GDPR personal data rules should be assessed separately.",
      unknown: "Whether the product is a connected product or related service under Art. 3 is unclear.",
    },
    exclusions: {
      pass: "No Art. 2(3) SME or sector exclusion is clearly indicated.",
      unknown: "Whether Art. 2(3) exclusions or proportionality rules apply is not ruled out.",
    },
    assessment: {
      applies: "Based on your intake, the {title} appears likely to apply. Connected product or related service scope under Art. 3 and EU market placement under Art. 2 are provisionally satisfied. Next assess user access under Art. 4, B2B sharing rules, and Art. 23 switching obligations.",
      does_not_apply: "On current facts, the {title} does not appear to apply — no connected product data relationship or EU placement is established.",
      cannot_determine: "The {title} may apply if you manufacture connected products or offer related data services in the Union. Confirm Art. 3 definitions and Art. 2 placement.",
    },
  },
  eprivacy: {
    temporal: {
      pass: "The ePrivacy Directive remains in force as implemented by Member States under Art. 15. National rules on cookies, communications confidentiality, and marketing apply alongside the GDPR.",
      unknown: "Confirm national transposition and enforcement timeline for ePrivacy rules in your EU markets.",
    },
    territorial: {
      pass: "An EU link is indicated for electronic communications services or device-level processing. Art. 2 applies to publicly available electronic communications services in the Union.",
      unknown: "Whether electronic communications services are offered in the Union is not confirmed.",
    },
    material: {
      pass: "Your product may involve storing or accessing information on users' devices, communications metadata, or electronic marketing within Arts. 5, 6, and 13. ePrivacy complements GDPR for communications-specific processing.",
      unknown: "Whether cookies, communications data, or direct marketing under Arts. 5–13 are involved is unclear.",
    },
    exclusions: {
      pass: "No Art. 2(2) public-security exclusion is indicated for commercial product offerings.",
      unknown: "Whether Art. 2(2) exclusions apply is not confirmed.",
    },
    assessment: {
      applies: "Based on your intake, the {title} appears likely relevant alongside GDPR. Device storage, communications confidentiality, or electronic marketing in the Union may trigger Arts. 5, 6, and 13 as implemented nationally.",
      does_not_apply: "On current facts, the {title} does not appear to apply — no electronic communications or device-level processing in scope.",
      cannot_determine: "The {title} may apply if you use cookies, process communications metadata, or send electronic marketing in the EU. Confirm national implementing rules.",
    },
  },
  gpsr: {
    temporal: {
      pass: "The General Product Safety Regulation applies from December 2024, replacing the old GPSD framework. Product safety obligations for consumer products placed on the EU market are in force.",
      unknown: "GPSR application timing should be confirmed for your product category and market entry date.",
    },
    territorial: {
      pass: "An EU market placement link is indicated. GPSR applies to products made available on the Union market whether sold or supplied in the course of a commercial activity.",
      unknown: "Whether the product is made available on the EU market is not confirmed.",
    },
    material: {
      pass: "Your product appears to be a consumer product within GPSR scope — safety requirements, traceability, and incident reporting may apply. GPSR covers most non-food consumer products placed on the EU market.",
      unknown: "Whether the product is a consumer product requiring GPSR safety duties is unclear.",
    },
    exclusions: {
      pass: "No sector exclusion for products covered by more specific Union harmonisation legislation is clearly indicated.",
      unknown: "Whether a more specific product safety regime excludes GPSR is not ruled out.",
    },
    assessment: {
      applies: "Based on your intake, the {title} appears likely to apply to this consumer product placed in the Union. Review general safety requirements, economic operator duties, product traceability, and incident reporting obligations.",
      does_not_apply: "On current facts, the {title} does not appear to apply — the product is not a consumer product placed on the EU market.",
      cannot_determine: "The {title} may apply to consumer products offered in the Union. Confirm product category, EU placement, and overlap with sector-specific safety law.",
    },
  },
  red: {
    temporal: {
      pass: "The Radio Equipment Directive is in force and underpins CE marking for radio equipment placed on the EU market. Harmonised standards and notified body involvement depend on product type.",
      unknown: "RED application and conformity assessment timing should be aligned with your product launch.",
    },
    territorial: {
      pass: "An EU market placement link is indicated for radio equipment. RED applies to products placed on the Union market that intentionally emit or receive radio waves.",
      unknown: "Whether radio equipment is placed on the EU market is not confirmed.",
    },
    material: {
      pass: "Your product appears to be radio equipment or connected apparatus within RED scope. Essential requirements cover radio spectrum, EMC, and health/safety; cybersecurity delegated acts may also apply. CRA overlap should be checked for products with digital elements.",
      unknown: "Whether the product constitutes radio equipment under RED is unclear.",
    },
    exclusions: {
      pass: "No RED exclusion for equipment covered exclusively by other directives is clearly indicated.",
      unknown: "Whether equipment falls outside RED due to another harmonisation act is not ruled out.",
    },
    assessment: {
      applies: "Based on your intake, the {title} appears likely to apply to this radio or wireless product. EU placement, RED essential requirements, CE marking, and overlap with CRA cybersecurity rules should be assessed.",
      does_not_apply: "On current facts, the {title} does not appear to apply — the product does not appear to be radio equipment placed in the Union.",
      cannot_determine: "The {title} may apply if your product transmits or receives radio waves and is placed on the EU market. Confirm RED classification and conformity path.",
    },
  },
  rohs: {
    temporal: {
      pass: "The RoHS Directive is in force and restricts hazardous substances in electrical and electronic equipment placed on the EU market. Substance restrictions and CE marking documentation requirements apply.",
      unknown: "RoHS substance restriction timelines for any newly listed substances should be checked.",
    },
    territorial: {
      pass: "An EU market placement link is indicated. RoHS applies to EEE placed on the Union market regardless of manufacturer location.",
      unknown: "EU placement of electrical and electronic equipment is not confirmed.",
    },
    material: {
      pass: "Your product appears to be electrical or electronic equipment within RoHS scope. Material scope covers EEE in the categories of Annex I subject to restricted substances in Annex II. Technical documentation and conformity marking are required.",
      unknown: "Whether the product is in-scope EEE under RoHS Annex I is unclear.",
    },
    exclusions: {
      pass: "No RoHS exclusion for categories in Annex I or specific applications is clearly indicated.",
      unknown: "Whether an Annex exclusion or spare-parts carve-out applies is not ruled out.",
    },
    assessment: {
      applies: "Based on your intake, the {title} appears likely to apply. The product appears to be EEE placed on the EU market subject to Annex II substance limits. Confirm category, restricted substances, and technical documentation.",
      does_not_apply: "On current facts, the {title} does not appear to apply — the product is not in-scope EEE placed in the Union.",
      cannot_determine: "The {title} may apply to electrical and electronic equipment in the Union. Confirm Annex I category and substance compliance.",
    },
  },
  weee: {
    temporal: {
      pass: "The WEEE Directive is in force and requires collection, recycling, and take-back for electrical and electronic equipment placed on the EU market. Producer registration and reporting obligations apply nationally.",
      unknown: "National WEEE registration and reporting deadlines should be confirmed per Member State.",
    },
    territorial: {
      pass: "An EU market placement link is indicated. WEEE duties attach to producers placing EEE on the Union market in each Member State where products are sold.",
      unknown: "Whether EEE is placed on the EU market is not confirmed.",
    },
    material: {
      pass: "Your product appears to be electrical or electronic equipment generating WEEE obligations. Material scope covers EEE categories in Annex I; producer responsibilities include labeling, take-back, and recycling financing.",
      unknown: "Whether the product is in-scope EEE under WEEE is unclear.",
    },
    exclusions: {
      pass: "No WEEE exclusion for household vs professional equipment categories is clearly established.",
      unknown: "Whether equipment falls outside WEEE categories or national exemptions is not ruled out.",
    },
    assessment: {
      applies: "Based on your intake, the {title} appears likely to apply. EEE placed in the Union triggers producer registration, take-back, and recycling obligations. Confirm category, national producer registers, and labeling rules.",
      does_not_apply: "On current facts, the {title} does not appear to apply — the product is not EEE placed on the EU market.",
      cannot_determine: "The {title} may apply to electrical and electronic equipment you place in the Union. Confirm Annex I category and national producer duties.",
    },
  },
  reach: {
    temporal: {
      pass: "The REACH Regulation is in force and governs registration, evaluation, and restriction of chemical substances in the EU. SVHC, authorization, and restriction obligations apply on ongoing timelines.",
      unknown: "REACH registration or notification deadlines for substances in your product should be checked.",
    },
    territorial: {
      pass: "An EU market link is indicated. REACH applies to substances, mixtures, and articles manufactured, imported, or placed on the Union market.",
      unknown: "Whether substances or articles are placed on the EU market is not confirmed.",
    },
    material: {
      pass: "Your product may contain substances, mixtures, or articles subject to REACH — registration, SVHC notification, or restriction compliance may apply. Material scope depends on chemical identity, concentration thresholds, and importer/manufacturer role.",
      unknown: "Whether REACH substance or article obligations are triggered is unclear without chemical composition data.",
    },
    exclusions: {
      pass: "No REACH exclusion for substances covered by more specific legislation is clearly indicated.",
      unknown: "Whether polymer, radioactive, or other Annex exclusions apply is not ruled out.",
    },
    assessment: {
      applies: "Based on your intake, the {title} appears likely relevant. Substances or articles placed in the Union may require registration, SVHC communication, or restriction compliance. Confirm chemical composition, tonnage, and supply-chain role.",
      does_not_apply: "On current facts, the {title} does not appear to apply — no in-scope substances or articles are placed on the EU market.",
      cannot_determine: "The {title} may apply if your product contains regulated substances or articles placed in the Union. Confirm composition and importer/manufacturer status.",
    },
  },
  product_liability: {
    temporal: {
      pass: "The revised Product Liability Directive applies with updated rules for defective products placed on the Union market, including software and digital manufacturing defects.",
      unknown: "PLD application dates and national transposition should be confirmed for your markets.",
    },
    territorial: {
      pass: "An EU market placement link is indicated. The PLD covers products placed on the market or put into service in the Union and damage suffered within the Union.",
      unknown: "Whether products are placed on or damage occurs in the Union is not confirmed.",
    },
    material: {
      pass: "Your product appears to be a movable product within PLD scope, potentially including digital elements and related services. Material scope covers defective products causing death, personal injury, or property damage.",
      unknown: "Whether the product falls within PLD product definition including digital defects is unclear.",
    },
    exclusions: {
      pass: "No PLD exclusion for professional-use-only products is clearly indicated on current facts.",
      unknown: "Whether liability limitations or developer exemptions apply is not ruled out.",
    },
    assessment: {
      applies: "Based on your intake, the {title} appears likely relevant. Products placed in the Union may trigger strict liability for defects, including software-related defects. Review defect standards, disclosure duties, and national transposition.",
      does_not_apply: "On current facts, the {title} does not appear to apply — products are not placed in the Union or damage nexus is absent.",
      cannot_determine: "The {title} may apply to products you place in the Union. Confirm product definition, defect risk, and national implementing rules.",
    },
  },
  market_surveillance: {
    temporal: {
      pass: "The Market Surveillance Regulation is in force and coordinates Union-wide market surveillance for products subject to harmonisation legislation. Economic operators must cooperate with surveillance authorities.",
      unknown: "MSR coordination rules apply continuously; confirm obligations tied to your product's harmonisation acts.",
    },
    territorial: {
      pass: "An EU market placement link is indicated. MSR applies to products made available on the Union market that fall under Union harmonisation legislation.",
      unknown: "Whether products are made available on the Union market is not confirmed.",
    },
    material: {
      pass: "Your product appears subject to Union harmonisation rules coordinated under MSR — economic operator identification, documentation availability, and cooperation with surveillance authorities may apply. An EU responsible person may be required for certain non-EU manufacturers.",
      unknown: "Whether MSR economic-operator duties apply depends on which harmonisation legislation covers the product.",
    },
    exclusions: {
      pass: "No MSR exclusion is clearly indicated for products outside harmonisation scope.",
      unknown: "Whether the product falls outside Union harmonisation legislation coordinated by MSR is not ruled out.",
    },
    assessment: {
      applies: "Based on your intake, the {title} appears likely relevant. Products placed in the Union under harmonisation rules trigger market surveillance cooperation, documentation, and possible EU responsible person requirements.",
      does_not_apply: "On current facts, the {title} does not appear to apply — products are not within coordinated harmonisation scope in the Union.",
      cannot_determine: "The {title} may apply alongside sector product law. Confirm harmonisation act coverage, economic operator role, and EU responsible person needs.",
    },
  },
  eecc: {
    temporal: {
      pass: "The European Electronic Communications Code is in force as transposed nationally. Rules on networks, services, access, and consumer protection apply to electronic communications providers in the Union.",
      unknown: "National EECC transposition status should be confirmed for each EU market you serve.",
    },
    territorial: {
      pass: "An EU establishment or service provision link is indicated. EECC applies to electronic communications networks and services provided in the Union.",
      unknown: "Whether electronic communications services are provided in the Union is not confirmed.",
    },
    material: {
      pass: "Your product or service may involve electronic communications networks or services within EECC scope. Material scope covers telecom operators and certain interpersonal communications services — not all software products unless they provide ECS.",
      unknown: "Whether the product constitutes an electronic communications service under EECC is unclear.",
    },
    exclusions: {
      pass: "No EECC exclusion for non-ECS information society services is clearly indicated.",
      unknown: "Whether the service is outside ECS scope and therefore outside EECC is not ruled out.",
    },
    assessment: {
      applies: "Based on your intake, the {title} appears likely relevant if you provide electronic communications networks or services in the Union. Confirm ECS classification, access obligations, and consumer protection rules as transposed nationally.",
      does_not_apply: "On current facts, the {title} does not appear to apply — no electronic communications service is provided in the Union.",
      cannot_determine: "The {title} may apply to telecom or communications services in the EU. Confirm ECS status and national transposition.",
    },
  },
};

function genericDimensionNarrative(
  code: string,
  dimId: DimId,
  result: DimResult,
  title: string,
): string {
  const prov = provisionsForDimension(code, dimId);
  const refs = prov?.refsLine ? ` See ${prov.refsLine}.` : "";
  const catalog = lawSummaryForCode(code);

  switch (dimId) {
    case "temporal":
      return result === "PASS"
        ? `${title} is treated as in force for this assessment period.${refs} Confirm your product launch and operational timeline against any staged application rules.`
        : `${title} temporal application is not fully confirmed on these facts.${refs}`;
    case "territorial":
      return result === "PASS"
        ? `An EU territorial or market-placement link appears present for ${title}.${refs} ${catalog?.appliesWhen || "Review Art. 2/3-style territorial tests for Union connection."}`
        : result === "FAIL"
          ? `No sufficient EU link is established for ${title} on current facts.${refs}`
          : `EU territorial scope for ${title} cannot be confirmed yet.${refs}`;
    case "material":
      return result === "PASS"
        ? `Product characteristics on your intake align with the material scope of ${title} on a provisional reading.${refs} ${catalog?.overview?.split(".")[0] || ""}.`
        : result === "FAIL"
          ? `${title} material scope does not appear engaged on these facts.${refs}`
          : `Whether ${title} material scope applies cannot be confirmed from intake.${refs}`;
    case "exclusions":
      return result === "PASS"
        ? `No exclusion or carve-out for ${title} is clearly indicated on current facts.${refs}`
        : `Whether an exclusion or sector carve-out applies to ${title} is not ruled out.${refs}`;
    default:
      return `${title} ${dimId} scope: ${result}.${refs}`;
  }
}

function fillTitle(template: string, title: string): string {
  return template.replace(/\{title\}/g, title);
}

export function dimensionNarrative(
  code: string,
  dimId: DimId,
  result: DimResult,
): string {
  const key = normRegCode(code);
  const law = NARRATIVES[key];
  const catalog = lawSummaryForCode(key);
  const title = catalog?.title || key.toUpperCase();

  if (law) {
    const texts = law[dimId];
    return withRefs(pick(result, texts), key, dimId);
  }

  return genericDimensionNarrative(key, dimId, result, title);
}

export function productAssessmentNarrative(
  code: string,
  verdict: string | undefined,
  title: string,
): string {
  const key = normRegCode(code);
  const law = NARRATIVES[key];
  const catalog = lawSummaryForCode(key);
  const displayTitle = title || catalog?.title || key.toUpperCase();

  if (law) {
    if (verdict === "applies") return fillTitle(law.assessment.applies, displayTitle);
    if (verdict === "does_not_apply") return fillTitle(law.assessment.does_not_apply, displayTitle);
    return fillTitle(law.assessment.cannot_determine, displayTitle);
  }

  if (verdict === "applies") {
    return (
      `Based on your intake, ${displayTitle} appears likely to apply to this product. ` +
      `Temporal, territorial, and material scope gates below are largely satisfied on a provisional reading. ` +
      `${catalog?.appliesWhen || "Review the cited provisions to validate role, product category, and exclusions."} ` +
      `Use the dimension breakdown and legal references before finalising your compliance position.`
    );
  }
  if (verdict === "does_not_apply") {
    return (
      `On the current facts, ${displayTitle} does not appear to apply to this product. ` +
      `One or more scope dimensions below are not met, or an exclusion may apply. ` +
      `Revisit scope if your markets, product features, or data/AI usage change.`
    );
  }
  return (
    `${displayTitle} may apply to your product, but the assessment is not yet conclusive. ` +
    `Review temporal, territorial, material, and exclusion dimensions below. ` +
    `${catalog?.appliesWhen || "Confirm Union connection and product characteristics against the cited articles."}`
  );
}

/** First 1–2 sentences for fallback evidence strings. */
export function dimensionEvidenceSnippet(
  code: string,
  dimId: DimId,
  result: DimResult,
): string {
  const full = dimensionNarrative(code, dimId, result);
  const sentences = full.split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.slice(0, 2).join(" ");
}

export function enrichDimensionSummary(
  dim: ScopeDimension,
  regKey?: string,
): string {
  const code = normRegCode(regKey || "");
  const template = dimensionNarrative(code, dim.id as DimId, dim.result);
  const evidence = (dim.evidence || "").trim();

  if (evidence.length > 24 && !/^the instrument is treated/i.test(evidence)) {
    const evSentences = evidence.split(/(?<=[.!?])\s+/).filter(Boolean);
    const tplSentences = template.split(/(?<=[.!?])\s+/).filter(Boolean);
    const seen = new Set(evSentences.map((s) => s.toLowerCase()));
    const extra = tplSentences.filter((s) => !seen.has(s.toLowerCase()));
    return [...evSentences, ...extra.slice(0, Math.max(0, 3 - evSentences.length))].join(" ");
  }

  return template;
}
