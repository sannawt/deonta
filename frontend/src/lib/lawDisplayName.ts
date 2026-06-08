import type { LawScanResult } from "./api";
import type { ScannedLawItem } from "./applicabilityScan";

/** Full legal instrument name, e.g. General Data Protection Regulation */
export function lawNameFromScanRow(row: LawScanResult): string {
  return (
    row.legal_instrument?.trim() ||
    row.label?.trim() ||
    row.summary?.trim() ||
    row.ui_label?.trim() ||
    row.short?.trim() ||
    row.code
  );
}

export function lawNameFromScannedItem(item: ScannedLawItem): string {
  if (item.scanRow) return lawNameFromScanRow(item.scanRow);
  return item.fullLabel?.trim() || item.listLabel?.trim() || item.rowCode;
}
