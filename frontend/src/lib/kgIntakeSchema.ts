/** Schema-driven intake — maps form fields to KG node/relationship types. */

export type TriState = "yes" | "no" | "unknown";

export type IntakeFieldSource =
  | "privacy_policy"
  | "product_spec"
  | "dpa"
  | "terms_of_service"
  | "document";

export const ACTOR_ROLES = [
  { id: "CONTROLLER", label: "Controller" },
  { id: "PROCESSOR", label: "Processor" },
  { id: "PROVIDER", label: "Provider" },
  { id: "DEPLOYER", label: "Deployer" },
  { id: "IMPORTER", label: "Importer" },
  { id: "DISTRIBUTOR", label: "Distributor" },
] as const;

export const MARKET_OPTIONS = [
  { id: "eu", label: "EU" },
  { id: "eea", label: "EEA" },
  { id: "uk", label: "UK" },
  { id: "us", label: "US" },
] as const;

export const KNOWN_MARKET_IDS = new Set(MARKET_OPTIONS.map((m) => m.id));

export function isKnownMarket(id: string): boolean {
  return KNOWN_MARKET_IDS.has(id as (typeof MARKET_OPTIONS)[number]["id"]);
}

export function customMarketsFrom(markets: string[]): string[] {
  return markets.filter((m) => !isKnownMarket(m));
}

export function normalizeCustomMarket(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function formatMarketLabel(id: string): string {
  const known = MARKET_OPTIONS.find((m) => m.id === id);
  if (known) return known.label;
  if (id.length <= 3) return id.toUpperCase();
  return id
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const DATA_SUBJECT_OPTIONS = [
  { id: "customers", label: "Customers" },
  { id: "employees", label: "Employees" },
  { id: "end_users", label: "End users" },
  { id: "job_applicants", label: "Job applicants" },
] as const;

export const DATA_FLOW_OPTIONS = [
  { id: "personal_data", label: "Processes personal data" },
  { id: "accounts_profiles", label: "Accounts / profiles" },
  { id: "customers", label: "Customer data" },
  { id: "employees", label: "Employee data" },
  { id: "job_applicants", label: "Job applicants / CVs" },
  { id: "special_category", label: "Special-category data" },
  { id: "third_parties", label: "Shared with vendors" },
  { id: "none", label: "No personal data" },
] as const;

export const AI_FEATURE_OPTIONS = [
  { id: "machine_learning", label: "Machine learning" },
  { id: "automated_decisions", label: "Automated decisions" },
  { id: "generative_ai", label: "Generative AI" },
  { id: "computer_vision", label: "Computer vision" },
  { id: "recommendations", label: "Recommendations / ranking" },
  { id: "high_risk", label: "High-risk AI use" },
  { id: "none", label: "No AI" },
] as const;

export function formatDataFlowLabel(id: string): string {
  const known = DATA_FLOW_OPTIONS.find((f) => f.id === id);
  return known?.label ?? id.replace(/_/g, " ");
}

export function formatAiFeatureLabel(id: string): string {
  const known = AI_FEATURE_OPTIONS.find((f) => f.id === id);
  return known?.label ?? id.replace(/_/g, " ");
}

export const PRODUCT_FEATURE_OPTIONS = [
  { id: "software_saas", label: "Software / SaaS" },
  { id: "mobile_app", label: "Mobile app" },
  { id: "web_platform", label: "Web platform" },
  { id: "marketplace", label: "Marketplace" },
  { id: "hardware_device", label: "Hardware / device" },
  { id: "analytics", label: "Analytics / reporting" },
  { id: "recommendations", label: "Recommendations" },
  { id: "payments", label: "Payments / billing" },
  { id: "identity_access", label: "Identity / access" },
  { id: "messaging", label: "Messaging" },
  { id: "automation", label: "Workflow automation" },
  { id: "content_media", label: "Content / media" },
] as const;

export function formatProductFeatureLabel(id: string): string {
  const known = PRODUCT_FEATURE_OPTIONS.find((f) => f.id === id);
  return known?.label ?? id.replace(/_/g, " ");
}

export interface ProductIntakeState {
  productName: string;
  productSummary: string;
  productFeatures: string[];
  organisationName: string;
  isAnnexIProduct: boolean;
  actorRoles: string[];
  markets: string[];
  establishedInEu: TriState;
  sellsToEu: TriState;
  gdprTerritorialLink: TriState;
  aiActTerritorialLink: TriState;
  processesPersonalData: TriState;
  dataSubjects: string[];
  dataFlows: string[];
  specialCategoryData: TriState;
  hasAi: TriState;
  aiFeatures: string[];
  highRiskAiUse: TriState;
  dataFlowDescription: string;
  aiUsageDescription: string;
  supplementalNote: string;
}

export type IntakeFieldSources = Partial<Record<keyof ProductIntakeState | string, IntakeFieldSource | string>>;

export const EMPTY_INTAKE: ProductIntakeState = {
  productName: "",
  productSummary: "",
  productFeatures: [],
  organisationName: "",
  isAnnexIProduct: false,
  actorRoles: [],
  markets: [],
  establishedInEu: "unknown",
  sellsToEu: "unknown",
  gdprTerritorialLink: "unknown",
  aiActTerritorialLink: "unknown",
  processesPersonalData: "unknown",
  dataSubjects: [],
  dataFlows: [],
  specialCategoryData: "unknown",
  hasAi: "unknown",
  aiFeatures: [],
  highRiskAiUse: "unknown",
  dataFlowDescription: "",
  aiUsageDescription: "",
  supplementalNote: "",
};

export type ProductIntakePayload = ProductIntakeState;

export type IntakeCardId = "organisation" | "product" | "data_ai";

export const INTAKE_DOCUMENT_STEP = {
  id: "documents",
  title: "Upload product and business documents",
  progressLabel: "Documents",
  prompt: "We extract the facts that matter for compliance",
} as const;

export type IntakeFlowStepId = typeof INTAKE_DOCUMENT_STEP.id | IntakeCardId;

export const INTAKE_CARDS: ReadonlyArray<{
  id: IntakeCardId;
  title: string;
  progressLabel: string;
  prompt: string;
}> = [
  {
    id: "organisation",
    title: "Your organisation",
    progressLabel: "Organisation",
    prompt: "Review and confirm who operates the product and where you offer it.",
  },
  {
    id: "product",
    title: "Product & features",
    progressLabel: "Product",
    prompt: "Review and confirm the product name and what it does.",
  },
  {
    id: "data_ai",
    title: "Data & AI",
    progressLabel: "Data & AI",
    prompt: "Confirm data handling and any AI use.",
  },
] as const;

export const INTAKE_FLOW_STEPS = [INTAKE_DOCUMENT_STEP, ...INTAKE_CARDS] as const;

export const INTAKE_SECTIONS = INTAKE_CARDS;

export interface MissingPredicateHint {
  predicate: string;
  description: string;
  cardId?: IntakeCardId;
  fieldKey?: keyof ProductIntakeState;
}

const CARD_FIELDS: Record<IntakeCardId, (keyof ProductIntakeState)[]> = {
  organisation: ["organisationName", "actorRoles", "markets", "establishedInEu", "sellsToEu"],
  product: ["productName", "productFeatures", "productSummary"],
  data_ai: ["dataFlows", "dataFlowDescription", "aiFeatures", "aiUsageDescription"],
};

const NO_PERSONAL_DATA =
  /\b(no personal data|does not (process|collect|store) personal|without personal data|no user data)\b/i;
const PERSONAL_DATA_HINTS =
  /\b(personal data|email|name|address|phone|user data|customer data|employee|biometric|health|cv|resume|applicant|cookie|tracking|gdpr|account|login|profile)\b/i;
const NO_AI_HINTS =
  /\b(no ai|does not use ai|without (ai|machine learning)|not use (ai|ml)|no machine learning)\b/i;
const AI_HINTS =
  /\b(ai|artificial intelligence|machine learning|ml model|neural|llm|gpt|generative|automated decision|computer vision|chatbot|algorithm|deep learning)\b/i;

function isAiUsageAnswered(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.length >= 8) return true;
  if (/^(no|none|n\/?a|not used|no ai)\.?$/i.test(t)) return true;
  return NO_AI_HINTS.test(t);
}

function isDataFlowsAnswered(text: string): boolean {
  const t = text.trim();
  if (t.length >= 8) return true;
  return NO_PERSONAL_DATA.test(t);
}

const PRODUCT_NAME_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "our",
  "my",
  "we",
  "product",
  "service",
  "platform",
  "application",
  "app",
  "software",
  "solution",
  "system",
  "unnamed",
  "unnamed product",
]);

/** Best-effort product name from summary or description text. */
export function inferProductNameFromText(text: string): string {
  const raw = text.trim();
  if (!raw) return "";

  const firstLine = raw.split("\n")[0]?.trim() ?? "";
  // Ignore structured intake dumps (organisation / markets / etc.)
  if (
    /^(organisation|organization|markets|roles|compliance context|established in|sells to|summary|data flows|ai usage|additional detail)\s*:/i.test(
      firstLine,
    )
  ) {
    return "";
  }

  const patterns: RegExp[] = [
    /^product:\s*(.+?)(?:\n|$)/i,
    /^(?:product|service|platform|application|app)\s*[:\-]\s*["']?([^"'\n.,;]{2,60})/i,
    /^(?:name|product name)\s*[:\-]\s*["']?([^"'\n.,;]{2,60})/i,
    /^["']?([A-Za-z][A-Za-z0-9][\w.-]{1,30})["']?\s+(?:is|helps|lets|screens|scans|processes)\b/i,
    /^([A-Z][A-Z0-9]{2,17})\b/,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    const candidate = (match?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
    if (!candidate || candidate.length < 2) continue;
    if (PRODUCT_NAME_STOPWORDS.has(candidate.toLowerCase())) continue;
    if (candidate.split(/\s+/).length > 4) continue;
    return candidate.slice(0, 80);
  }

  const words = firstLine.split(/\s+/);
  if (
    words.length >= 1 &&
    words.length <= 4 &&
    !firstLine.endsWith(".") &&
    !firstLine.endsWith("!") &&
    !firstLine.endsWith("?")
  ) {
    const candidate = firstLine.replace(/^["']|["']$/g, "");
    if (candidate.length >= 2 && !PRODUCT_NAME_STOPWORDS.has(candidate.toLowerCase())) {
      return candidate.slice(0, 80);
    }
  }

  return "";
}

export function deriveProductFields(intake: ProductIntakeState): Partial<ProductIntakeState> {
  if (intake.productName.trim().length >= 2) return {};
  const fromSummary = inferProductNameFromText(intake.productSummary);
  if (fromSummary.length >= 2) return { productName: fromSummary };
  return {};
}

export function deriveDataAiFields(intake: ProductIntakeState): Partial<ProductIntakeState> {
  const data = intake.dataFlowDescription.trim();
  const ai = intake.aiUsageDescription.trim();
  const flows = intake.dataFlows ?? [];
  const features = intake.aiFeatures ?? [];
  const patch: Partial<ProductIntakeState> = {};

  if (flows.includes("none")) {
    patch.processesPersonalData = "no";
    patch.specialCategoryData = "no";
    patch.dataSubjects = [];
  } else if (flows.length > 0) {
    if (flows.includes("personal_data") || flows.some((f) => f !== "none")) {
      patch.processesPersonalData = "yes";
    }
    if (flows.includes("special_category")) {
      patch.specialCategoryData = "yes";
    }
    const subjects: string[] = [];
    if (flows.includes("customers") || flows.includes("accounts_profiles")) subjects.push("customers");
    if (flows.includes("employees")) subjects.push("employees");
    if (flows.includes("job_applicants")) subjects.push("job_applicants");
    if (subjects.length) patch.dataSubjects = subjects;
  } else if (data) {
    if (NO_PERSONAL_DATA.test(data)) {
      patch.processesPersonalData = "no";
    } else if (PERSONAL_DATA_HINTS.test(data) || data.length >= 16) {
      patch.processesPersonalData = "yes";
    }

    const subjects: string[] = [];
    if (/\bcustomer/i.test(data)) subjects.push("customers");
    if (/\bemployee/i.test(data)) subjects.push("employees");
    if (/\b(end user|users)\b/i.test(data)) subjects.push("end_users");
    if (/\b(applicant|candidate|hiring|recruit|cv|resume)\b/i.test(data)) subjects.push("job_applicants");
    if (subjects.length) patch.dataSubjects = subjects;

    if (/\b(health|biometric|special categor)\b/i.test(data)) {
      patch.specialCategoryData = "yes";
    }
  }

  if (features.includes("none")) {
    patch.hasAi = "no";
    patch.highRiskAiUse = "no";
  } else if (features.length > 0) {
    patch.hasAi = "yes";
    if (features.includes("high_risk")) {
      patch.highRiskAiUse = "yes";
    }
  } else if (ai) {
    if (NO_AI_HINTS.test(ai)) {
      patch.hasAi = "no";
    } else if (AI_HINTS.test(ai) || ai.length >= 16) {
      patch.hasAi = "yes";
    }

    const feats: string[] = [];
    if (/\b(machine learning|ml model|trained model)\b/i.test(ai)) feats.push("machine_learning");
    if (/\b(automated decision|scoring|ranking)\b/i.test(ai)) feats.push("automated_decisions");
    if (/\b(generative|llm|gpt|chatbot)\b/i.test(ai)) feats.push("generative_ai");
    if (/\b(computer vision|image recognition|facial)\b/i.test(ai)) feats.push("computer_vision");
    if (feats.length) patch.aiFeatures = feats;

    if (/\b(hiring|recruit|credit|loan|law enforcement|biometric ident)\b/i.test(ai)) {
      patch.highRiskAiUse = "yes";
    }
  }

  return patch;
}

export function applyDerivedDataAi(intake: ProductIntakeState): ProductIntakeState {
  return { ...intake, ...deriveProductFields(intake), ...deriveDataAiFields(intake) };
}

export function narrativeFromStructured(suggested: Partial<ProductIntakeState>): Partial<ProductIntakeState> {
  const patch: Partial<ProductIntakeState> = {};

  if (!suggested.dataFlowDescription?.trim()) {
    const dataParts: string[] = [];
    if (suggested.processesPersonalData === "yes") dataParts.push("Processes personal data");
    else if (suggested.processesPersonalData === "no") dataParts.push("Does not process personal data");
    if (suggested.dataSubjects?.length) {
      dataParts.push(`About ${suggested.dataSubjects.join(", ").replace(/_/g, " ")}`);
    }
    if (suggested.specialCategoryData === "yes") dataParts.push("Includes special-category data");
    if (dataParts.length) patch.dataFlowDescription = dataParts.join(". ");
  }

  if (!suggested.aiUsageDescription?.trim()) {
    const aiParts: string[] = [];
    if (suggested.hasAi === "yes") aiParts.push("Uses AI");
    else if (suggested.hasAi === "no") aiParts.push("Does not use AI");
    if (suggested.aiFeatures?.length) {
      aiParts.push(suggested.aiFeatures.join(", ").replace(/_/g, " "));
    }
    if (suggested.highRiskAiUse === "yes") aiParts.push("High-risk AI use");
    if (aiParts.length) patch.aiUsageDescription = aiParts.join(". ");
  }

  return patch;
}

export function fieldSourceLabel(source: string): string {
  switch (source) {
    case "privacy_policy":
      return "From privacy policy";
    case "product_spec":
      return "From product spec";
    case "dpa":
      return "From DPA";
    case "terms_of_service":
      return "From terms";
    case "document":
      return "From document";
    default:
      return "From document";
  }
}

export function cardSummary(id: IntakeCardId, intake: ProductIntakeState): string {
  switch (id) {
    case "organisation": {
      const parts: string[] = [];
      if (intake.organisationName.trim()) parts.push(intake.organisationName.trim());
      if (intake.markets.length) {
        parts.push(intake.markets.map((m) => formatMarketLabel(m)).join(", "));
      }
      return parts.join(" · ") || "Not set";
    }
    case "product": {
      const parts: string[] = [];
      if (intake.productName.trim()) parts.push(intake.productName.trim());
      if (intake.productFeatures.length) {
        parts.push(intake.productFeatures.map((f) => formatProductFeatureLabel(f)).join(", "));
      } else if (intake.productSummary.trim()) {
        parts.push(
          intake.productSummary.trim().length > 40
            ? `${intake.productSummary.trim().slice(0, 40)}…`
            : intake.productSummary.trim(),
        );
      }
      return parts.join(" — ") || "Not set";
    }
    case "data_ai": {
      const parts: string[] = [];
      if (intake.dataFlows?.length) {
        parts.push(intake.dataFlows.map((f) => formatDataFlowLabel(f)).join(", "));
      } else if (intake.dataFlowDescription.trim()) {
        parts.push(
          intake.dataFlowDescription.trim().length > 48
            ? `${intake.dataFlowDescription.trim().slice(0, 48)}…`
            : intake.dataFlowDescription.trim(),
        );
      }
      if (intake.aiFeatures?.length) {
        parts.push(intake.aiFeatures.map((f) => formatAiFeatureLabel(f)).join(", "));
      } else if (intake.aiUsageDescription.trim()) {
        parts.push(
          intake.aiUsageDescription.trim().length > 40
            ? `${intake.aiUsageDescription.trim().slice(0, 40)}…`
            : intake.aiUsageDescription.trim(),
        );
      }
      return parts.join(" · ") || "Not set";
    }
    default:
      return "";
  }
}

export function cardGaps(id: IntakeCardId, intake: ProductIntakeState): string[] {
  const gaps: string[] = [];
  switch (id) {
    case "organisation":
      if (!intake.organisationName.trim()) gaps.push("organisation name");
      if (!intake.markets.length) gaps.push("markets");
      break;
    case "product":
      if (!intake.productName.trim()) gaps.push("product name");
      if (!intake.productFeatures.length && intake.productSummary.trim().length < 8) {
        gaps.push("features");
      }
      break;
    case "data_ai":
      if (!(intake.dataFlows?.length || isDataFlowsAnswered(intake.dataFlowDescription))) {
        gaps.push("data flows");
      }
      if (
        !(
          intake.aiFeatures?.length ||
          isAiUsageAnswered(intake.aiUsageDescription)
        )
      ) {
        gaps.push("AI use");
      }
      break;
  }
  return gaps;
}

export function isCardComplete(id: IntakeCardId, intake: ProductIntakeState): boolean {
  return cardGaps(id, intake).length === 0;
}

export function firstIncompleteCardIndex(intake: ProductIntakeState): number {
  const idx = INTAKE_CARDS.findIndex((c) => !isCardComplete(c.id, intake));
  return idx >= 0 ? idx : INTAKE_CARDS.length - 1;
}

export function canAdvanceCard(id: IntakeCardId, intake: ProductIntakeState): boolean {
  if (id === "product") {
    return (
      intake.productName.trim().length >= 2 &&
      (intake.productFeatures.length > 0 || intake.productSummary.trim().length >= 8)
    );
  }
  if (id === "data_ai") {
    const dataOk = (intake.dataFlows?.length ?? 0) > 0 || isDataFlowsAnswered(intake.dataFlowDescription);
    const aiOk = (intake.aiFeatures?.length ?? 0) > 0 || isAiUsageAnswered(intake.aiUsageDescription);
    return dataOk && aiOk;
  }
  return true;
}

function intakeComplianceSignals(intake: ProductIntakeState): string[] {
  const signals: string[] = [];
  const inEu =
    intake.markets.some((m) => ["eu", "eea", "uk"].includes(m)) ||
    intake.establishedInEu === "yes" ||
    intake.sellsToEu === "yes";
  if (inEu) {
    signals.push("operates in EU/EEA market");
    signals.push("data protection and privacy");
  }

  const dataText = intake.dataFlowDescription.trim();
  const hasPersonal =
    intake.processesPersonalData === "yes" ||
    ((intake.dataFlows ?? []).some((f) => f !== "none") && !(intake.dataFlows ?? []).includes("none")) ||
    (dataText.length >= 8 && !NO_PERSONAL_DATA.test(dataText));
  if (hasPersonal) {
    signals.push("processes personal data");
    signals.push("GDPR data processing");
  }

  const aiText = intake.aiUsageDescription.trim();
  const hasAi =
    intake.hasAi === "yes" ||
    ((intake.aiFeatures ?? []).some((f) => f !== "none") && !(intake.aiFeatures ?? []).includes("none")) ||
    (aiText.length >= 8 && !NO_AI_HINTS.test(aiText) && (AI_HINTS.test(aiText) || aiText.length >= 16));
  if (hasAi) {
    signals.push("uses artificial intelligence and machine learning");
    signals.push("AI systems high-risk AI");
  }

  const summary = `${intake.productName} ${intake.productSummary} ${intake.productFeatures.join(" ")}`.toLowerCase();
  if (/\b(software|saas|platform|cloud|firmware|connected|hardware|device|mobile)\b/.test(summary)) {
    signals.push("software products cybersecurity digital products");
  }

  return signals;
}

export function intakeToDescription(intake: ProductIntakeState): string {
  const parts: string[] = [];
  if (intake.productName.trim()) parts.push(`Product: ${intake.productName.trim()}`);
  if (intake.productFeatures.length) {
    parts.push(
      `Features: ${intake.productFeatures.map((f) => formatProductFeatureLabel(f)).join(", ")}`,
    );
  }
  if (intake.productSummary.trim()) parts.push(`Summary: ${intake.productSummary.trim()}`);
  if (intake.organisationName.trim()) parts.push(`Organisation: ${intake.organisationName.trim()}`);
  if (intake.actorRoles.length) parts.push(`Roles: ${intake.actorRoles.join(", ")}`);
  if (intake.markets.length) {
    parts.push(`Markets: ${intake.markets.map((m) => formatMarketLabel(m)).join(", ")}`);
  }
  if (intake.establishedInEu !== "unknown") parts.push(`Established in EU: ${intake.establishedInEu}`);
  if (intake.sellsToEu !== "unknown") parts.push(`Sells to EU: ${intake.sellsToEu}`);
  if (intake.dataFlows?.length) {
    parts.push(`Data flows: ${intake.dataFlows.map((f) => formatDataFlowLabel(f)).join(", ")}`);
  }
  if (intake.dataFlowDescription.trim()) {
    parts.push(`Data flow details:\n${intake.dataFlowDescription.trim()}`);
  } else if (!intake.dataFlows?.length && intake.processesPersonalData !== "unknown") {
    parts.push(`Processes personal data: ${intake.processesPersonalData}`);
  }
  if (intake.dataSubjects.length) parts.push(`Data subjects: ${intake.dataSubjects.join(", ")}`);
  if (intake.aiFeatures?.length) {
    parts.push(`AI use: ${intake.aiFeatures.map((f) => formatAiFeatureLabel(f)).join(", ")}`);
  }
  if (intake.aiUsageDescription.trim()) {
    parts.push(`AI usage details:\n${intake.aiUsageDescription.trim()}`);
  } else if (!intake.aiFeatures?.length && intake.hasAi !== "unknown") {
    parts.push(`Uses AI: ${intake.hasAi}`);
  }
  if (intake.supplementalNote.trim()) parts.push(`Additional detail:\n${intake.supplementalNote.trim()}`);

  const signals = intakeComplianceSignals(intake);
  if (signals.length) {
    parts.push(`Compliance context: ${[...new Set(signals)].join("; ")}`);
  }

  return parts.join("\n");
}

export function hasStructuredIntake(
  intake: ProductIntakeState,
  filesCount = 0,
  kgFactsCount = 0,
): boolean {
  return (
    intake.productName.trim().length >= 2 ||
    intake.productFeatures.length > 0 ||
    intake.productSummary.trim().length >= 12 ||
    intake.organisationName.trim().length >= 2 ||
    intake.actorRoles.length > 0 ||
    intake.markets.length > 0 ||
    intake.dataFlows?.length > 0 ||
    intake.dataFlowDescription.trim().length >= 8 ||
    intake.aiFeatures?.length > 0 ||
    intake.aiUsageDescription.trim().length >= 8 ||
    intake.processesPersonalData === "yes" ||
    intake.hasAi === "yes" ||
    filesCount > 0 ||
    kgFactsCount > 0
  );
}

export function intakeGaps(intake: ProductIntakeState): string[] {
  return INTAKE_CARDS.flatMap((c) => cardGaps(c.id, intake));
}

export function mergeIntakeState(
  current: ProductIntakeState,
  suggested: Partial<ProductIntakeState>,
): ProductIntakeState {
  const next = { ...current };
  for (const key of Object.keys(suggested) as (keyof ProductIntakeState)[]) {
    const val = suggested[key];
    const cur = current[key];
    if (typeof cur === "string" && cur.trim() && cur !== "unknown") continue;
    if (Array.isArray(cur) && cur.length > 0) continue;
    if (typeof cur === "boolean" && cur) continue;
    if (val !== undefined && val !== null) {
      (next as Record<string, unknown>)[key] = val;
    }
  }
  return next;
}

export function cardIdForField(field: keyof ProductIntakeState): IntakeCardId {
  for (const card of INTAKE_CARDS) {
    if (CARD_FIELDS[card.id].includes(field)) return card.id;
  }
  return "product";
}

export function mapMissingPredicates(
  rows: Array<{ predicate?: string; description?: string }>,
): MissingPredicateHint[] {
  const predToField: Record<string, { cardId: IntakeCardId; fieldKey?: keyof ProductIntakeState }> = {
    controller: { cardId: "organisation", fieldKey: "organisationName" },
    processor: { cardId: "organisation", fieldKey: "organisationName" },
    provider: { cardId: "organisation", fieldKey: "organisationName" },
    market: { cardId: "organisation", fieldKey: "markets" },
    established_in: { cardId: "organisation", fieldKey: "establishedInEu" },
    processing_in_context_of_establishment: { cardId: "organisation", fieldKey: "establishedInEu" },
    concerns: { cardId: "data_ai", fieldKey: "dataFlowDescription" },
    identifies: { cardId: "data_ai", fieldKey: "dataFlowDescription" },
    category: { cardId: "data_ai", fieldKey: "dataFlowDescription" },
    has_feature: { cardId: "data_ai", fieldKey: "aiUsageDescription" },
    has_capability: { cardId: "data_ai", fieldKey: "aiUsageDescription" },
    high_risk: { cardId: "data_ai", fieldKey: "aiUsageDescription" },
  };

  return rows.map((row) => {
    const pred = String(row.predicate || "");
    const mapping = predToField[pred] || { cardId: "product" as IntakeCardId };
    return {
      predicate: pred,
      description: row.description || pred,
      cardId: mapping.cardId,
      fieldKey: mapping.fieldKey,
    };
  });
}
