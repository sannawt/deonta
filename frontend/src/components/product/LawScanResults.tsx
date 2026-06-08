import { useState } from "react";
import type { LawScanResponse } from "../../lib/api";
import type { LawScanResult } from "../../lib/api";
import {
  formatLawScanRow,
  keywordColorClass,
  lawScanKeywords,
} from "../../lib/utils";

interface Props {
  scanResponse: LawScanResponse | null;
  results: LawScanResult[];
  allResults?: LawScanResult[] | null;
  loadingAll?: boolean;
  onLoadAll?: () => void;
  selectedCodes: string[];
  loading?: boolean;
  includeSecondary?: boolean;
  onIncludeSecondaryChange?: (include: boolean) => void;
  onToggle: (code: string) => void;
  onCheckApplicability: () => void;
  onBack: () => void;
}

function KeywordPills({ keywords }: { keywords: string[] }) {
  if (!keywords.length) {
    return <span className="ct-muted">—</span>;
  }
  return (
    <div className="ct-law-scan-keywords">
      {keywords.map((kw) => (
        <span key={kw} className={`ct-law-scan-keyword ${keywordColorClass(kw)}`}>
          {kw}
        </span>
      ))}
    </div>
  );
}

function LawScanTable({
  rows,
  selectedCodes,
  onToggle,
}: {
  rows: LawScanResult[];
  selectedCodes: string[];
  onToggle: (code: string) => void;
}) {
  return (
    <table className="ct-table ct-law-scan-table">
      <thead>
        <tr>
          <th className="ct-law-scan-check" aria-label="Select" />
          <th>Document title</th>
          <th>Keywords</th>
          <th>Relevance score</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const formatted = formatLawScanRow(row);
          const keywords = lawScanKeywords(row);
          const selected = selectedCodes.includes(row.code);
          return (
            <tr key={row.code}>
              <td className="ct-law-scan-check">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggle(row.code)}
                  aria-label={`Select ${formatted.documentTitle}`}
                />
              </td>
              <td className="ct-law-scan-doc-title">{formatted.documentTitle}</td>
              <td className="ct-law-scan-keywords-cell">
                <KeywordPills keywords={keywords} />
              </td>
              <td className="ct-law-scan-score-cell">
                <span className="ct-law-scan-score" title={formatted.scoreLabel}>
                  <span
                    className="ct-law-scan-bar"
                    style={{ width: formatted.scoreWidth }}
                  />
                  {formatted.scoreLabel}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function AllResultsPanel({
  scanResponse,
  results,
  loadingAll,
  onLoadAll,
}: {
  scanResponse: LawScanResponse | null;
  results: LawScanResult[];
  loadingAll?: boolean;
  onLoadAll?: () => void;
}) {
  const total =
    scanResponse?.total_match_count ??
    scanResponse?.match_count ??
    results.length;
  const shown = results.length;
  const hasMore = total > shown;

  if (!hasMore && !results.length) return null;

  return (
    <details className="ct-law-scan-raw">
      <summary className="ct-law-scan-raw-toggle">
        {hasMore
          ? `All matches (${total} documents ≥${Math.round((scanResponse?.min_score ?? 0.75) * 100)}%)`
          : `All matches (${shown})`}
      </summary>
      <div className="ct-law-scan-raw-body">
        {hasMore && onLoadAll && results.length < total ? (
          <button
            type="button"
            className="ct-btn-outline ct-law-scan-load-all"
            disabled={loadingAll}
            onClick={onLoadAll}
          >
            {loadingAll ? "Loading all matches…" : `Load all ${total} matches`}
          </button>
        ) : null}
        {results.length > shown ? (
          <table className="ct-table ct-law-scan-raw-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Document title</th>
                <th>Keywords</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row, index) => (
                <tr key={row.code}>
                  <td>{index + 1}</td>
                  <td className="ct-law-scan-raw-title">
                    {row.summary || row.label || "—"}
                  </td>
                  <td>
                    <KeywordPills keywords={lawScanKeywords(row)} />
                  </td>
                  <td className="ct-law-scan-raw-score">
                    {Math.round(row.score * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </details>
  );
}

function ScanSummary({
  scanResponse,
  resultCount,
  includeSecondary,
}: {
  scanResponse: LawScanResponse | null;
  resultCount: number;
  includeSecondary?: boolean;
}) {
  if (!scanResponse) return null;
  const minPct = Math.round((scanResponse.min_score ?? 0.75) * 100);
  const total = scanResponse.total_match_count ?? scanResponse.match_count ?? resultCount;
  const parts = [
    `Top ${resultCount} of ${total} document${total === 1 ? "" : "s"} ≥${minPct}% relevance`,
  ];
  if (!includeSecondary && scanResponse.include_secondary !== true) {
    parts.push("primary legislation only");
  }
  return <p className="ct-law-scan-summary-line ct-muted">{parts.join(" · ")}</p>;
}

export function LawScanResults({
  scanResponse,
  results,
  allResults = null,
  loadingAll = false,
  onLoadAll,
  selectedCodes,
  loading,
  includeSecondary = false,
  onIncludeSecondaryChange,
  onToggle,
  onCheckApplicability,
  onBack,
}: Props) {
  const [showAllInline, setShowAllInline] = useState(false);

  if (loading && !results.length) {
    return null;
  }

  if (!results.length && !loading) {
    const minPct = Math.round((scanResponse?.min_score ?? 0.75) * 100);
    return (
      <>
        <p className="ct-muted">
          No regulations at or above {minPct}% relevance. Try a longer product description.
        </p>
        <ScanSummary scanResponse={scanResponse} resultCount={0} includeSecondary={includeSecondary} />
        <div className="ct-scanner-actions">
          <button type="button" className="ct-btn-outline ct-scanner-action-btn" onClick={onBack}>
            Go back
          </button>
        </div>
      </>
    );
  }

  const canCheck = selectedCodes.length > 0 && !loading;
  const total =
    scanResponse?.total_match_count ??
    scanResponse?.match_count ??
    results.length;
  const displayRows = showAllInline && allResults ? allResults : results;
  const canExpand =
    (total > results.length || (allResults && allResults.length > results.length)) &&
    Boolean(onLoadAll);

  return (
    <div className="ct-law-scan">
      <section className="ct-law-scan-user">
        <h2 className="ct-law-scan-section-title">Suggested laws</h2>
        <ScanSummary
          scanResponse={scanResponse}
          resultCount={displayRows.length}
          includeSecondary={includeSecondary}
        />
        {onIncludeSecondaryChange ? (
          <label className="ct-law-scan-filter ct-muted">
            <input
              type="checkbox"
              checked={includeSecondary}
              onChange={(e) => onIncludeSecondaryChange(e.target.checked)}
            />
            Include implementing acts, delegated acts, and EU body internal rules
          </label>
        ) : null}
        <LawScanTable rows={displayRows} selectedCodes={selectedCodes} onToggle={onToggle} />
        {canExpand ? (
          <div className="ct-law-scan-expand-row">
            {!allResults ? (
              <button
                type="button"
                className="ct-btn-outline ct-law-scan-expand-btn"
                disabled={loadingAll}
                onClick={() => {
                  onLoadAll?.();
                  setShowAllInline(true);
                }}
              >
                {loadingAll ? "Loading all matches…" : `Show all ${total} matches`}
              </button>
            ) : (
              <button
                type="button"
                className="ct-btn-outline ct-law-scan-expand-btn"
                onClick={() => setShowAllInline((v) => !v)}
              >
                {showAllInline ? `Show top ${results.length} only` : `Show all ${allResults.length} matches`}
              </button>
            )}
          </div>
        ) : null}
      </section>

      {allResults && allResults.length > results.length ? (
        <AllResultsPanel
          scanResponse={scanResponse}
          results={allResults}
          loadingAll={loadingAll}
          onLoadAll={onLoadAll}
        />
      ) : null}

      <div className="ct-scanner-actions">
        <button
          type="button"
          className="ct-btn-primary ct-scanner-action-btn"
          disabled={!canCheck}
          onClick={onCheckApplicability}
        >
          Check applicability
        </button>
        <button
          type="button"
          className="ct-btn-outline ct-scanner-action-btn"
          disabled={loading}
          onClick={onBack}
        >
          Go back
        </button>
      </div>
    </div>
  );
}
