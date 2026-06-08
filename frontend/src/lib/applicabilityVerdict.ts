import type { LawScanResult } from "./api";
import type { ProductSpec } from "./productStore";
import type { ScopeInstrument } from "../types/chat";

export type ApplicabilityTier = "likely" | "potentially" | "unlikely";

export interface LawApplicabilityRow {
  code: string;
  uiLabel: string;
  tier: ApplicabilityTier;
  score: number;
}

export interface ApplicabilityVerdictSummary {
  productTitle: string;
  bottomLine: string;
  likelyCount: number;
  potentiallyCount: number;
  rows: LawApplicabilityRow[];
}

function normCode(value: string): string {
  return value.toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
}

function instrumentMatchesCode(inst: ScopeInstrument, code: string): boolean {
  const c = normCode(code);
  const candidates = [inst.reg_key, inst.id, inst.label]
    .filter(Boolean)
    .map((v) => normCode(String(v)));
  if (candidates.some((k) => k === c || k.includes(c) || c.includes(k))) return true;
  if (c === "ai_act" && candidates.some((k) => k.includes("ai"))) return true;
  return false;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx] ?? sorted[sorted.length - 1];
}

function scoreThresholds(
  scanRows: LawScanResult[],
  minScore = 0.75,
): { likely: number; potentially: number } {
  const scores = scanRows
    .map((r) => r.score ?? 0)
    .filter((s) => s >= minScore)
    .sort((a, b) => a - b);
  if (!scores.length) {
    return { likely: minScore + 0.08, potentially: minScore };
  }
  return {
    likely: Math.max(minScore, percentile(scores, 0.65)),
    potentially: Math.max(minScore, percentile(scores, 0.35)),
  };
}

function classifyTier(
  scanRow: LawScanResult | undefined,
  instrument: ScopeInstrument | undefined,
  thresholds: { likely: number; potentially: number },
): ApplicabilityTier {
  if (instrument?.verdict === "applies") return "likely";
  if (instrument?.verdict === "does_not_apply") return "unlikely";

  if (instrument?.verdict === "cannot_determine") {
    const dims = instrument.dimensions ?? [];
    if (dims.some((d) => d.result === "FAIL")) return "unlikely";
    const passCount = dims.filter((d) => d.result === "PASS").length;
    if (dims.length > 0 && passCount >= Math.ceil(dims.length / 2)) return "likely";
    return "potentially";
  }

  const score = scanRow?.score ?? 0;
  if (score >= thresholds.likely) return "likely";
  if (score >= thresholds.potentially) return "potentially";
  return "potentially";
}

function firstSentence(text: string, maxLen = 280): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const match = cleaned.match(/^[^.!?]+[.!?]?/);
  const sentence = (match?.[0] || cleaned).trim();
  if (sentence.length <= maxLen) return sentence;
  return `${sentence.slice(0, maxLen - 1).trim()}…`;
}

function formatRegimeList(labels: string[]): string {
  const unique = labels.filter((label, i, all) => label && all.indexOf(label) === i);
  if (!unique.length) return "";
  if (unique.length === 1) return unique[0];
  return `${unique.slice(0, -1).join(", ")}, and ${unique[unique.length - 1]}`;
}

function regimeLabel(row: LawScanResult): string {
  const ui = (row.ui_label || "").trim();
  if (ui) return ui.charAt(0).toLowerCase() + ui.slice(1);
  const short = (row.short || row.label || "").trim();
  if (short) return short.charAt(0).toLowerCase() + short.slice(1);
  return (row.legal_instrument || row.catalog_code || row.code || "selected instrument").toString();
}

function buildBottomLine(args: {
  spec: ProductSpec;
  description: string;
  scanRows: LawScanResult[];
  narrativeVerdictLine?: string;
  scenarioGist?: string;
}): string {
  const { spec, description, scanRows, narrativeVerdictLine, scenarioGist } = args;

  const regimeLabels = scanRows
    .slice()
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map(regimeLabel)
    .slice(0, 5);
  const regimeText = formatRegimeList(regimeLabels);

  const narrative = (narrativeVerdictLine || "").trim();
  if (narrative.length > 24) {
    return regimeText
      ? `${narrative} Strongest regimes from your selection: ${regimeText}.`
      : narrative;
  }

  const gist = (scenarioGist || "").trim();
  if (gist.length > 24) {
    return regimeText
      ? `${gist} Strongest regimes from your selection: ${regimeText}.`
      : gist;
  }

  const summary = (spec.summary || "").trim();
  if (summary.length > 24 && summary !== description.trim()) {
    const lead = firstSentence(summary);
    return regimeText
      ? `${lead} Strongest regimes from your selection: ${regimeText}.`
      : lead;
  }

  const descLead = firstSentence(description);
  const marketNote =
    spec.markets?.length
      ? ` Markets: ${spec.markets.join(", ")}.`
      : spec.euLink === "yes"
        ? " EU market link indicated."
        : "";

  if (descLead) {
    const base = descLead.endsWith(".") ? descLead : `${descLead}.`;
    const withMarkets = marketNote ? `${base}${marketNote}` : base;
    return regimeText
      ? `${withMarkets} Strongest regimes from your selection: ${regimeText}.`
      : withMarkets;
  }

  return regimeText
    ? `Strongest regimes from your selection: ${regimeText}.`
    : "Review the per-instrument scope results below.";
}

export function buildApplicabilityVerdictSummary(args: {
  spec: ProductSpec;
  description: string;
  selectedLawCodes: string[];
  scanResults: LawScanResult[];
  instruments?: ScopeInstrument[];
  minScanScore?: number;
  narrativeVerdictLine?: string;
  scenarioGist?: string;
}): ApplicabilityVerdictSummary {
  const {
    spec,
    description,
    selectedLawCodes,
    scanResults,
    instruments = [],
    minScanScore = 0.75,
    narrativeVerdictLine,
    scenarioGist,
  } = args;

  const byRowCode = new Map(scanResults.map((r) => [r.code, r]));
  const selectedScanRows = selectedLawCodes
    .map((code) => byRowCode.get(code))
    .filter((r): r is LawScanResult => Boolean(r));

  const thresholds = scoreThresholds(selectedScanRows, minScanScore);

  const productTitle = spec.name?.trim() || "Your product";

  const rows: LawApplicabilityRow[] = selectedLawCodes.map((rowCode) => {
    const scanRow = byRowCode.get(rowCode);
    const assessCode = scanRow?.catalog_code || scanRow?.code || rowCode;
    const instrument = instruments.find((inst) =>
      instrumentMatchesCode(inst, assessCode),
    );
    return {
      code: rowCode,
      uiLabel:
        scanRow?.ui_label ||
        scanRow?.short ||
        scanRow?.label ||
        assessCode,
      tier: classifyTier(scanRow, instrument, thresholds),
      score: scanRow?.score ?? 0,
    };
  });

  const assessed = rows.filter((r) => r.tier !== "unlikely");
  const likelyCount = assessed.filter((r) => r.tier === "likely").length;
  const potentiallyCount = assessed.filter((r) => r.tier === "potentially").length;

  return {
    productTitle,
    bottomLine: buildBottomLine({
      spec,
      description,
      scanRows: selectedScanRows,
      narrativeVerdictLine,
      scenarioGist,
    }),
    likelyCount,
    potentiallyCount,
    rows,
  };
}
