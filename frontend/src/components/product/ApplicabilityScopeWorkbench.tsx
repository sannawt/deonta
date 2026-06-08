import { useMemo, useState } from "react";
import type { LawScanResult } from "../../lib/api";
import type { ClarifyingQuestion, ScopeInstrument } from "../../types/chat";
import type { LawApplicabilityRow } from "../../lib/applicabilityVerdict";
import {
  SCOPE_GROUP_LABEL,
  SCOPE_GROUP_ORDER,
  buildScannedLawList,
  buildScopeOverallNarrative,
  defaultFocusedRowCode,
  groupLawsByScope,
  instrumentMatchesCode,
  type ProductScopeSignals,
} from "../../lib/applicabilityScan";
import { ApplicabilityLawAccordion } from "./ApplicabilityLawAccordion";
import { ScopeChatPanel } from "./ScopeChatPanel";

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
}

export function ApplicabilityScopeWorkbench({
  productTitle,
  productSummary,
  scanResults,
  selectedCodes,
  tierRows,
  instruments,
  openQuestions = [],
  scenarioGist,
  narrativeVerdictLine,
  productSignals,
  loading = false,
  playbookCompanyId,
  sessionId,
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

  const firstOpenCode =
    focusedCode ?? defaultFocusedRowCode(selectedItems.length ? selectedItems : lawItems);

  const focusedItem =
    selectedItems.find((i) => i.rowCode === firstOpenCode) ||
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

  const groupedLaws = useMemo(
    () => groupLawsByScope(selectedItems, instruments),
    [selectedItems, instruments],
  );

  const overallNarrative = useMemo(
    () =>
      buildScopeOverallNarrative({
        productSummary,
        scenarioGist,
        narrativeVerdictLine,
        grouped: groupedLaws,
        signals: productSignals,
      }),
    [
      productSummary,
      scenarioGist,
      narrativeVerdictLine,
      groupedLaws,
      productSignals,
    ],
  );

  return (
    <div className="ct-scope-workbench">
      <div className="ct-scope-workbench-main">
        <section className="ct-scope-overall-card">
          <header className="ct-scope-overall-head">
            <h2 className="ct-scope-prose ct-scope-overall-title">
              Applicability scan: {productTitle}
              {loading ? " Assessing…" : ""}
            </h2>
          </header>
          <p className="ct-scope-prose">{overallNarrative.text}</p>
        </section>

        <div className="ct-scope-law-stack" aria-label="Per-law scope analysis">
          {selectedItems.length === 0 ? (
            <p className="ct-muted">No laws selected. Go back to Step 2 to choose instruments.</p>
          ) : (
            SCOPE_GROUP_ORDER.map((group) => {
              const entries = groupedLaws[group];
              if (!entries.length) return null;
              return (
                <section
                  key={group}
                  className={`ct-scope-group ct-scope-group-${group}`}
                  aria-label={SCOPE_GROUP_LABEL[group]}
                >
                  <header className="ct-scope-group-head">
                    <h3 className="ct-scope-prose ct-scope-group-title">
                      {SCOPE_GROUP_LABEL[group]} ({entries.length} instrument
                      {entries.length === 1 ? "" : "s"})
                    </h3>
                  </header>
                  <div className="ct-scope-group-list">
                    {entries.map(({ item, instrument: inst }) => (
                      <ApplicabilityLawAccordion
                        key={item.rowCode}
                        item={item}
                        instrument={inst}
                        openQuestions={openQuestions}
                        defaultOpen={item.rowCode === firstOpenCode}
                        onFocus={() => setFocusedCode(item.rowCode)}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </div>

      <ScopeChatPanel
        productTitle={productTitle}
        productSummary={productSummary}
        focusedLawLabel={focusedItem?.listLabel}
        focusedInstrument={focusedInstrument}
        playbookCompanyId={playbookCompanyId}
        sessionId={sessionId}
        overallSummary={overallNarrative.text}
      />
    </div>
  );
}
