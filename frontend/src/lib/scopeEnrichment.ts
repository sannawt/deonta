/**
 * Attach provisions, citations, and compact summaries to scope dimensions.
 */

import { externalSourcesForLawDim } from "./externalLegalSources";
import { productScopeAssessment } from "./scopeProductAssessment";
import {
  citationsFromRules,
  mergeRules,
  provisionsForDimension,
} from "./scopeProvisionCatalog";
import { compactDimensionSummary } from "./scopeDimensionSummary";
import { humanizeFactText, isTechnicalAtom } from "./plainLanguage";
import type { ProductSpec } from "./productStore";
import type { ScopeDecisiveFact, ScopeDimension, ScopeInstrument } from "../types/chat";

function normCode(code: string): string {
  const c = code.toLowerCase().replace(/-/g, "_");
  return c === "eu_ai_act" ? "ai_act" : c;
}

function supportingFacts(dim: ScopeDimension): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const fact of dim.decisive_facts ?? []) {
    if (fact.kind === "missing" || fact.kind === "gap" || fact.kind === "trace_gap") continue;
    const raw = fact.note || fact.label || fact.atom || "";
    const text = humanizeFactText(raw);
    if (!text || isTechnicalAtom(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function filterDecisiveFacts(facts: ScopeDecisiveFact[]): ScopeDecisiveFact[] {
  return facts.filter((fact) => {
    const raw = `${fact.atom || ""} ${fact.label || ""} ${fact.note || ""}`;
    if (/predicate used by improved recital/i.test(raw)) return false;
    if (isTechnicalAtom(fact.label || fact.atom || "")) {
      return Boolean(fact.note && fact.note.length > 40 && !isTechnicalAtom(fact.note));
    }
    return true;
  });
}

export function enrichScopeDimension(
  dim: ScopeDimension,
  regKey: string,
): ScopeDimension {
  const code = normCode(regKey);
  const dimId = dim.id.toLowerCase();
  const provSet = provisionsForDimension(code, dimId);
  const rules_invoked = mergeRules(dim.rules_invoked, provSet);
  const citations = [...(dim.citations ?? [])];
  const citeKeys = new Set(citations.map((c) => c.provision_long_id || c.label));
  for (const c of citationsFromRules(rules_invoked)) {
    const key = c.provision_long_id || c.label;
    if (key && !citeKeys.has(key)) {
      citeKeys.add(key);
      citations.push(c);
    }
  }

  const dimWithRules: ScopeDimension = { ...dim, rules_invoked, citations };
  const external_sources = externalSourcesForLawDim(code, dimId).map((s) => ({
    label: s.label,
    url: s.url,
  }));

  return {
    ...dimWithRules,
    decisive_facts: filterDecisiveFacts(dim.decisive_facts ?? []),
    external_sources: external_sources.length ? external_sources : dim.external_sources,
    llm: {
      ...dim.llm,
      interpretation: compactDimensionSummary(dimWithRules, regKey),
      why_result: undefined,
      key_facts: supportingFacts(dimWithRules),
    },
  };
}

export function enrichScopeInstrument(
  instrument: ScopeInstrument,
  _spec?: ProductSpec,
): ScopeInstrument {
  const regKey = instrument.reg_key || instrument.id || "";
  const dimensions = (instrument.dimensions ?? []).map((d) =>
    enrichScopeDimension(d, regKey),
  );

  const assessment = productScopeAssessment(
    { ...instrument, dimensions },
    regKey,
  );

  return {
    ...instrument,
    dimensions,
    llm_summary: assessment,
    headline: assessment || instrument.headline,
    missing_facts: [],
    missing_atoms: [],
  };
}

export function enrichScopeInstruments(
  instruments: ScopeInstrument[],
  spec?: ProductSpec,
): ScopeInstrument[] {
  return instruments.map((inst) => enrichScopeInstrument(inst, spec));
}
