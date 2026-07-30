import type { ScannedLawItem } from "./applicabilityScan";
import { lawNameFromScannedItem } from "./lawDisplayName";
import type { ProductIntakeState } from "./kgIntakeSchema";
import type { ClarifyingQuestion, ChatResponse } from "../types/chat";
import type { KgFact } from "./productStore";

export interface FrameworkRow {
  code: string;
  name: string;
  status: string;
  trigger: string;
}

export interface NextStepRow {
  id: string;
  action: string;
  rationale: string;
}

export interface RiskFlag {
  id: string;
  label: string;
  detail: string;
  tone: "review" | "info";
}

export function buildFrameworkRows(items: ScannedLawItem[]): FrameworkRow[] {
  return items.map((item) => ({
    code: item.rowCode,
    name: lawNameFromScannedItem(item),
    status: item.status,
    trigger:
      item.scanRow?.match_rationale?.trim() ||
      (item.engineMode === "symbolic"
        ? "Core framework — deterministic scope rules"
        : "Catalog relevance match"),
  }));
}

export function mergeOpenQuestions(
  openQuestions: ClarifyingQuestion[] | undefined,
): Array<{ id: string; text: string; detail?: string; regulation?: string }> {
  const rows: Array<{ id: string; text: string; detail?: string; regulation?: string }> = [];
  for (const q of openQuestions ?? []) {
    const text = q.text?.trim() || q.missing_atom || q.predicate || "";
    if (!text) continue;
    if (/^predicate used by improved recital/i.test(text)) continue;
    rows.push({
      id: `oq-${rows.length}`,
      text,
      detail: q.dimension ? `Dimension: ${q.dimension}` : undefined,
      regulation: q.regulation,
    });
  }
  return rows;
}

export function buildRiskFlags(intake: ProductIntakeState, assessment: ChatResponse | null): RiskFlag[] {
  const flags: RiskFlag[] = [];
  if (intake.specialCategoryData === "yes" || intake.specialCategoryData === "unknown") {
    flags.push({
      id: "special-category",
      label: "Special category data",
      detail:
        intake.specialCategoryData === "yes"
          ? "Special category personal data flagged — heightened GDPR safeguards may apply."
          : "Special category data status unclear — confirm before finalising scope.",
      tone: "review",
    });
  }
  if (intake.hasAi === "yes" || intake.aiFeatures.length > 0) {
    flags.push({
      id: "ai-use",
      label: "AI in product",
      detail: "AI features detected — review AI Act material scope and governance obligations.",
      tone: "review",
    });
  }
  if (intake.highRiskAiUse === "yes" || intake.highRiskAiUse === "unknown") {
    flags.push({
      id: "high-risk-ai",
      label: "AI Act high-risk path",
      detail:
        intake.highRiskAiUse === "yes"
          ? "High-risk AI use indicated — governance and conformity workflows likely required."
          : "High-risk AI status unknown — confirm Annex III / product safety linkage.",
      tone: "review",
    });
  }
  if (intake.actorRoles.includes("PROCESSOR")) {
    flags.push({
      id: "processor-role",
      label: "Processor role",
      detail: "Acting as processor — verify DPAs, subprocessor inventory, and instructions from controller.",
      tone: "info",
    });
  }
  const bottomLine = assessment?.narrative?.bottom_line;
  const bottomText =
    typeof bottomLine === "string"
      ? bottomLine
      : bottomLine?.rows?.map((r) => r.conclusion_text).join(" ") || bottomLine?.title || "";
  if (bottomText.toLowerCase().includes("high-risk")) {
    flags.push({
      id: "engine-high-risk",
      label: "Engine: high-risk AI signal",
      detail: bottomText,
      tone: "review",
    });
  }
  return flags;
}

export function buildNextSteps(
  intake: ProductIntakeState,
  openQuestionCount: number,
  lawCodes: string[],
): NextStepRow[] {
  const steps: NextStepRow[] = [];
  if (openQuestionCount > 0) {
    steps.push({
      id: "close-gaps",
      action: `Answer ${openQuestionCount} open question${openQuestionCount === 1 ? "" : "s"} in product facts`,
      rationale: "Tighter facts improve framework scoping confidence.",
    });
  }
  if (intake.hasAi === "yes" || intake.aiFeatures.length > 0) {
    steps.push({
      id: "ai-register",
      action: "Add to AI governance register",
      rationale: "Document tool, use case, risk tier, and owner for internal AI governance.",
    });
  }
  if (intake.processesPersonalData === "yes") {
    steps.push({
      id: "lawful-basis",
      action: "Document lawful basis and data flows",
      rationale: "GDPR material scope likely applies — confirm legal basis and transparency.",
    });
  }
  if (lawCodes.includes("ai_act") && intake.highRiskAiUse !== "no") {
    steps.push({
      id: "annex-iii",
      action: "Confirm Annex III / high-risk classification",
      rationale: "Determines AI Act governance and conformity obligations.",
    });
  }
  if (intake.actorRoles.includes("PROCESSOR") || intake.actorRoles.includes("CONTROLLER")) {
    steps.push({
      id: "vendor-dpa",
      action: "Review vendor DPAs and subprocessor list",
      rationale: "Accountability and contract terms for data sharing chains.",
    });
  }
  steps.push({
    id: "dpia-check",
    action: "Run DPIA / privacy impact trigger check",
    rationale: "Profiling, large-scale processing, or new technology may require formal assessment.",
  });
  return steps;
}

export function factsOnRecord(kgFacts: KgFact[], intake: ProductIntakeState): Array<{ label: string; value: string }> {
  if (kgFacts.length > 0) {
    return kgFacts.map((f) => ({ label: f.label, value: f.value }));
  }
  const rows: Array<{ label: string; value: string }> = [];
  if (intake.productName) rows.push({ label: "Product", value: intake.productName });
  if (intake.productSummary) rows.push({ label: "Summary", value: intake.productSummary });
  if (intake.markets.length) rows.push({ label: "Markets", value: intake.markets.join(", ") });
  if (intake.actorRoles.length) rows.push({ label: "Roles", value: intake.actorRoles.join(", ") });
  if (intake.processesPersonalData !== "unknown") {
    rows.push({ label: "Personal data", value: intake.processesPersonalData });
  }
  if (intake.hasAi !== "unknown") rows.push({ label: "AI", value: intake.hasAi });
  return rows;
}
