import type { LawScanResult } from "./api";
import type { ClarifyingQuestion, ScopeDimension, ScopeInstrument } from "../types/chat";
import type { LawApplicabilityRow } from "./applicabilityVerdict";
import {
  SCOPE_GROUP_LABEL,
  SCOPE_GROUP_ORDER,
  buildLawVerdictDetail,
  buildScannedLawList,
  buildScopeOverallNarrative,
  groupLawsByScope,
  type ProductScopeSignals,
  type ScannedLawItem,
  type ScopeGroup,
} from "./applicabilityScan";
import {
  dimensionResultPlain,
  dimensionResultSentence,
  humanizeFactText,
  humanizeMissingQuestion,
  humanizeRuleExplanation,
  isTechnicalAtom,
} from "./plainLanguage";

export interface ScopeChatParagraph {
  text: string;
}

export interface ScopeChatLawBlock {
  group: ScopeGroup;
  lawTitle: string;
  instrumentLabel: string;
  verdict: string;
  confidence: string;
  paragraphs: string[];
  dimensionNotes: string[];
  factsUsed: string[];
  missingFacts: string[];
}

export interface ScopeChatDocument {
  productTitle: string;
  intro: string;
  overview: string;
  summaryLine: string;
  lawBlocks: ScopeChatLawBlock[];
  openQuestions: string[];
}

const DIM_ORDER = ["temporal", "territorial", "material", "exclusions"];

function dimensionProse(
  dim: ScopeDimension,
  openQuestions: ClarifyingQuestion[],
): string {
  const result = dimensionResultPlain(dim.result);
  const analysis =
    dim.llm?.interpretation?.trim() ||
    dim.evidence?.trim() ||
    dimensionResultSentence(dim.label, dim.result);
  const why = dim.llm?.why_result?.trim();

  const parts = [`${dim.label}: ${result}.`];
  if (analysis) parts.push(analysis.endsWith(".") ? analysis : `${analysis}.`);
  if (why) parts.push(why.endsWith(".") ? why : `${why}.`);

  const supporting: string[] = [];
  const unclear: string[] = [];
  const seen = new Set<string>();

  const add = (list: string[], raw: string) => {
    const text = humanizeFactText(raw);
    if (!text || isTechnicalAtom(text)) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    list.push(text);
  };

  for (const fact of dim.decisive_facts ?? []) {
    const kind = fact.kind || "";
    const raw = fact.label || fact.atom || "";
    if (kind === "missing" || kind === "gap" || kind === "trace_gap") {
      add(unclear, raw);
    } else {
      add(supporting, raw);
    }
  }
  for (const f of dim.llm?.key_facts ?? []) add(supporting, f);
  for (const q of openQuestions.filter((x) => !x.dimension || x.dimension === dim.id)) {
    add(unclear, humanizeMissingQuestion(q.text || ""));
  }

  if (supporting.length) {
    parts.push(`Supporting facts: ${supporting.join("; ")}.`);
  }
  if (unclear.length) {
    parts.push(`Still unclear: ${unclear.join("; ")}.`);
  }

  const rules = (dim.rules_invoked ?? [])
    .map((r) => humanizeRuleExplanation(r.rule_text, r.head_atom))
    .filter(Boolean);
  if (rules.length) {
    parts.push(`Legal basis: ${rules.join("; ")}.`);
  }

  return parts.join(" ");
}

function lawBlockFromItem(args: {
  group: ScopeGroup;
  item: ScannedLawItem;
  instrument?: ScopeInstrument;
  openQuestions?: ClarifyingQuestion[];
}): ScopeChatLawBlock {
  const { group, item, instrument, openQuestions } = args;
  const lawCode = item.scanRow?.catalog_code || item.scanRow?.code || item.rowCode;
  const lawQuestions = (openQuestions ?? []).filter((q) => {
    const reg = (q.regulation || "").toLowerCase().replace(/-/g, "_");
    return !reg || reg === lawCode.toLowerCase().replace(/-/g, "_");
  });

  const detail = buildLawVerdictDetail({
    item,
    instrument,
    openQuestions: lawQuestions,
  });

  const instrumentTitle = instrument?.full_name?.trim();
  const lawTitle =
    instrumentTitle ||
    (item.fullLabel && item.fullLabel !== item.listLabel
      ? `${item.listLabel} — ${item.fullLabel}`
      : item.listLabel);

  const paragraphs: string[] = [];
  if (detail.summary) {
    paragraphs.push(detail.summary.endsWith(".") ? detail.summary : `${detail.summary}.`);
  } else if (instrument?.headline) {
    paragraphs.push(
      instrument.headline.endsWith(".") ? instrument.headline : `${instrument.headline}.`,
    );
  }

  if (detail.legalTests.length) {
    const tests = detail.legalTests
      .map((t) => `${t.label} — ${t.answer}`)
      .join("; ");
    paragraphs.push(`Key legal tests: ${tests}.`);
  }

  const dimensions = [...(instrument?.dimensions ?? [])].sort((a, b) => {
    const ai = DIM_ORDER.indexOf(a.id);
    const bi = DIM_ORDER.indexOf(b.id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const dimensionNotes = dimensions.map((d) => dimensionProse(d, lawQuestions));

  return {
    group,
    lawTitle,
    instrumentLabel: detail.instrumentName,
    verdict: detail.verdict,
    confidence: detail.confidence,
    paragraphs,
    dimensionNotes,
    factsUsed: detail.factsUsed,
    missingFacts: detail.missingFacts,
  };
}

export function buildScopeChatDocument(args: {
  productTitle: string;
  productSummary?: string;
  scanResults: LawScanResult[];
  selectedCodes: string[];
  tierRows: LawApplicabilityRow[];
  instruments: ScopeInstrument[];
  openQuestions?: ClarifyingQuestion[];
  scenarioGist?: string;
  narrativeVerdictLine?: string;
  productSignals?: ProductScopeSignals;
}): ScopeChatDocument {
  const lawItems = buildScannedLawList({
    scanResults: args.scanResults,
    selectedCodes: args.selectedCodes,
    tierRows: args.tierRows,
    instruments: args.instruments,
  });
  const selectedItems = lawItems.filter((i) => i.selected);
  const grouped = groupLawsByScope(selectedItems, args.instruments);

  const overall = buildScopeOverallNarrative({
    productSummary: args.productSummary,
    scenarioGist: args.scenarioGist,
    narrativeVerdictLine: args.narrativeVerdictLine,
    grouped,
    signals: args.productSignals,
  });

  const { stats } = overall;
  const summaryLine = `${stats.total} instrument${stats.total === 1 ? "" : "s"} assessed: ${stats.likely} likely in scope, ${stats.maybe} need review, ${stats.unlikely} not likely.`;

  const lawBlocks: ScopeChatLawBlock[] = [];
  for (const group of SCOPE_GROUP_ORDER) {
    for (const entry of grouped[group]) {
      lawBlocks.push(
        lawBlockFromItem({
          group,
          item: entry.item,
          instrument: entry.instrument,
          openQuestions: args.openQuestions,
        }),
      );
    }
  }

  const openQuestions = (args.openQuestions ?? [])
    .map((q) => humanizeMissingQuestion(q.text || ""))
    .filter(Boolean)
    .slice(0, 8);

  return {
    productTitle: args.productTitle,
    intro: overall.lead,
    overview: overall.overview,
    summaryLine,
    lawBlocks,
    openQuestions,
  };
}

export function groupLabel(group: ScopeGroup): string {
  return SCOPE_GROUP_LABEL[group];
}
