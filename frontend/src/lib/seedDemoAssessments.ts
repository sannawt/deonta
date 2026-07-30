import type { ChatResponse } from "../types/chat";
import type { ProductRecord } from "./productStore";
import { nanoid } from "./utils";

export const AMPERSAND_DEMO_ID = "demo-ampersand-ctv-segment";

const DEMO_WORKSHEET: ChatResponse["worksheet"] = {
  rows: [
    {
      legal_test_name: "Temporal scope",
      gdpr_result: "PASS",
      ai_act_result: "PASS",
      reasoning:
        "GDPR and AI Act are in force for the assessment date. Governance chapters apply per phased timeline.",
      legal_basis: "GDPR Art. 99; AI Act Art. 113",
    },
    {
      legal_test_name: "Territorial scope",
      gdpr_result: "PASS",
      ai_act_result: "UNKNOWN",
      reasoning:
        "EU market offer and cross-border processing indicated. AI Act territorial link needs confirmation for US-only processing paths.",
      legal_basis: "GDPR Art. 3",
    },
    {
      legal_test_name: "Material scope",
      gdpr_result: "PASS",
      ai_act_result: "UNKNOWN",
      reasoning:
        "Personal data processing (viewing and device identifiers) is in scope for GDPR. AI Act material scope depends on profiling / automated decision-making classification.",
      legal_basis: "GDPR Art. 2; AI Act Art. 2–3",
    },
    {
      legal_test_name: "Exclusions",
      gdpr_result: "UNKNOWN",
      ai_act_result: "NOT_REACHED",
      reasoning: "Household-level pseudonymisation and partner controls need verification before exclusion analysis completes.",
      legal_basis: "",
    },
  ],
};

const DEMO_ASSESSMENT = {
  mode: "applicability",
  worksheet: DEMO_WORKSHEET,
  clarifying_questions: [
    {
      text: "Is lawful basis documented for household graph and segment creation?",
      regulation: "gdpr",
      dimension: "material",
    },
    {
      text: "Are ad-tech vendors contractually bound as processors with DPAs in place?",
      regulation: "gdpr",
      dimension: "material",
    },
    {
      text: "Does the lookalike model constitute profiling with legal or similarly significant effects?",
      regulation: "ai_act",
      dimension: "material",
    },
  ],
  narrative: {
    verdict_type: "cannot_determine",
    verdict_line: "Further facts needed",
    bottom_line: {
      title: "Overall assessment",
      rows: [
        {
          instrument: "Summary",
          result: "Review",
          conclusion_text:
            "GDPR likely applies to household and device-level audience data for EU markets. AI Act path requires confirmation of profiling and high-risk classification. US state privacy frameworks should be reviewed separately.",
        },
      ],
    },
    focused_questions: [
      "Document lawful basis for segment creation",
      "Confirm vendor DPA coverage",
      "Classify AI risk tier for lookalike model",
    ],
  },
  scope_analysis: {
    instruments: [
      {
        reg_key: "gdpr",
        full_name: "General Data Protection Regulation",
        verdict: "in_scope",
        dimensions: [],
      },
      {
        reg_key: "ai_act",
        full_name: "Artificial Intelligence Act",
        verdict: "needs_clarification",
        dimensions: [],
      },
    ],
  },
} as unknown as ChatResponse;

export function buildAmpersandDemoProduct(): ProductRecord {
  const now = Date.now();
  return {
    id: AMPERSAND_DEMO_ID,
    label: "Household addressable audience segment for CTV campaigns",
    created_at: now - 86400000,
    updated_at: now,
    playbook_id: undefined,
    spec: {
      name: "CTV household audience segment",
      summary:
        "Household addressable audience segment for CTV campaigns. Processes viewing and device identifiers across US and EU markets. Uses ML lookalike models and integrates multiple ad-tech vendors. Partners with broadcasters for data co-op.",
      markets: ["us", "eu"],
      processesPersonalData: "yes",
      euLink: "yes",
      aiSystem: "yes",
      selectedLaws: ["eprivacy", "data_act"],
    },
    kgFacts: [
      { id: nanoid(), label: "Product name", value: "CTV household audience segment", source: "demo" },
      { id: nanoid(), label: "Markets", value: "US, EU", source: "demo" },
      { id: nanoid(), label: "Personal data", value: "yes", source: "demo" },
      { id: nanoid(), label: "AI system", value: "yes", source: "demo" },
      {
        id: nanoid(),
        label: "Data flows",
        value: "Viewing IDs, device graphs, household segments shared with advertisers",
        source: "demo",
      },
    ],
    lastAssessment: {
      created_at: now,
      prompt: "Household addressable audience segment for CTV campaigns",
      response: DEMO_ASSESSMENT,
    },
    lastWorksheet: {
      created_at: now,
      law_codes: ["gdpr", "ai_act", "eprivacy", "data_act"],
      open_question_count: 3,
    },
  };
}

export function seedDemoAssessmentsIfNeeded(products: ProductRecord[]): ProductRecord[] {
  if (products.some((p) => p.id === AMPERSAND_DEMO_ID)) return products;
  return [buildAmpersandDemoProduct(), ...products];
}
