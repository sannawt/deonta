import { useEffect, useState } from "react";
import type { LawScanResponse } from "../../lib/api";
import type { LawScanResult } from "../../lib/api";
import { WorkflowSplitLayout } from "./WorkflowSplitLayout";
import { LawScanLawDetail } from "./LawScanLawDetail";
import { LawScanLawSidebar } from "./LawScanLawSidebar";

interface Props {
  scanResponse: LawScanResponse | null;
  results: LawScanResult[];
  allResults?: LawScanResult[] | null;
  loadingAll?: boolean;
  onLoadAll?: () => void;
  selectedCodes: string[];
  loading?: boolean;
  onCheckApplicability: () => void;
  onBack?: () => void;
}

export function LawScanResults({
  scanResponse,
  results,
  allResults = null,
  loadingAll = false,
  onLoadAll,
  selectedCodes,
  loading,
  onCheckApplicability,
  onBack,
}: Props) {
  const [showAllInline, setShowAllInline] = useState(false);
  const [focusedCode, setFocusedCode] = useState<string | null>(results[0]?.code ?? null);

  const displayRows = showAllInline && allResults ? allResults : results;

  useEffect(() => {
    if (!displayRows.length) {
      setFocusedCode(null);
      return;
    }
    if (!focusedCode || !displayRows.some((r) => r.code === focusedCode)) {
      setFocusedCode(displayRows[0].code);
    }
  }, [displayRows, focusedCode]);

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
        {onBack ? (
          <div className="ct-scanner-actions">
            <button type="button" className="ct-btn-outline ct-scanner-action-btn" onClick={onBack}>
              Go back
            </button>
          </div>
        ) : null}
      </>
    );
  }

  const canCheck = selectedCodes.length > 0 && !loading;
  const total =
    scanResponse?.total_match_count ??
    scanResponse?.match_count ??
    results.length;
  const canExpand =
    (total > results.length || (allResults && allResults.length > results.length)) &&
    Boolean(onLoadAll);

  const focusedRow = displayRows.find((r) => r.code === focusedCode) ?? displayRows[0] ?? null;

  return (
    <WorkflowSplitLayout
      stepLabel="Step 2"
      intro="Regulations ranked by relevance. Choose a law on the left to view search results on the right."
      icon="scale"
      actionsAriaLabel="Law selection"
      resultsAriaLabel="Search results dashboard"
      actions={
        <div className="ct-workflow-actions-stack">
          <LawScanLawSidebar
            rows={displayRows}
            focusedCode={focusedCode}
            onFocus={setFocusedCode}
          />
          <div className="ct-workflow-actions-footer">
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
                    {showAllInline
                      ? `Show top ${results.length} only`
                      : `Show all ${allResults.length} matches`}
                  </button>
                )}
              </div>
            ) : null}
            <button
              type="button"
              className="ct-btn-primary ct-scanner-action-btn"
              disabled={!canCheck}
              onClick={onCheckApplicability}
            >
              Check applicability
            </button>
            {onBack ? (
              <button
                type="button"
                className="ct-btn-outline ct-scanner-action-btn"
                disabled={loading}
                onClick={onBack}
              >
                Go back
              </button>
            ) : null}
          </div>
        </div>
      }
      results={
        <LawScanLawDetail
          row={focusedRow}
          scanResponse={scanResponse}
          shownCount={displayRows.length}
        />
      }
    />
  );
}
