import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { ScopeDimensionId } from "../../lib/scopeLegalBasis";
import { ApplicabilityLawAccordion } from "./ApplicabilityLawAccordion";
import { ScopeLawSidebar } from "./ScopeLawSidebar";
import { ScopeLegalBasisInspector } from "./ScopeLegalBasisInspector";
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

function scrollToDimension(dimensionId: ScopeDimensionId) {
  const el = document.getElementById(`ct-scope-dim-${dimensionId}`);
  el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedProvisionId, setSelectedProvisionId] = useState<string | null>(null);

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

  useEffect(() => {
    setInspectorOpen(false);
    setSelectedProvisionId(null);
  }, [focusedCode]);

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

  const focusedRegKey =
    focusedInstrument?.reg_key ||
    focusedItem?.scanRow?.catalog_code ||
    focusedItem?.scanRow?.code ||
    focusedItem?.rowCode ||
    "";

  const handleCitationSelect = useCallback((provisionId: string) => {
    setSelectedProvisionId(provisionId);
    setInspectorOpen(true);
  }, []);

  const handleViewLegalBasis = useCallback(() => {
    setInspectorOpen(true);
  }, []);

  const lawAccordion = focusedItem ? (
    <ApplicabilityLawAccordion
      key={focusedItem.rowCode}
      item={focusedItem}
      instrument={focusedInstrument}
      openQuestions={openQuestions}
      collapsible={false}
      defaultOpen
      onCitationSelect={handleCitationSelect}
      onViewLegalBasis={handleViewLegalBasis}
    />
  ) : (
    <p className="ct-muted">No applicability assessment available.</p>
  );

  const resultsBody = (
    <div
      className={`ct-scope-results-split${inspectorOpen ? " ct-scope-results-split--open" : ""}`}
    >
      <div className="ct-scope-results-main">{lawAccordion}</div>
      {inspectorOpen && focusedItem ? (
        <ScopeLegalBasisInspector
          lawTitle={lawNameFromScannedItem(focusedItem)}
          instrument={focusedInstrument}
          regKey={focusedRegKey}
          selectedProvisionId={selectedProvisionId}
          onSelectProvision={setSelectedProvisionId}
          onDimensionClick={scrollToDimension}
          onClose={() => setInspectorOpen(false)}
        />
      ) : null}
    </div>
  );

  if (embedded) {
    return (
      <section className="ct-scope-detail-box" aria-label="Applicability">
        {resultsBody}
      </section>
    );
  }

  const resultsTitle = focusedItem ? lawNameFromScannedItem(focusedItem) : "Applicability";

  return (
    <WorkflowSplitLayout
      stepLabel="Step 3"
      title="Applicability"
      intro="Select a law on the left to read its applicability assessment on the right."
      actionsTitle="Selected laws"
      resultsTitle={resultsTitle}
      actionsAriaLabel="Law selection"
      resultsAriaLabel="Applicability"
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
            resultsBody
          ) : (
            <p className="ct-workflow-results-empty">
              Select a law on the left to view its applicability assessment.
            </p>
          )}
        </div>
      }
    />
  );
}
