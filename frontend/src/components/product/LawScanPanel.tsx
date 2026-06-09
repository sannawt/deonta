import type { LawScanResult } from "../../lib/api";
import { lawNameFromScanRow } from "../../lib/lawDisplayName";

interface Props {
  results: LawScanResult[];
  allResults?: LawScanResult[] | null;
  showAll: boolean;
  totalMatches: number;
  loadingAll?: boolean;
  canExpand: boolean;
  focusedCode: string | null;
  selectedCodes: string[];
  canContinue: boolean;
  onFocus: (code: string) => void;
  onToggleShowAll: () => void;
  onLoadAll?: () => void;
  onCheckApplicability: () => void;
  onBack?: () => void;
}

function scoreTone(score: number): "high" | "mid" | "low" {
  if (score >= 0.9) return "high";
  if (score >= 0.8) return "mid";
  return "low";
}

export function LawScanPanel({
  results,
  allResults = null,
  showAll,
  totalMatches,
  loadingAll = false,
  canExpand,
  focusedCode,
  selectedCodes,
  canContinue,
  onFocus,
  onToggleShowAll,
  onLoadAll,
  onCheckApplicability,
  onBack,
}: Props) {
  const displayRows = showAll && allResults ? allResults : results;

  return (
    <div className="ct-product-column ct-intake-panel ct-law-scan-panel">
      <div className="ct-intake-three-boxes">
        <section className="ct-intake-box" aria-labelledby="law-scan-box-title">
          <header className="ct-intake-box-head">
            <h2 className="ct-intake-box-title" id="law-scan-box-title">
              Relevant laws
            </h2>
          </header>

          <p className="ct-intake-guided-hint">
            Matched from your intake. Click a law to see details on the right — selected laws
            are included in applicability.
          </p>

          <div className="ct-law-scan-chip-grid">
            {displayRows.map((row) => {
              const selected = selectedCodes.includes(row.code);
              const focused = row.code === focusedCode;
              const scorePct = Math.round(Math.max(0, Math.min(1, row.score)) * 100);
              const tone = scoreTone(row.score);
              return (
                <button
                  key={row.code}
                  type="button"
                  className={[
                    "ct-law-scan-chip",
                    selected ? "ct-law-scan-chip--selected" : "",
                    focused ? "ct-law-scan-chip--focused" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={selected}
                  aria-current={focused ? "true" : undefined}
                  onClick={() => onFocus(row.code)}
                >
                  <span className="ct-law-scan-chip-label">{lawNameFromScanRow(row)}</span>
                  <span className={`ct-law-scan-chip-score ct-law-scan-chip-score--${tone}`}>
                    {scorePct}%
                  </span>
                </button>
              );
            })}
          </div>

          {canExpand ? (
            <div className="ct-law-scan-expand-inline">
              {!allResults ? (
                <button
                  type="button"
                  className="ct-intake-link-btn"
                  disabled={loadingAll}
                  onClick={() => onLoadAll?.()}
                >
                  {loadingAll ? "Loading…" : `Show all ${totalMatches} matches`}
                </button>
              ) : (
                <button type="button" className="ct-intake-link-btn" onClick={onToggleShowAll}>
                  {showAll
                    ? `Show top ${results.length} only`
                    : `Show all ${allResults.length} matches`}
                </button>
              )}
            </div>
          ) : null}
        </section>
      </div>

      <footer className="ct-intake-sheet-footer ct-intake-sheet-footer--sticky">
        {onBack ? (
          <button type="button" className="ct-intake-link-btn" onClick={onBack}>
            Edit intake
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="ct-intake-next-btn"
          disabled={!canContinue}
          onClick={onCheckApplicability}
        >
          Check applicability
        </button>
      </footer>
    </div>
  );
}
