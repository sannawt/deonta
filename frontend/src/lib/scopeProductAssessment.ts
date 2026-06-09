import { lawSummaryForCode } from "./lawSummaries";
import { normRegCode } from "./scopeProvisionCatalog";
import { productAssessmentNarrative } from "./scopeLawNarratives";
import type { ScopeInstrument } from "../types/chat";

export function productScopeAssessment(
  instrument: ScopeInstrument | undefined,
  lawCode: string,
): string {
  if (!instrument) return "";

  const code = normRegCode(lawCode || instrument.reg_key || "");
  const catalog = lawSummaryForCode(code);
  const title = instrument.full_name || catalog?.title || lawCode;

  return productAssessmentNarrative(code, instrument.verdict, title);
}
