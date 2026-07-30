import type { LawScanResult } from "./api";
import type { ScannedLawItem } from "./applicabilityScan";
import { lawSummaryForCode } from "./lawSummaries";

const CATALOG_SHORT: Record<string, string> = {
  gdpr: "GDPR",
  ai_act: "EU AI Act",
  cra: "CRA",
  dora: "DORA",
  nis2: "NIS2",
  data_act: "EU Data Act",
  eprivacy: "ePrivacy",
  gpsr: "GPSR",
  dma: "DMA",
  dsa: "DSA",
  red: "RED",
  eecc: "EECC",
  rohs: "RoHS",
  weee: "WEEE",
  reach: "REACH",
  product_liability: "PLD",
  market_surveillance: "MSR",
};

function normalizeCode(code: string): string {
  return code.toLowerCase().replace(/-/g, "_").trim();
}

/** Unified list label: ePrivacy, Regulation (EU) 2002/58/EC */
export function formatLawListName(input: {
  code?: string;
  short?: string;
  label?: string;
  number?: string;
  legal_instrument?: string;
}): string {
  const code = normalizeCode(input.code || "");
  const catalog = code ? lawSummaryForCode(code) : null;

  const short =
    input.short?.trim() ||
    input.label?.trim() ||
    (code ? CATALOG_SHORT[code] : "") ||
    catalog?.title?.replace(/\s*\(.+\)\s*$/, "").trim() ||
    "";

  const number = (input.number || catalog?.number || "").trim();
  if (short && number) {
    return `${short}, Regulation (EU) ${number}`;
  }

  const instrument = input.legal_instrument?.trim();
  if (instrument && /,\s*Regulation\s*\(EU\)/i.test(instrument)) {
    return instrument;
  }
  if (short) return short;
  return instrument || code || "—";
}

export function lawNameFromScanRow(row: LawScanResult): string {
  return formatLawListName({
    code: row.catalog_code || row.code,
    short: row.short,
    label: row.label,
    number: row.number,
    legal_instrument: row.legal_instrument,
  });
}

export function lawNameFromScannedItem(item: ScannedLawItem): string {
  if (item.scanRow) return lawNameFromScanRow(item.scanRow);
  return formatLawListName({
    code: item.rowCode,
    short: item.listLabel,
    label: item.fullLabel,
  });
}

export function lawNameFromSymbolicLaw(law: {
  code: string;
  short?: string;
  label?: string;
  number?: string;
}): string {
  return formatLawListName({
    code: law.code,
    short: law.short,
    label: law.label,
    number: law.number,
  });
}
