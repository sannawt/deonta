import type { LawScanResult, ProductKgResponse } from "./api";
import type { ProductSpec } from "./productStore";
import type { ScopeChatLawBlock } from "./scopeChatNarrative";
import type { ScopeInstrument } from "../types/chat";

export const PRIMARY_LAW_COUNT = 3;
export const MIN_INTAKE_LENGTH = 12;
/** Hourglass pause between sequential chat slides and workflow steps. */
export const SLIDE_TRANSITION_MS = 3_000;

export function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitBetweenSlides(onWaiting?: () => void): Promise<void> {
  onWaiting?.();
  await pause(SLIDE_TRANSITION_MS);
}

export function specFromParse(
  spec: ProductKgResponse["spec"],
  description: string,
): ProductSpec {
  return {
    name: spec.name || "",
    summary: spec.summary || description,
    markets: spec.markets || [],
    processesPersonalData:
      (spec.processesPersonalData as ProductSpec["processesPersonalData"]) || "unknown",
    euLink: (spec.euLink as ProductSpec["euLink"]) || "unknown",
    aiSystem: (spec.aiSystem as ProductSpec["aiSystem"]) || "unknown",
    selectedLaws: [],
  };
}

export function shortProductAck(spec: ProductSpec): string {
  const name = spec.name?.trim() || "your product";
  const raw = (spec.summary || "").trim();
  if (!raw) {
    return `Thanks — I've recorded ${name}.`;
  }
  const sentence = raw.split(/(?<=[.!?])\s+/)[0] || raw;
  const gist = sentence.length > 140 ? `${sentence.slice(0, 137)}…` : sentence;
  return `Thanks — I've recorded ${name}. ${gist}`;
}

export function lawScanIntro(laws: LawScanResult[]): string {
  const top = laws.slice(0, PRIMARY_LAW_COUNT);
  const names = top.map((l) => l.short || l.ui_label || l.label || l.code).join(", ");
  return `Next I'll review scope for ${names}.`;
}

export function instrumentForLaw(
  instruments: ScopeInstrument[],
  lawTitle: string,
): ScopeInstrument | undefined {
  const norm = lawTitle.toLowerCase();
  return instruments.find((inst) => {
    const candidates = [inst.full_name, inst.label, inst.id]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase());
    return candidates.some((c) => norm.includes(c) || c.includes(norm.split("—")[0].trim()));
  });
}

export function lawBlockForInstrument(
  lawBlocks: ScopeChatLawBlock[],
  instrument: ScopeInstrument | undefined,
  code: string,
): ScopeChatLawBlock | undefined {
  if (!instrument) {
    return lawBlocks.find((b) => b.lawTitle.toLowerCase().includes(code.replace(/_/g, " ")));
  }
  const titleParts = [instrument.full_name, instrument.label, code]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());
  return lawBlocks.find((b) => {
    const t = b.lawTitle.toLowerCase();
    return titleParts.some((p) => t.includes(p) || p.includes(t.split("—")[0].trim()));
  });
}
