import type { LawScanResult } from "./api";
import type { ClarifyingQuestion, ScopeInstrument } from "../types/chat";
import type { ApplicabilityTier, LawApplicabilityRow } from "./applicabilityVerdict";
import {
  humanizeFactText,
  humanizeMissingQuestion,
  isTechnicalAtom,
} from "./plainLanguage";

export type LawScanStatus = "confirmed" | "assessment_required" | "potential" | "excluded";

export type ScopeGroup = "likely" | "maybe" | "unlikely";

export const SCOPE_GROUP_ORDER: ScopeGroup[] = ["likely", "maybe", "unlikely"];

export const SCOPE_GROUP_LABEL: Record<ScopeGroup, string> = {
  likely: "Likely in scope",
  maybe: "Maybe in scope",
  unlikely: "Not likely in scope",
};

export interface ScannedLawItem {
  rowCode: string;
  listLabel: string;
  fullLabel: string;
  selected: boolean;
  tier: ApplicabilityTier;
  status: LawScanStatus;
  score: number;
  engineMode: LawScanResult["engine_mode"];
  scanRow?: LawScanResult;
}

export interface LegalTestRow {
  label: string;
  answer: string;
}

export interface LawVerdictDetail {
  title: string;
  instrumentName: string;
  verdict: string;
  confidence: "High" | "Medium" | "Low";
  summary: string;
  legalTests: LegalTestRow[];
  factsUsed: string[];
  missingFacts: string[];
}

function normCode(value: string): string {
  return value.toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
}

export function instrumentMatchesCode(inst: ScopeInstrument, code: string): boolean {
  const c = normCode(code);
  const candidates = [inst.reg_key, inst.id, inst.label]
    .filter(Boolean)
    .map((v) => normCode(String(v)));
  if (candidates.some((k) => k === c || k.includes(c) || c.includes(k))) return true;
  if (c === "ai_act" && candidates.some((k) => k.includes("ai"))) return true;
  return false;
}

function dimAnswer(result: string): string {
  switch (result) {
    case "PASS":
      return "yes";
    case "FAIL":
      return "no";
    case "UNKNOWN":
      return "unknown";
    case "NOT_REACHED":
      return "not reached";
    case "DEFERRED":
      return "deferred";
    default:
      return result.toLowerCase() || "unknown";
  }
}

function lawListLabel(scan: LawScanResult): string {
  const short = (scan.short || "").trim();
  const ui = (scan.ui_label || "").trim();
  if (short && short.length <= 16 && !/^(EU|MSR|PLD)$/i.test(short)) {
    if (ui && /cybersecurity/i.test(ui) && /^(RED|red)$/i.test(short)) {
      return `${short} Cybersecurity`;
    }
    return short;
  }
  if (ui) {
    const segment = ui.split("/")[0].trim();
    if (segment.length <= 28) return segment;
    return segment.slice(0, 26).trim() + "…";
  }
  return short || scan.code;
}

function compactTheme(scan: LawScanResult, uiLabel: string): string {
  const short = (scan.short || "").trim();
  if (short && short.length <= 10) return short.toLowerCase();
  const segment = uiLabel.split("/")[0].trim().toLowerCase();
  const words = segment.split(/\s+/).filter((w) => w.length > 2);
  if (words.length <= 2) return segment;
  return words.slice(0, 2).join(" ");
}

function firstSentence(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^[^.!?]+[.!?]?/);
  return (match?.[0] || trimmed).trim();
}

function scopeConfirmedThemes(
  instruments: ScopeInstrument[],
  scanResults: LawScanResult[],
  selectedCodes: string[],
): string[] {
  const selectedSet = new Set(selectedCodes);
  const themes: string[] = [];

  for (const inst of instruments) {
    const applies = inst.verdict === "applies";
    const passCount = (inst.dimensions ?? []).filter((d) => d.result === "PASS").length;
    const symbolicConfirmed =
      inst.assessment_source === "symbolic" && passCount >= 2;
    if (!applies && !symbolicConfirmed) continue;

    const scan = scanResults.find((row) => {
      const code = row.catalog_code || row.code;
      return selectedSet.has(row.code) && instrumentMatchesCode(inst, code);
    });
    if (!scan) continue;
    const theme = compactTheme(scan, scan.ui_label || inst.label);
    if (theme && !themes.includes(theme)) themes.push(theme);
    if (themes.length >= 3) break;
  }
  return themes;
}

export function buildCompactBottomLine(
  scanResults: LawScanResult[],
  _rows: LawApplicabilityRow[],
  selectedCodes: string[],
  options?: {
    scenarioGist?: string;
    productSummary?: string;
    instruments?: ScopeInstrument[];
  },
): string {
  const gist = (options?.scenarioGist || "").trim();
  const summaryLead = firstSentence(options?.productSummary || "");
  const narrative = gist || summaryLead;

  const themes = scopeConfirmedThemes(
    options?.instruments ?? [],
    scanResults,
    selectedCodes,
  );

  if (narrative && themes.length) {
    return `${narrative} — scope points to ${themes.join(", ")}.`;
  }
  if (narrative) return narrative;

  if (themes.length) {
    return `Scope assessment indicates ${themes.join(", ")} obligations on these facts.`;
  }

  const selectedCount = selectedCodes.length;
  if (selectedCount > 0) {
    return `${selectedCount} instrument${selectedCount === 1 ? "" : "s"} selected — review per-law verdicts below.`;
  }

  return "Review per-instrument verdicts below.";
}

function dimensionPassCount(instrument: ScopeInstrument | undefined): number {
  return (instrument?.dimensions ?? []).filter((d) => d.result === "PASS").length;
}

export function resolveLawStatus(
  selected: boolean,
  tier: ApplicabilityTier,
  instrument: ScopeInstrument | undefined,
  _engineMode: LawScanResult["engine_mode"],
): LawScanStatus {
  if (!selected || tier === "unlikely") return "excluded";

  if (!instrument || instrument.assessment_source === "pending") {
    return "potential";
  }

  if (instrument.verdict === "applies") return "confirmed";

  const passCount = dimensionPassCount(instrument);
  if (instrument.assessment_source === "symbolic" && passCount >= 2) {
    return "confirmed";
  }

  if (
    instrument.verdict === "cannot_determine" ||
    (instrument.assessment_source === "llm_assisted" ||
      instrument.assessment_source === "heuristic") &&
      instrument.verdict !== "does_not_apply"
  ) {
    if (passCount >= 1 && instrument.verdict !== "does_not_apply") return "assessment_required";
    return "assessment_required";
  }

  if (instrument.verdict === "does_not_apply") return "excluded";

  return "potential";
}

export function buildScannedLawList(args: {
  scanResults: LawScanResult[];
  selectedCodes: string[];
  tierRows: LawApplicabilityRow[];
  instruments: ScopeInstrument[];
}): ScannedLawItem[] {
  const { scanResults, selectedCodes, tierRows, instruments } = args;
  const selectedSet = new Set(selectedCodes);
  const tierByCode = new Map(tierRows.map((r) => [r.code, r]));

  return scanResults
    .slice()
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((scan) => {
      const rowCode = scan.code;
      const tierRow = tierByCode.get(rowCode);
      const assessCode = scan.catalog_code || scan.code;
      const instrument = instruments.find((inst) =>
        instrumentMatchesCode(inst, assessCode),
      );
      const tier = tierRow?.tier ?? "potentially";
      const selected = selectedSet.has(rowCode);
      return {
        rowCode,
        listLabel: lawListLabel(scan),
        fullLabel: scan.ui_label || scan.legal_instrument || scan.short || rowCode,
        selected,
        tier,
        status: resolveLawStatus(
          selected,
          tier,
          instrument,
          scan.engine_mode,
        ),
        score: scan.score ?? 0,
        engineMode: scan.engine_mode,
        scanRow: scan,
      };
    });
}

function confidenceLabel(
  score: number,
  instrument: ScopeInstrument | undefined,
): "High" | "Medium" | "Low" {
  const llmConf = instrument?.confidence;
  if (llmConf === "high") return "High";
  if (llmConf === "low") return "Low";
  if (llmConf === "medium") return "Medium";

  if (instrument?.verdict === "applies") return "High";
  if (instrument?.verdict === "does_not_apply") return "Low";
  const passCount = dimensionPassCount(instrument);
  if (instrument?.verdict === "cannot_determine" && passCount >= 1) return "Medium";
  if (passCount >= 2) return "Medium";
  if (score >= 0.88) return "Medium";
  if (score >= 0.75) return "Medium";
  return "Low";
}

function verdictLabel(
  instrument: ScopeInstrument | undefined,
  selected: boolean,
): string {
  if (!selected) return "Not selected";
  if (!instrument || instrument.assessment_source === "pending") {
    return "Scope assessment pending";
  }
  if (instrument.assessment_source === "heuristic" && instrument.verdict === "cannot_determine") {
    return "Cannot conclude yet";
  }
  if (instrument.verdict_display) return instrument.verdict_display;
  if (instrument.verdict === "applies") return "Indicates in scope";
  if (instrument.verdict === "does_not_apply") return "Indicates out of scope";
  return "Scope assessment required";
}

function summaryText(instrument: ScopeInstrument | undefined): string {
  if (instrument?.llm_summary) return instrument.llm_summary;
  if (instrument?.headline) return instrument.headline;
  return "";
}

function buildLegalTests(instrument: ScopeInstrument | undefined): LegalTestRow[] {
  if (instrument?.legal_tests?.length) {
    return instrument.legal_tests.map((t) => ({
      label: t.label,
      answer: t.answer,
    }));
  }
  if (instrument?.dimensions?.length) {
    return instrument.dimensions.map((d) => ({
      label: d.label,
      answer: dimAnswer(d.result),
    }));
  }
  return [];
}

function collectFactsUsed(instrument: ScopeInstrument | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const add = (raw: string) => {
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text || text === "—" || seen.has(text.toLowerCase())) return;
    seen.add(text.toLowerCase());
    out.push(text);
  };

  for (const fact of instrument?.facts_used ?? []) {
    add(humanizeFactText(fact));
  }

  for (const dim of instrument?.dimensions ?? []) {
    for (const fact of dim.decisive_facts ?? []) {
      if (fact.kind !== "missing" && fact.kind !== "gap" && fact.kind !== "trace_gap") {
        add(humanizeFactText(fact.label || fact.atom || ""));
      }
    }
  }

  return out.slice(0, 8);
}

function looksLikePredicateAtom(text: string): boolean {
  return isTechnicalAtom(text);
}

function collectMissingFacts(
  instrument: ScopeInstrument | undefined,
  openQuestions: ClarifyingQuestion[] | undefined,
  focusedLawCode: string,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const lawCode = normCode(focusedLawCode);

  const add = (raw: string) => {
    const text = raw.replace(/_/g, " ").replace(/\s+/g, " ").trim();
    if (!text || looksLikePredicateAtom(text) || seen.has(text.toLowerCase())) return;
    seen.add(text.toLowerCase());
    out.push(text.endsWith("?") ? text : `${text}?`);
  };

  for (const fact of instrument?.missing_facts ?? []) {
    add(humanizeMissingQuestion(fact));
  }

  for (const dim of instrument?.dimensions ?? []) {
    for (const fact of dim.decisive_facts ?? []) {
      if (fact.kind === "missing" || fact.kind === "gap" || fact.kind === "trace_gap") {
        add(humanizeMissingQuestion(fact.label || fact.atom || ""));
      }
    }
  }

  for (const q of openQuestions ?? []) {
    const reg = normCode(q.regulation || "");
    if (reg && reg !== lawCode) continue;
    add(humanizeMissingQuestion(q.text || ""));
  }

  return out.slice(0, 8);
}

export function assessmentSourceLabel(
  instrument: ScopeInstrument | undefined,
): string | null {
  if (!instrument?.assessment_source) return null;
  switch (instrument.assessment_source) {
    case "symbolic":
      return "Symbolic";
    case "llm_assisted":
      return "LLM-assisted";
    case "pending":
      return "Pending";
    default:
      return null;
  }
}

export function filterQuestionsForLaw(
  openQuestions: ClarifyingQuestion[] | undefined,
  lawCode: string,
): ClarifyingQuestion[] {
  const code = normCode(lawCode);
  return (openQuestions ?? []).filter((q) => {
    const reg = normCode(q.regulation || "");
    return !reg || reg === code;
  });
}

export function buildLawVerdictDetail(args: {
  item: ScannedLawItem;
  instrument?: ScopeInstrument;
  openQuestions?: ClarifyingQuestion[];
}): LawVerdictDetail {
  const { item, instrument, openQuestions } = args;
  const lawCode =
    item.scanRow?.catalog_code || item.scanRow?.code || item.rowCode;

  return {
    title: item.fullLabel,
    instrumentName: instrument?.label || item.listLabel,
    verdict: verdictLabel(instrument, item.selected),
    confidence: confidenceLabel(item.score, instrument),
    summary: summaryText(instrument),
    legalTests: buildLegalTests(instrument),
    factsUsed: collectFactsUsed(instrument),
    missingFacts: collectMissingFacts(instrument, openQuestions, lawCode),
  };
}

export function resolveScopeGroup(
  item: ScannedLawItem,
  instrument?: ScopeInstrument,
): ScopeGroup {
  if (
    instrument?.verdict === "does_not_apply" ||
    item.tier === "unlikely" ||
    item.status === "excluded"
  ) {
    return "unlikely";
  }
  if (instrument?.verdict === "applies" || item.status === "confirmed") {
    return "likely";
  }
  if (dimensionPassCount(instrument) >= 2) {
    return "likely";
  }
  return "maybe";
}

export function groupLawsByScope(
  items: ScannedLawItem[],
  instruments: ScopeInstrument[],
): Record<ScopeGroup, Array<{ item: ScannedLawItem; instrument?: ScopeInstrument }>> {
  const grouped: Record<
    ScopeGroup,
    Array<{ item: ScannedLawItem; instrument?: ScopeInstrument }>
  > = {
    likely: [],
    maybe: [],
    unlikely: [],
  };

  for (const item of items) {
    const assessCode = item.scanRow?.catalog_code || item.scanRow?.code || item.rowCode;
    const instrument = instruments.find((inst) => instrumentMatchesCode(inst, assessCode));
    const group = resolveScopeGroup(item, instrument);
    grouped[group].push({ item, instrument });
  }

  return grouped;
}

export interface ProductScopeSignals {
  euLink?: string;
  processesPersonalData?: string;
  aiSystem?: string;
  markets?: string[];
}

export interface ScopeOverallNarrative {
  text: string;
}

function formatLawList(labels: string[], max = 6): string {
  const unique = labels.filter((l, i, all) => l && all.indexOf(l) === i);
  if (!unique.length) return "";
  if (unique.length <= max) {
    if (unique.length === 1) return unique[0];
    return `${unique.slice(0, -1).join(", ")}, and ${unique[unique.length - 1]}`;
  }
  const shown = unique.slice(0, max).join(", ");
  return `${shown}, and ${unique.length - max} others`;
}

function instrumentNarrative(instrument?: ScopeInstrument): string {
  const text = (instrument?.llm_summary || instrument?.headline || "").trim();
  if (!text) return "";
  return text.endsWith(".") ? text : `${text}.`;
}

function signalContext(signals?: ProductScopeSignals): string {
  if (!signals) return "";
  const parts: string[] = [];
  if (signals.processesPersonalData === "yes") {
    parts.push("the product processes personal data");
  } else if (signals.processesPersonalData === "no") {
    parts.push("personal data processing is not indicated");
  }
  if (signals.euLink === "yes") {
    parts.push("there is an EU market or establishment link");
  } else if (signals.euLink === "no") {
    parts.push("no EU market or establishment link is established on these facts");
  }
  if (signals.aiSystem === "yes") {
    parts.push("the product is treated as an AI system");
  } else if (signals.aiSystem === "no") {
    parts.push("the product is not characterised as an AI system");
  }
  if (signals.markets?.length) {
    parts.push(`target markets include ${signals.markets.join(", ")}`);
  }
  if (!parts.length) return "";
  if (parts.length === 1) return `On these facts, ${parts[0]}.`;
  return `On these facts, ${parts.slice(0, -1).join("; ")}, and ${parts[parts.length - 1]}.`;
}

export function buildScopeOverallNarrative(args: {
  productSummary?: string;
  scenarioGist?: string;
  narrativeVerdictLine?: string;
  grouped: Record<ScopeGroup, Array<{ item: ScannedLawItem; instrument?: ScopeInstrument }>>;
  signals?: ProductScopeSignals;
}): ScopeOverallNarrative {
  const { grouped, signals } = args;
  const likely = grouped.likely;
  const maybe = grouped.maybe;
  const unlikely = grouped.unlikely;
  const total = likely.length + maybe.length + unlikely.length;

  const narrative = (args.narrativeVerdictLine || "").trim();
  const gist = (args.scenarioGist || "").trim();
  const summaryLead = firstSentence(args.productSummary || "");
  const lead =
    narrative.length > 40
      ? narrative
      : gist || summaryLead || "Scope assessment for the selected instruments.";

  const overviewParts = [
    `We assessed ${total} selected instrument${total === 1 ? "" : "s"} against your product profile.`,
    likely.length
      ? `${likely.length} ${likely.length === 1 ? "is" : "are"} likely in scope on the current facts.`
      : "None are likely in scope on the current facts.",
    maybe.length
      ? `${maybe.length} sit${maybe.length === 1 ? "s" : ""} in the uncertain middle tier and need more facts or review.`
      : "None sit in the uncertain middle tier.",
    unlikely.length
      ? `${unlikely.length} ${unlikely.length === 1 ? "is" : "are"} not likely in scope after the scope gates were applied.`
      : "",
  ].filter(Boolean);

  const overview = overviewParts.join(" ");

  let likelyNote: string | null = null;
  if (likely.length) {
    const details = likely.map(({ item, instrument }) => {
      const blurb = instrumentNarrative(instrument);
      return blurb ? `${item.listLabel} — ${blurb}` : `${item.listLabel}.`;
    });
    likelyNote = `Likely in scope: ${details.join(" ")}`;
  }

  let maybeNote: string | null = null;
  if (maybe.length) {
    const names = formatLawList(maybe.map(({ item }) => item.listLabel));
    maybeNote = `Maybe in scope (${names}): these instruments matched your product in the law scan, but one or more scope dimensions — material, territorial, temporal, or exclusions — could not be confirmed. Expand each card below for the legal tests, facts used, and missing information.`;
  }

  let unlikelyNote: string | null = null;
  if (unlikely.length) {
    const names = formatLawList(unlikely.map(({ item }) => item.listLabel));
    const context = signalContext(signals);
    unlikelyNote = `Not likely in scope (${names}): these instruments were shortlisted because they are semantically related to your product, but the per-law scope assessment did not confirm applicability. ${context || "This often reflects territorial, material, or product-type gates that are not satisfied on the facts provided."} Open individual cards for instrument-specific reasoning.`;
  }

  const statsLine = `${total} laws selected: ${likely.length} likely in scope, ${maybe.length} maybe in scope, ${unlikely.length} not likely.`;
  const parts = [lead, overview, likelyNote, maybeNote, unlikelyNote, statsLine].filter(Boolean);
  return { text: parts.join(" ") };
}

export function defaultFocusedRowCode(items: ScannedLawItem[]): string | null {
  const selected = items.filter((i) => i.selected);
  const assessment = selected.find((i) => i.status === "assessment_required");
  if (assessment) return assessment.rowCode;
  const confirmed = selected.find((i) => i.status === "confirmed");
  if (confirmed) return confirmed.rowCode;
  const potential = selected.find((i) => i.status === "potential");
  if (potential) return potential.rowCode;
  return items[0]?.rowCode ?? null;
}

export const STATUS_SYMBOL: Record<LawScanStatus, string> = {
  confirmed: "✓",
  assessment_required: "◇",
  potential: "△",
  excluded: "×",
};

export const STATUS_LABEL: Record<LawScanStatus, string> = {
  confirmed: "In scope on assessed facts",
  assessment_required: "Scope assessment required",
  potential: "Scan relevance — scope pending",
  excluded: "Excluded",
};
