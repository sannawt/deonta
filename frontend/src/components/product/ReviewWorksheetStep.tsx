import { useCallback, useEffect, useMemo } from "react";
import { WorksheetTable } from "../cards/WorksheetTable";
import { FactsSummaryView } from "../workbench/FactsSummary";
import { resolveAssessment } from "../../lib/assessment";
import { formatAssessmentRef } from "../../lib/assessmentRef";
import {
  buildFrameworkRows,
  buildNextSteps,
  buildRiskFlags,
  factsOnRecord,
  mergeOpenQuestions,
} from "../../lib/reviewWorksheet";
import {
  buildDiscoveredItems,
  buildScopeRuleItems,
  type ScannedLawItem,
} from "../../lib/applicabilityScan";
import type { ProductIntakeState } from "../../lib/kgIntakeSchema";
import type { LawScanResult, SymbolicLawItem } from "../../lib/api";
import type { ChatResponse } from "../../types/chat";
import type { KgFact, ProductSpec } from "../../lib/productStore";

interface Props {
  assessmentId: string;
  assessmentTitle: string;
  onTitleChange: (title: string) => void;
  spec: ProductSpec;
  intake: ProductIntakeState;
  kgFacts: KgFact[];
  assessment: ChatResponse | null;
  scanResults: LawScanResult[];
  symbolicLaws: SymbolicLawItem[];
  symbolicCodes: string[];
  includedDiscovery: string[];
  onComplete: () => void;
  onEditFrameworkMap: () => void;
  onEditIntake: () => void;
  onAddToAiRegister?: () => void;
  onSaveStateChange?: (state: { canSave: boolean; busy: boolean; save: () => void }) => void;
}

function statusLabel(status: string): string {
  switch (status) {
    case "confirmed":
      return "In scope on assessed facts";
    case "assessment_required":
      return "Further review needed";
    case "potential":
      return "Relevance match — scope pending";
    case "excluded":
      return "Excluded";
    default:
      return status.replace(/_/g, " ");
  }
}

export function ReviewWorksheetStep({
  assessmentId,
  assessmentTitle,
  onTitleChange: _onTitleChange,
  spec,
  intake,
  kgFacts,
  assessment,
  scanResults,
  symbolicLaws,
  symbolicCodes,
  includedDiscovery,
  onComplete,
  onEditFrameworkMap,
  onEditIntake,
  onAddToAiRegister,
  onSaveStateChange,
}: Props) {
  const resolved = resolveAssessment(assessment);
  const instruments = resolved?.scope_analysis?.instruments ?? [];

  const scopeRuleItems = useMemo(
    () =>
      buildScopeRuleItems({
        symbolicCodes,
        symbolicLaws,
        instruments,
        tierRows: [],
      }),
    [symbolicCodes, symbolicLaws, instruments],
  );

  const discoveredItems = useMemo(
    () =>
      buildDiscoveredItems({
        scanResults,
        includedCodes: includedDiscovery,
        tierRows: [],
        instruments,
      }),
    [scanResults, includedDiscovery, instruments],
  );

  const allLawItems: ScannedLawItem[] = useMemo(
    () => [...scopeRuleItems, ...discoveredItems.filter((d) => d.selected)],
    [scopeRuleItems, discoveredItems],
  );

  const frameworkRows = useMemo(() => buildFrameworkRows(allLawItems), [allLawItems]);
  const openQuestions = useMemo(
    () => mergeOpenQuestions(resolved?.open_questions),
    [resolved?.open_questions],
  );
  const riskFlags = useMemo(() => buildRiskFlags(intake, assessment), [intake, assessment]);
  const nextSteps = useMemo(
    () => buildNextSteps(intake, openQuestions.length, allLawItems.map((i) => i.rowCode)),
    [intake, openQuestions.length, allLawItems],
  );
  const factRows = useMemo(() => factsOnRecord(kgFacts, intake), [kgFacts, intake]);

  const saveWorksheet = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    onSaveStateChange?.({
      canSave: Boolean(assessment),
      busy: false,
      save: saveWorksheet,
    });
  }, [assessment, onSaveStateChange, saveWorksheet]);

  const assessedAt = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="ct-review-worksheet ct-review-worksheet--printable">
      <header className="ct-review-worksheet-header">
        <div>
          <h1 className="ct-review-worksheet-title">{assessmentTitle}</h1>
          <p className="ct-review-worksheet-subtitle">Legal / privacy review worksheet</p>
          <p className="ct-review-worksheet-meta">
            {formatAssessmentRef(assessmentId)} · {assessedAt}
          </p>
        </div>
        <div className="ct-review-worksheet-actions ct-review-worksheet-actions--no-print">
          <button
            type="button"
            className="ct-btn-primary"
            disabled={!assessment}
            onClick={saveWorksheet}
          >
            Save worksheet
          </button>
          <button type="button" className="ct-btn-secondary" onClick={() => window.print()}>
            Export / print
          </button>
          <button type="button" className="ct-btn-secondary" onClick={onEditFrameworkMap}>
            Edit framework map
          </button>
        </div>
      </header>

      <section className="ct-review-section">
        <h2 className="ct-review-section-title">Product summary</h2>
        <p className="ct-review-prose">{spec.summary?.trim() || intake.productSummary || "—"}</p>
      </section>

      <section className="ct-review-section">
        <h2 className="ct-review-section-title">Facts on record</h2>
        {resolved?.facts ? (
          <FactsSummaryView facts={resolved.facts} />
        ) : (
          <ul className="ct-review-facts-list">
            {factRows.map((row) => (
              <li key={row.label}>
                <span className="ct-review-facts-label">{row.label}</span>
                <span className="ct-review-facts-value">{row.value}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ct-review-section">
        <h2 className="ct-review-section-title">Frameworks in scope</h2>
        {frameworkRows.length === 0 ? (
          <p className="ct-muted">No frameworks mapped yet.</p>
        ) : (
          <table className="ct-review-framework-table">
            <thead>
              <tr>
                <th>Framework</th>
                <th>Status</th>
                <th>Trigger</th>
              </tr>
            </thead>
            <tbody>
              {frameworkRows.map((row) => (
                <tr key={row.code}>
                  <td>{row.name}</td>
                  <td>{statusLabel(row.status)}</td>
                  <td>{row.trigger}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="ct-review-section">
        <WorksheetTable worksheet={assessment?.worksheet ?? resolved?.scope} title="How scope was tested" />
      </section>

      <section className="ct-review-section">
        <h2 className="ct-review-section-title">Open questions &amp; missing facts</h2>
        {openQuestions.length === 0 ? (
          <p className="ct-muted">No open questions from the current assessment.</p>
        ) : (
          <ul className="ct-review-questions-list">
            {openQuestions.map((q) => (
              <li key={q.id} className="ct-review-question-item">
                <p className="ct-review-question-text">{q.text}</p>
                {q.regulation ? (
                  <p className="ct-review-question-meta">Framework: {q.regulation}</p>
                ) : null}
                {q.detail ? <p className="ct-review-question-meta">{q.detail}</p> : null}
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="ct-review-link-btn ct-review-link-btn--no-print" onClick={onEditIntake}>
          Answer in product facts
        </button>
      </section>

      {riskFlags.length > 0 ? (
        <section className="ct-review-section">
          <h2 className="ct-review-section-title">Risk &amp; governance flags</h2>
          <ul className="ct-review-flags-list">
            {riskFlags.map((flag) => (
              <li key={flag.id} className={`ct-review-flag ct-review-flag--${flag.tone}`}>
                <strong>{flag.label}</strong>
                <p>{flag.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="ct-review-section">
        <h2 className="ct-review-section-title">Recommended next steps</h2>
        <ol className="ct-review-next-steps">
          {nextSteps.map((step) => (
            <li key={step.id}>
              <strong>{step.action}</strong>
              <p>{step.rationale}</p>
            </li>
          ))}
        </ol>
        {onAddToAiRegister && (intake.hasAi === "yes" || intake.aiFeatures.length > 0) ? (
          <button
            type="button"
            className="ct-btn-secondary ct-review-link-btn--no-print"
            onClick={onAddToAiRegister}
          >
            Add to AI governance register
          </button>
        ) : null}
      </section>

      <footer className="ct-review-worksheet-footer">
        <p className="ct-review-footer-ref">Assessment {formatAssessmentRef(assessmentId)} · internal review only</p>
      </footer>
    </div>
  );
}
