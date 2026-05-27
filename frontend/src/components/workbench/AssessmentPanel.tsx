import type { Assessment } from "../../types/chat";
import { DecisiveFactsPanel } from "../cards/DecisiveFactsPanel";
import { FactsSummaryView } from "./FactsSummary";
import { ScopeAnalysisPanel } from "./ScopeAnalysisPanel";

interface Props {
  assessment: Assessment | null;
  sessionTitle?: string;
  onSend: (text: string) => void;
}

export function AssessmentPanel({ assessment, sessionTitle, onSend }: Props) {
  if (!assessment) {
    return (
      <aside className="assessment-panel assessment-panel-empty">
        <div className="assessment-panel-head">
          <h2 className="assessment-panel-title">Provisional applicability assessment</h2>
        </div>
        <p className="assessment-panel-empty-text">
          Ask whether a regulation applies to your scenario (e.g. GDPR or the EU AI Act). Results
          appear here: relevant facts, scope analysis, and open points.
        </p>
      </aside>
    );
  }

  const facts = assessment.facts;

  return (
    <aside className="assessment-panel">
      <div className="assessment-panel-head">
        <h2 className="assessment-panel-title">Provisional applicability assessment</h2>
        {sessionTitle && <p className="assessment-panel-sub">{sessionTitle}</p>}
      </div>

      <div className="assessment-panel-body">
        <section className="assessment-section">
          <div className="assessment-section-title">Fact basis</div>
          <FactsSummaryView facts={facts} />
        </section>

        <section className="assessment-section">
          <div className="assessment-section-title">How scope was tested</div>
          <ScopeAnalysisPanel
            scopeAnalysis={assessment.scope_analysis}
            fallbackWorksheet={assessment.scope}
          />
        </section>

        {(assessment.open_questions || []).length > 0 && (
          <section className="assessment-section">
            <div className="assessment-section-title">Open points</div>
            <DecisiveFactsPanel
              questions={assessment.open_questions!}
              results={assessment.applicability_results || {}}
              onAnswer={onSend}
            />
          </section>
        )}
      </div>
    </aside>
  );
}
