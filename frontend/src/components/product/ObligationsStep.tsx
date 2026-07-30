import { useCallback, useEffect, useState } from "react";
import { fetchLawObligations, fetchLawSummary } from "../../lib/api";
import { ThinkingOverlay } from "../ui/ThinkingOverlay";
import { WorkflowSplitLayout } from "./WorkflowSplitLayout";

interface ObligationRow {
  id: string;
  topic: string;
  text: string;
}

interface Props {
  lawCodes: string[];
  initialSelectedIds?: string[];
  onComplete: (payload: { law_codes: string[]; selected_obligation_ids: string[] }) => void;
  onSaveStateChange?: (state: {
    canSave: boolean;
    busy: boolean;
    save: () => void;
  }) => void;
}

export function ObligationsStep({ lawCodes, initialSelectedIds, onComplete, onSaveStateChange }: Props) {
  const [activeCode, setActiveCode] = useState(lawCodes[0] || "");
  const [obligations, setObligations] = useState<ObligationRow[]>([]);
  const [summaryLabel, setSummaryLabel] = useState("");
  const [selected, setSelected] = useState<string[]>(initialSelectedIds ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCode) return;
    setLoading(true);
    setError(null);
    Promise.all([fetchLawSummary(activeCode), fetchLawObligations(activeCode)])
      .then(([summary, obs]) => {
        setSummaryLabel(String(summary.label || activeCode));
        const rows = (obs.obligations as ObligationRow[]) || [];
        setObligations(rows);
        if (!initialSelectedIds?.length && rows.length) {
          setSelected((prev) => {
            const ids = rows.map((o) => o.id);
            const merged = new Set([...prev, ...ids]);
            return [...merged];
          });
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load obligations"))
      .finally(() => setLoading(false));
  }, [activeCode, initialSelectedIds?.length]);

  function toggleObligation(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const saveAssessment = useCallback(() => {
    onComplete({ law_codes: lawCodes, selected_obligation_ids: selected });
  }, [lawCodes, onComplete, selected]);

  useEffect(() => {
    onSaveStateChange?.({
      canSave: selected.length > 0,
      busy: loading,
      save: saveAssessment,
    });
  }, [loading, onSaveStateChange, saveAssessment, selected.length]);

  return (
    <div className="ct-obligations-step">
      <ThinkingOverlay show={loading} label="Loading obligations…" />
      {error ? <div className="err">{error}</div> : null}

      <WorkflowSplitLayout
        stepLabel=""
        title="Obligations"
        intro="Review indicative obligations for laws that may apply to your product."
        actionsTitle="In-scope laws"
        resultsTitle={summaryLabel || "Obligations"}
        actionsAriaLabel="In-scope laws"
        resultsAriaLabel="Obligation list"
        actions={
          <nav className="ct-law-scan-sidebar" aria-label="In-scope laws">
            <ul className="ct-law-scan-sidebar-list">
              {lawCodes.map((code) => (
                <li key={code}>
                  <button
                    type="button"
                    className={`ct-law-scan-sidebar-item ct-law-scan-sidebar-btn${activeCode === code ? " ct-law-scan-sidebar-item--active" : ""}`}
                    onClick={() => setActiveCode(code)}
                  >
                    <span className="ct-law-scan-sidebar-label">{code.replace(/_/g, " ").toUpperCase()}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        }
        results={
          <div className="ct-block">
            {obligations.length === 0 && !loading ? (
              <p className="ct-muted">No obligation stubs available for this law yet.</p>
            ) : (
              obligations.map((ob) => (
                <label key={ob.id} className="ct-ob-row">
                  <input
                    type="checkbox"
                    checked={selected.includes(ob.id)}
                    onChange={() => toggleObligation(ob.id)}
                  />
                  <div>
                    <div className="text-strong">{ob.topic}</div>
                    <div className="text-sm">{ob.text}</div>
                  </div>
                </label>
              ))
            )}
          </div>
        }
      />
    </div>
  );
}
