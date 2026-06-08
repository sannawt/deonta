import type { LawScanResult } from "../../lib/api";
import { lawNameFromScanRow } from "../../lib/lawDisplayName";

interface Props {
  rows: LawScanResult[];
  focusedCode: string | null;
  onFocus: (code: string) => void;
}

function scoreTone(score: number): "high" | "mid" | "low" {
  if (score >= 0.9) return "high";
  if (score >= 0.8) return "mid";
  return "low";
}

export function LawScanLawSidebar({ rows, focusedCode, onFocus }: Props) {
  if (!rows.length) {
    return (
      <nav className="ct-law-scan-sidebar" aria-label="Matched regulations">
        <p className="ct-workflow-actions-empty">No regulations matched.</p>
      </nav>
    );
  }

  return (
    <nav className="ct-law-scan-sidebar" aria-label="Matched regulations">
      <ul className="ct-law-scan-sidebar-list">
        {rows.map((row) => {
          const active = row.code === focusedCode;
          const scorePct = Math.round(Math.max(0, Math.min(1, row.score)) * 100);
          const tone = scoreTone(row.score);
          return (
            <li key={row.code}>
              <button
                type="button"
                className={`ct-law-scan-sidebar-item ct-law-scan-sidebar-btn${active ? " ct-law-scan-sidebar-item--active" : ""}`}
                aria-current={active ? "true" : undefined}
                onClick={() => onFocus(row.code)}
              >
                <span className="ct-law-scan-sidebar-label">{lawNameFromScanRow(row)}</span>
                <span className={`ct-law-list-tag ct-law-list-tag--score-${tone}`}>
                  {scorePct}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
