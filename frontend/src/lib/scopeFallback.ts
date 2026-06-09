/**
 * Fallback scope dimensions when the assess API returns empty instrument breakdowns.
 * Uses intake signals + catalog law knowledge (prototype-style heuristic).
 */

import type { LawScanResult } from "./api";
import { instrumentMatchesCode } from "./applicabilityScan";
import { lawSummaryForCode } from "./lawSummaries";
import type { ProductSpec } from "./productStore";
import type { ScopeDimension, ScopeInstrument, ScopeRuleInvoked } from "../types/chat";
import { provisionsForDimension } from "./scopeProvisionCatalog";
import { resolveAssessCodes } from "./utils";
import { enrichScopeInstruments } from "./scopeEnrichment";
import { dimensionEvidenceSnippet } from "./scopeLawNarratives";

const DIM_LABELS: Record<string, string> = {
  temporal: "Temporal scope",
  territorial: "Territorial scope",
  material: "Material scope",
  exclusions: "Exclusions",
};

const PRIVACY_CODES = new Set(["gdpr", "eprivacy", "data_act"]);
const AI_CODES = new Set(["ai_act", "eu_ai_act"]);
const HARDWARE_CODES = new Set([
  "gpsr",
  "red",
  "cra",
  "rohs",
  "weee",
  "reach",
  "product_liability",
  "market_surveillance",
]);
const CONNECTIVITY_CODES = new Set(["cra", "nis2", "data_act", "red", "eecc"]);

function tri(spec: ProductSpec, key: "euLink" | "processesPersonalData" | "aiSystem"): string {
  return (spec[key] || "unknown").toLowerCase();
}

function inferredAiSystem(spec: ProductSpec): string {
  const direct = tri(spec, "aiSystem");
  if (direct !== "unknown") return direct;
  const text = `${spec.summary || ""} ${spec.name || ""}`.toLowerCase();
  if (
    /\b(ai|ml|machine learning|neural|model inference|generative|llm|gpt|automated decision|applicant|recruitment|hiring|scoring|ranking candidates)\b/.test(
      text,
    )
  ) {
    return "yes";
  }
  return "unknown";
}

function inferredPersonalData(spec: ProductSpec): string {
  const direct = tri(spec, "processesPersonalData");
  if (direct !== "unknown") return direct;
  const text = `${spec.summary || ""} ${spec.name || ""}`.toLowerCase();
  if (/\b(personal data|applicant|employee|customer|user data|biometric|cv\b|resume|profile)\b/.test(text)) {
    return "yes";
  }
  return "unknown";
}

function marketsIncludeEu(spec: ProductSpec): boolean {
  return (spec.markets || []).some((m) => {
    const v = m.toLowerCase();
    return v === "eu" || v === "eea" || v.includes("europe");
  });
}

function dimResult(passLikely: boolean, failLikely: boolean): string {
  if (failLikely) return "FAIL";
  if (passLikely) return "PASS";
  return "UNKNOWN";
}

function rulesForDimension(code: string, dimId: string): ScopeRuleInvoked[] {
  const catalog = provisionsForDimension(code, dimId);
  if (catalog?.rules.length) return catalog.rules;
  return [];
}

function buildDimension(
  code: string,
  dimId: string,
  result: string,
  evidence: string,
): ScopeDimension {
  const rules_invoked = rulesForDimension(code, dimId);
  return {
    id: dimId,
    label: DIM_LABELS[dimId] || dimId,
    result,
    evidence,
    citations: rules_invoked.map((r) => r.citation!).filter(Boolean),
    decisive_facts: [],
    rules_invoked,
    llm: {
      interpretation: evidence,
      why_result: `Scope gate assessed against ${rules_invoked.map((r) => r.citation?.label).filter(Boolean).join(", ") || "catalog rules"}.`,
    },
  };
}

function buildDimensions(code: string, spec: ProductSpec): ScopeDimension[] {
  const eu = tri(spec, "euLink");
  const pd = inferredPersonalData(spec);
  const ai = inferredAiSystem(spec);
  const euMarket = marketsIncludeEu(spec);
  const territorialUnknown = eu === "unknown" && !euMarket;

  const temporalResult = "PASS";
  const temporal = buildDimension(
    code,
    "temporal",
    temporalResult,
    dimensionEvidenceSnippet(code, "temporal", temporalResult),
  );

  const territorialResult = territorialUnknown ? "UNKNOWN" : eu === "yes" || euMarket ? "PASS" : "UNKNOWN";
  const territorial = buildDimension(
    code,
    "territorial",
    territorialResult,
    dimensionEvidenceSnippet(code, "territorial", territorialResult),
  );

  let materialResult: string;
  if (PRIVACY_CODES.has(code)) {
    materialResult = dimResult(pd === "yes", pd === "no");
  } else if (AI_CODES.has(code)) {
    materialResult = dimResult(ai === "yes", ai === "no");
  } else if (HARDWARE_CODES.has(code) || CONNECTIVITY_CODES.has(code)) {
    materialResult = "PASS";
  } else {
    materialResult = "UNKNOWN";
  }

  const material = buildDimension(
    code,
    "material",
    materialResult,
    dimensionEvidenceSnippet(code, "material", materialResult),
  );

  const exclusionsResult = "UNKNOWN";
  const exclusions = buildDimension(
    code,
    "exclusions",
    exclusionsResult,
    dimensionEvidenceSnippet(code, "exclusions", exclusionsResult),
  );

  return [temporal, territorial, material, exclusions];
}

function heuristicVerdict(dimensions: ScopeDimension[]): string {
  const results = Object.fromEntries(dimensions.map((d) => [d.id, d.result]));
  if (results.material === "FAIL" || results.exclusions === "FAIL") return "does_not_apply";
  if (results.material === "PASS" && results.territorial === "PASS") return "applies";
  if (results.material === "PASS") return "cannot_determine";
  return "cannot_determine";
}

function buildFallbackInstrument(
  code: string,
  spec: ProductSpec,
  scanRow?: LawScanResult,
): ScopeInstrument {
  const catalog = lawSummaryForCode(code);
  const label =
    scanRow?.legal_instrument || scanRow?.label || catalog?.title || code.toUpperCase();
  const dimensions = buildDimensions(code, spec);
  const verdict = heuristicVerdict(dimensions);
  const verdictDisplay =
    verdict === "applies"
      ? "Indicates in scope"
      : verdict === "does_not_apply"
        ? "Indicates out of scope"
        : "Needs review";

  const headline =
    verdict === "applies"
      ? `${label} appears likely in scope on the current intake facts.`
      : verdict === "does_not_apply"
        ? `${label} does not appear in scope on the current facts.`
        : `${label} may apply; confirm territorial and material scope using the dimension breakdown below.`;

  return {
    id: code,
    label: scanRow?.short || catalog?.title || label,
    full_name: label,
    reg_key: code,
    verdict,
    verdict_display: verdictDisplay,
    headline,
    llm_summary: headline,
    missing_atoms: [],
    dimensions,
    legal_tests: [
      {
        label: `Does ${label} apply to this product?`,
        answer: verdict === "applies" ? "yes" : verdict === "does_not_apply" ? "no" : "unknown",
      },
    ],
    facts_used: [
      spec.summary?.trim() || spec.name || "Product intake",
      ...(spec.markets?.length ? [`Markets: ${spec.markets.join(", ")}`] : []),
    ],
    missing_facts: [],
    assessment_source: "heuristic",
    confidence: verdict === "cannot_determine" ? "medium" : "high",
  };
}

export function ensureScopeInstruments(
  instruments: ScopeInstrument[],
  selectedCodes: string[],
  scanResults: LawScanResult[],
  spec: ProductSpec,
): ScopeInstrument[] {
  const codes = resolveAssessCodes(selectedCodes, scanResults);
  if (!codes.length) return instruments;

  const merged = codes.map((code) => {
    const scanRow = scanResults.find(
      (r) => r.code === code || r.catalog_code === code,
    );
    const existing = instruments.find((inst) => instrumentMatchesCode(inst, code));

    if (existing?.dimensions?.length && existing.assessment_source !== "pending") {
      return existing;
    }

    const fallback = buildFallbackInstrument(code, spec, scanRow);
    if (!existing) {
      return fallback;
    }

    const wasPending = existing.assessment_source === "pending";

    return {
      ...existing,
      dimensions: existing.dimensions?.length ? existing.dimensions : fallback.dimensions,
      llm_summary: wasPending ? fallback.llm_summary : existing.llm_summary || fallback.llm_summary,
      headline: existing.headline?.trim() || fallback.headline,
      verdict: wasPending ? fallback.verdict : existing.verdict || fallback.verdict,
      verdict_display: wasPending
        ? fallback.verdict_display
        : existing.verdict_display || fallback.verdict_display,
      legal_tests: existing.legal_tests?.length ? existing.legal_tests : fallback.legal_tests,
      facts_used: existing.facts_used?.length ? existing.facts_used : fallback.facts_used,
      missing_facts: [],
      missing_atoms: [],
      assessment_source: wasPending ? "heuristic" : existing.assessment_source || "heuristic",
      confidence: existing.confidence || fallback.confidence,
    };
  });

  return enrichScopeInstruments(merged, spec);
}
