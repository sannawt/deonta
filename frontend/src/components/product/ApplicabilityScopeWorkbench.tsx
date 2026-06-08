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
import { PixelIcon } from "../ui/PixelIcon";
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
  embedded?: boolean;
}

const GROUP_ICON: Record<(typeof SCOPE_GROUP_ORDER)[number], string> = {
  likely: "✓",
  maybe: "◇",
  unlikely: "×",
};

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

  const { stats } = overallNarrative;

  return (
    <div className={`ct-scope-workbench${embedded ? " ct-scope-workbench--solo" : ""}`}>
      <div className="ct-scope-workbench-main">

        <section className="ct-scope-overall-card">
          <header className="ct-scope-overall-head">
            <PixelIcon name="scale" size={40} className="ct-scope-overall-icon" />
            <div className="ct-scope-overall-head-text">
              <h2 className="ct-scope-overall-title">
                Applicability scan: <strong>{productTitle}</strong>
                {loading ? " — assessing…" : ""}
              </h2>
            </div>
          </header>

          {overallNarrative.lead ? (
            <p className="ct-scope-overall-lead">{overallNarrative.lead}</p>
          ) : null}

          {overallNarrative.overview ? (
            <p className="ct-scope-overall-overview">{overallNarrative.overview}</p>
          ) : null}

          <div className="ct-scope-stats-row" aria-label="Scope summary counts">
            <div className="ct-scope-stat ct-scope-stat-total">
              <span className="ct-scope-stat-value">{stats.total}</span>
              <span className="ct-scope-stat-label">Selected</span>
            </div>
            <div className="ct-scope-stat ct-scope-stat-likely">
              <span className="ct-scope-stat-icon" aria-hidden>
                ✓
              </span>
              <span className="ct-scope-stat-value">{stats.likely}</span>
              <span className="ct-scope-stat-label">Likely in scope</span>
            </div>
            <div className="ct-scope-stat ct-scope-stat-maybe">
              <span className="ct-scope-stat-icon" aria-hidden>
                ◇
              </span>
              <span className="ct-scope-stat-value">{stats.maybe}</span>
              <span className="ct-scope-stat-label">Needs review</span>
            </div>
            <div className="ct-scope-stat ct-scope-stat-unlikely">
              <span className="ct-scope-stat-icon" aria-hidden>
                ×
              </span>
              <span className="ct-scope-stat-value">{stats.unlikely}</span>
              <span className="ct-scope-stat-label">Not likely</span>
            </div>
          </div>
        </section>

        <div className="ct-scope-law-stack" aria-label="Per-law scope analysis">
          {selectedItems.length === 0 ? (
            <p className="ct-muted">No laws selected. Choose instruments in the law scan above.</p>
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
                    <span className="ct-scope-group-icon" aria-hidden>
                      {GROUP_ICON[group]}
                    </span>
                    <h3 className="ct-scope-group-title">
                      <strong>{SCOPE_GROUP_LABEL[group]}</strong>
                      <span className="ct-scope-group-count">
                        {entries.length} instrument{entries.length === 1 ? "" : "s"}
                      </span>
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

      {!embedded ? (
        <ScopeChatPanel
          productTitle={productTitle}
          productSummary={productSummary}
          focusedLawLabel={focusedItem?.listLabel}
          focusedInstrument={focusedInstrument}
          playbookCompanyId={playbookCompanyId}
          sessionId={sessionId}
        />
      ) : null}
    </div>
  );
}
