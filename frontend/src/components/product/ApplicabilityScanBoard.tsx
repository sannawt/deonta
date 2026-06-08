import { useEffect, useMemo, useState } from "react";
import type { LawScanResult } from "../../lib/api";
import {
  STATUS_LABEL,
  STATUS_SYMBOL,
  assessmentSourceLabel,
  buildCompactBottomLine,
  buildLawVerdictDetail,
  buildScannedLawList,
  defaultFocusedRowCode,
  filterQuestionsForLaw,
  instrumentMatchesCode,
  type ScannedLawItem,
} from "../../lib/applicabilityScan";
import type { LawApplicabilityRow } from "../../lib/applicabilityVerdict";
import type { ClarifyingQuestion, ScopeInstrument } from "../../types/chat";

interface Props {
  productTitle: string;
  scanResults: LawScanResult[];
  selectedCodes: string[];
  tierRows: LawApplicabilityRow[];
  instruments: ScopeInstrument[];
  openQuestions?: ClarifyingQuestion[];
  scenarioGist?: string;
  productSummary?: string;
  loading?: boolean;
}

export function ApplicabilityScanBoard({
  productTitle,
  scanResults,
  selectedCodes,
  tierRows,
  instruments,
  openQuestions = [],
  scenarioGist,
  productSummary,
  loading = false,
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

  const [focusedCode, setFocusedCode] = useState<string | null>(() =>
    defaultFocusedRowCode(
      buildScannedLawList({
        scanResults,
        selectedCodes,
        tierRows,
        instruments,
      }),
    ),
  );

  useEffect(() => {
    if (!focusedCode || !lawItems.some((i) => i.rowCode === focusedCode)) {
      setFocusedCode(defaultFocusedRowCode(lawItems));
    }
  }, [lawItems, focusedCode]);

  const focusedItem = lawItems.find((i) => i.rowCode === focusedCode) ?? lawItems[0];
  const focusedInstrument = focusedItem
    ? instruments.find((inst) =>
        instrumentMatchesCode(
          inst,
          focusedItem.scanRow?.catalog_code || focusedItem.scanRow?.code || focusedItem.rowCode,
        ),
      )
    : undefined;

  const focusedLawCode =
    focusedItem?.scanRow?.catalog_code ||
    focusedItem?.scanRow?.code ||
    focusedItem?.rowCode ||
    "";
  const lawQuestions = filterQuestionsForLaw(openQuestions, focusedLawCode);

  const detail = focusedItem
    ? buildLawVerdictDetail({
        item: focusedItem,
        instrument: focusedInstrument,
        openQuestions: lawQuestions,
      })
    : null;

  const sourceBadge = assessmentSourceLabel(focusedInstrument);

  const compactBottomLine = buildCompactBottomLine(
    scanResults,
    tierRows,
    selectedCodes,
    {
      scenarioGist,
      productSummary,
      instruments,
    },
  );

  return (
    <div className="ct-applicability-board">
      <header className="ct-applicability-board-header">
        <h2 className="ct-applicability-board-title">
          Applicability scan: {productTitle}
        </h2>
        <p className="ct-applicability-board-bottom">
          <span className="ct-applicability-board-bottom-label">Bottom line:</span>{" "}
          {compactBottomLine}
        </p>
      </header>

      <div className="ct-applicability-board-grid">
        <section className="ct-applicability-col ct-applicability-col-laws" aria-label="Laws scanned">
          <h3 className="ct-applicability-col-title">1. Laws scanned</h3>
          <ul className="ct-applicability-law-list">
            {lawItems.map((item) => (
              <LawListItem
                key={item.rowCode}
                item={item}
                active={item.rowCode === focusedCode}
                onSelect={() => setFocusedCode(item.rowCode)}
              />
            ))}
          </ul>
        </section>

        <section className="ct-applicability-col ct-applicability-col-verdict" aria-label="Verdict">
          <h3 className="ct-applicability-col-title">2. Verdict</h3>
          {loading && focusedItem?.selected ? (
            <p className="ct-muted ct-applicability-empty">Running scope assessment…</p>
          ) : detail && focusedItem?.selected ? (
            <div className="ct-applicability-verdict-panel">
              <p className="ct-applicability-instrument-name">
                {detail.instrumentName}
                {sourceBadge ? (
                  <span className="ct-applicability-source-badge">{sourceBadge}</span>
                ) : null}
              </p>
              <div className="ct-applicability-verdict-block">
                <p className="ct-applicability-field-label">Verdict:</p>
                <p className="ct-applicability-verdict-value">{detail.verdict}</p>
              </div>
              <div className="ct-applicability-verdict-block">
                <p className="ct-applicability-field-label">Confidence:</p>
                <p className="ct-applicability-confidence">{detail.confidence}</p>
              </div>
              {detail.summary ? (
                <div className="ct-applicability-verdict-block">
                  <p className="ct-applicability-field-label">Summary:</p>
                  <p className="ct-applicability-summary">{detail.summary}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="ct-muted ct-applicability-empty">
              {focusedItem
                ? "This law was scanned but not selected for applicability assessment."
                : "Select a law to view its verdict."}
            </p>
          )}
        </section>

        <section
          className="ct-applicability-col ct-applicability-col-reasoning"
          aria-label="Reasoning and evidence"
        >
          <h3 className="ct-applicability-col-title">3. Reasoning &amp; evidence</h3>
          {loading && focusedItem?.selected ? (
            <p className="ct-muted ct-applicability-empty">Loading legal tests and evidence…</p>
          ) : detail && focusedItem?.selected ? (
            <div className="ct-applicability-reasoning-panel">
              <div className="ct-applicability-reasoning-section">
                <p className="ct-applicability-section-label">LEGAL TESTS</p>
                {detail.legalTests.length ? (
                  <ol className="ct-applicability-tests">
                    {detail.legalTests.map((test, index) => (
                      <li key={`${test.label}-${index}`}>
                        <span className="ct-applicability-test-q">{test.label}</span>{" "}
                        <span className="ct-applicability-test-a">{test.answer}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="ct-muted">No scope dimension tests returned yet.</p>
                )}
              </div>

              <div className="ct-applicability-reasoning-section">
                <p className="ct-applicability-section-label">FACTS USED</p>
                {detail.factsUsed.length ? (
                  <ul className="ct-applicability-facts">
                    {detail.factsUsed.map((fact) => (
                      <li key={fact}>
                        <span className="ct-applicability-fact-check" aria-hidden>
                          ✓
                        </span>
                        {fact}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ct-muted">No grounded facts linked to this instrument yet.</p>
                )}
              </div>

              <div className="ct-applicability-reasoning-section">
                <p className="ct-applicability-section-label">MISSING FACTS</p>
                {detail.missingFacts.length ? (
                  <ul className="ct-applicability-missing">
                    {detail.missingFacts.map((fact) => (
                      <li key={fact}>
                        <span className="ct-applicability-missing-mark" aria-hidden>
                          ?
                        </span>
                        {fact}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ct-muted">No open fact gaps flagged for this instrument.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="ct-muted ct-applicability-empty">
              Reasoning appears for laws selected in Step 2.
            </p>
          )}
        </section>
      </div>

      <p className="ct-applicability-board-footer ct-muted">
        LLM-assisted scope is indicative; symbolic rules are authoritative where available.
      </p>
    </div>
  );
}

function LawListItem({
  item,
  active,
  onSelect,
}: {
  item: ScannedLawItem;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={`ct-applicability-law-btn ct-applicability-law-${item.status}${active ? " active" : ""}`}
        onClick={onSelect}
        title={STATUS_LABEL[item.status]}
      >
        <span className="ct-applicability-law-symbol" aria-hidden>
          {STATUS_SYMBOL[item.status]}
        </span>
        <span className="ct-applicability-law-name">{item.listLabel}</span>
      </button>
    </li>
  );
}
