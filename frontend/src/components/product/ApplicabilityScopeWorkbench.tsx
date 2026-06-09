import { useEffect, useMemo, useState } from "react";
import type { LawScanResult } from "../../lib/api";
import type { ClarifyingQuestion, ScopeInstrument } from "../../types/chat";
import type { LawApplicabilityRow } from "../../lib/applicabilityVerdict";
import {
  buildScannedLawList,
  defaultFocusedRowCode,
  instrumentMatchesCode,
  type ProductScopeSignals,
} from "../../lib/applicabilityScan";
import { lawNameFromScannedItem } from "../../lib/lawDisplayName";
import { ApplicabilityLawAccordion } from "./ApplicabilityLawAccordion";
import { ScopeLawSidebar } from "./ScopeLawSidebar";
import { WorkflowSplitLayout } from "./WorkflowSplitLayout";

interface Props {
  productTitle: string;
  productSummary: string;
  scanResults: LawScanResult[];
  selectedCodes: string[];
  tierRows: LawApplicabilityRow[];
  instruments: ScopeInstrument[];
  openQuestions?: ClarifyingQuestion[];
  scenarioGist?: string;
  narrativeVerdictLine?: string;
  productSignals?: ProductScopeSignals;
  loading?: boolean;
  playbookCompanyId?: string;
  sessionId?: string;
  embedded?: boolean;
}

export function ApplicabilityScopeWorkbench({
  scanResults,
  selectedCodes,
  tierRows,
  instruments,
  openQuestions = [],
  embedded = false,
}: Props) {
  const lawItems = useMemo(
    () =>
      buildScannedLawList({
        scanResults,
        selectedCodes,
        tierRows,
        instruments,
      }),
    [scanResults, selectedCodes, tierRows, instruments],
  );

  const selectedItems = lawItems.filter((i) => i.selected);
  const [focusedCode, setFocusedCode] = useState<string | null>(() =>
    defaultFocusedRowCode(selectedItems.length ? selectedItems : lawItems),
  );

  useEffect(() => {
    const pool = selectedItems.length ? selectedItems : lawItems;
    if (!pool.length) {
      setFocusedCode(null);
      return;
    }
    if (!focusedCode || !pool.some((i) => i.rowCode === focusedCode)) {
      setFocusedCode(defaultFocusedRowCode(pool));
    }
  }, [selectedItems, lawItems, focusedCode]);

  const focusedItem =
    selectedItems.find((i) => i.rowCode === focusedCode) ||
    selectedItems[0] ||
    lawItems[0];

  const focusedInstrument = focusedItem
    ? instruments.find((inst) =>
        instrumentMatchesCode(
          inst,
          focusedItem.scanRow?.catalog_code || focusedItem.scanRow?.code || focusedItem.rowCode,
        ),
      )
    : undefined;

  if (embedded) {
    return (
      <section className="ct-scope-detail-box" aria-label="Scope analysis">
        {focusedItem ? (
          <ApplicabilityLawAccordion
            key={focusedItem.rowCode}
            item={focusedItem}
            instrument={focusedInstrument}
            openQuestions={openQuestions}
            collapsible={false}
            defaultOpen
          />
        ) : (
          <p className="ct-muted">No scope analysis available.</p>
        )}
      </section>
    );
  }

  const resultsTitle = focusedItem
    ? lawNameFromScannedItem(focusedItem)
    : "Scope analysis";

  return (
    <WorkflowSplitLayout
      stepLabel="Step 3"
      title="Scope analysis"
      intro="Select a law on the left to read its applicability assessment on the right."
      actionsTitle="Selected laws"
      resultsTitle={resultsTitle}
      actionsAriaLabel="Law selection"
      resultsAriaLabel="Scope analysis"
      actions={
        <div className="ct-workflow-actions-stack">
          <ScopeLawSidebar
            items={selectedItems}
            focusedCode={focusedCode}
            onSelect={setFocusedCode}
          />
        </div>
      }
      results={
        <div className="ct-workflow-results-stack">
          {selectedItems.length === 0 ? (
            <p className="ct-workflow-results-empty">
              No laws selected. Go back to Step 2 to choose instruments.
            </p>
          ) : focusedItem ? (
            <ApplicabilityLawAccordion
              key={focusedItem.rowCode}
              item={focusedItem}
              instrument={focusedInstrument}
              openQuestions={openQuestions}
              collapsible={false}
              defaultOpen
            />
          ) : (
            <p className="ct-workflow-results-empty">
              Select a law on the left to view scope analysis.
            </p>
          )}
        </div>
      }
    />
  );
}
