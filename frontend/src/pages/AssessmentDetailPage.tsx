import type { ProductRecord } from "../lib/productStore";
import { formatAssessmentRef } from "../lib/assessmentRef";
import { resolveAssessment } from "../lib/assessment";
import { AssessmentDisclaimer } from "../components/product/AssessmentDisclaimer";
import { WorksheetTable } from "../components/cards/WorksheetTable";
import { FactsSummaryView } from "../components/workbench/FactsSummary";
import {
  buildFrameworkRows,
  buildNextSteps,
  buildRiskFlags,
  factsOnRecord,
  mergeOpenQuestions,
} from "../lib/reviewWorksheet";
import {
  buildDiscoveredItems,
  buildScopeRuleItems,
} from "../lib/applicabilityScan";
import { EMPTY_INTAKE } from "../lib/kgIntakeSchema";
import { ensureScopeInstruments } from "../lib/scopeFallback";

interface Props {
  product: ProductRecord;
  onBack: () => void;
  onResume: () => void;
  onPrint?: () => void;
}

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

export function AssessmentDetailPage({ product, onBack, onResume, onPrint }: Props) {
  const assessment = product.lastAssessment?.response ?? null;
  const resolved = resolveAssessment(assessment);
  const symbolicCodes = ["gdpr", "ai_act"];
  const includedDiscovery = product.spec.selectedLaws ?? [];
  const instruments = ensureScopeInstruments(
    resolved?.scope_analysis?.instruments ?? [],
    [...symbolicCodes, ...includedDiscovery],
    [],
    product.spec,
  );

  const scopeRuleItems = buildScopeRuleItems({
    symbolicCodes,
    symbolicLaws: [
      { code: "gdpr", label: "GDPR", short: "GDPR", ui_label: "GDPR" },
      { code: "ai_act", label: "AI Act", short: "AI Act", ui_label: "AI Act" },
    ],
    instruments,
    tierRows: [],
  });
  const discoveredItems = buildDiscoveredItems({
    scanResults: [],
    includedCodes: includedDiscovery,
    tierRows: [],
    instruments,
  });
  const allLawItems = [...scopeRuleItems, ...discoveredItems.filter((d) => d.selected)];
  const frameworkRows = buildFrameworkRows(allLawItems);
  const openQuestions = mergeOpenQuestions(resolved?.open_questions);
  const riskFlags = buildRiskFlags(EMPTY_INTAKE, assessment);
  const nextSteps = buildNextSteps(EMPTY_INTAKE, openQuestions.length, allLawItems.map((i) => i.rowCode));
  const factRows = factsOnRecord(product.kgFacts ?? [], EMPTY_INTAKE);

  const assessedAt = product.lastAssessment?.created_at ?? product.updated_at;

  return (
    <div className="ct-page ct-app-page ct-assessment-detail ct-review-worksheet--printable">
      <header className="ct-app-page-header ct-workspace-header ct-assessment-detail-header">
        <div>
          <h1 className="ct-dashboard-title">{product.label}</h1>
          <p className="ct-page-sub">
            {formatAssessmentRef(product.id)} · Assessed {formatDate(assessedAt)}
          </p>
        </div>
        <div className="ct-assessment-detail-actions ct-review-worksheet-actions--no-print">
          <button type="button" className="ct-btn-secondary" onClick={onBack}>
            Back
          </button>
          <button type="button" className="ct-btn-secondary" onClick={onResume}>
            Resume assessment
          </button>
          <button
            type="button"
            className="ct-btn-primary"
            onClick={() => (onPrint ? onPrint() : window.print())}
          >
            Export / print
          </button>
        </div>
      </header>

      <AssessmentDisclaimer />

      <section className="ct-review-section">
        <h2 className="ct-review-section-title">Product summary</h2>
        <p className="ct-review-prose">{product.spec.summary?.trim() || "—"}</p>
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
          <p className="ct-muted">Complete framework mapping to see results here.</p>
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
                  <td>{row.status.replace(/_/g, " ")}</td>
                  <td>{row.trigger}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <WorksheetTable worksheet={assessment?.worksheet ?? resolved?.scope} title="How scope was tested" />

      {openQuestions.length > 0 ? (
        <section className="ct-review-section">
          <h2 className="ct-review-section-title">Open questions</h2>
          <ul className="ct-review-questions-list">
            {openQuestions.map((q) => (
              <li key={q.id} className="ct-review-question-item">
                <p className="ct-review-question-text">{q.text}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
      </section>

      {product.lastWorksheet ? (
        <p className="ct-muted ct-assessment-detail-saved">
          Worksheet saved {formatDate(product.lastWorksheet.created_at)}
        </p>
      ) : null}

      <footer className="ct-review-worksheet-footer">
        <AssessmentDisclaimer compact />
        <p className="ct-review-footer-ref">Assessment {formatAssessmentRef(product.id)} · internal review only</p>
      </footer>
    </div>
  );
}
