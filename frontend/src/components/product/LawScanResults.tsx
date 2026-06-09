import { useEffect, useState } from "react";
import type { LawScanResponse, LawScanResult } from "../../lib/api";
import { lawNameFromScanRow } from "../../lib/lawDisplayName";
import { WorkflowSplitLayout } from "./WorkflowSplitLayout";
import { LawScanLawDetail } from "./LawScanLawDetail";
import { LawScanPanel } from "./LawScanPanel";

interface Props {
  scanResponse: LawScanResponse | null;
  results: LawScanResult[];
  allResults?: LawScanResult[] | null;
  loadingAll?: boolean;
  onLoadAll?: () => void;
  selectedCodes: string[];
  onToggleLaw?: (code: string) => void;
  loading?: boolean;
  onCheckApplicability: () => void;
  onBack?: () => void;
  /** When true, renders only the left panel (for external split layouts). */
  panelOnly?: boolean;
  /** When true, renders only the right detail pane. */
  detailOnly?: boolean;
  focusedCode?: string | null;
  onFocusCode?: (code: string) => void;
  showAll?: boolean;
  onToggleShowAll?: () => void;
}

export function LawScanEmpty({
  scanResponse,
  onBack,
}: {
  scanResponse: LawScanResponse | null;
  onBack?: () => void;
}) {
  const minPct = Math.round((scanResponse?.min_score ?? 0.75) * 100);
  return (
    <div className="ct-product-column ct-intake-panel">
      <div className="ct-intake-three-boxes">
        <section className="ct-intake-box">
          <header className="ct-intake-box-head">
            <h2 className="ct-intake-box-title">Relevant laws</h2>
          </header>
          <p className="ct-intake-guided-hint">
            No regulations at or above {minPct}% relevance. Add EU markets, describe what personal
            data flows through the product, and where AI is used — then try again.
          </p>
        </section>
      </div>
      {onBack ? (
        <footer className="ct-intake-sheet-footer ct-intake-sheet-footer--sticky">
          <button type="button" className="ct-intake-link-btn" onClick={onBack}>
            Edit intake
          </button>
          <span />
        </footer>
      ) : null}
    </div>
  );
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
  panelOnly = false,
  detailOnly = false,
  focusedCode: focusedCodeProp,
  onFocusCode,
  showAll: showAllProp,
  onToggleShowAll,
}: Props) {
  const [showAllInline, setShowAllInline] = useState(false);
  const [focusedCodeInternal, setFocusedCodeInternal] = useState<string | null>(
    results[0]?.code ?? null,
  );

  const showAll = showAllProp ?? showAllInline;
  const setShowAll = onToggleShowAll ?? (() => setShowAllInline((v) => !v));
  const focusedCode = focusedCodeProp ?? focusedCodeInternal;
  const setFocusedCode = onFocusCode ?? setFocusedCodeInternal;

  const displayRows = showAll && allResults ? allResults : results;

  useEffect(() => {
    if (!displayRows.length) {
      setFocusedCodeInternal(null);
      return;
    }
    if (focusedCodeProp === undefined) {
      setFocusedCodeInternal((prev) =>
        prev && displayRows.some((r) => r.code === prev) ? prev : displayRows[0].code,
      );
    }
  }, [displayRows, focusedCodeProp]);

  if (loading && !results.length) {
    return null;
  }

  if (!results.length && !loading) {
    return <LawScanEmpty scanResponse={scanResponse} onBack={onBack} />;
  }

  const canCheck = selectedCodes.length > 0 && !loading;
  const total =
    scanResponse?.total_match_count ?? scanResponse?.match_count ?? results.length;
  const canExpand = Boolean(
    onLoadAll &&
      (total > results.length || (allResults != null && allResults.length > results.length)),
  );

  const focusedRow = displayRows.find((r) => r.code === focusedCode) ?? displayRows[0] ?? null;
  const resultsTitle = focusedRow ? lawNameFromScanRow(focusedRow) : "Regulation detail";

  const panel = (
    <LawScanPanel
      results={results}
      allResults={allResults}
      showAll={showAll}
      totalMatches={total}
      loadingAll={loadingAll}
      canExpand={canExpand}
      focusedCode={focusedCode}
      selectedCodes={selectedCodes}
      canContinue={canCheck}
      onFocus={setFocusedCode}
      onToggleShowAll={setShowAll}
      onLoadAll={() => {
        onLoadAll?.();
        if (!onToggleShowAll) setShowAllInline(true);
      }}
      onCheckApplicability={onCheckApplicability}
      onBack={onBack}
    />
  );

  const detail = (
    <div className="ct-workflow-results-stack">
      <LawScanLawDetail
        row={focusedRow}
        scanResponse={scanResponse}
        shownCount={displayRows.length}
      />
    </div>
  );

  if (panelOnly) return panel;
  if (detailOnly) return detail;

  return (
    <WorkflowSplitLayout
      stepLabel=""
      title=""
      intro=""
      actionsTitle=""
      resultsTitle={resultsTitle}
      actionsAriaLabel="Relevant laws"
      resultsAriaLabel="Regulation detail"
      actions={panel}
      results={detail}
    />
  );
}
