import { useEffect, useState } from "react";
import {
  createEntryFromIntake,
  deleteAiGovernanceEntry,
  loadAiGovernanceEntries,
  upsertAiGovernanceEntry,
  type AiApprovalStatus,
  type AiGovernanceEntry,
  type AiModelType,
  type AiOwnerTeam,
  type AiRiskTier,
} from "../lib/aiGovernanceStore";

interface Props {
  onNavigateHome: () => void;
  prefillAssessmentId?: string | null;
  onClearPrefill?: () => void;
}

const RISK_TIERS: AiRiskTier[] = ["unknown", "minimal", "limited", "high", "prohibited"];
const MODEL_TYPES: AiModelType[] = ["unknown", "in_house", "third_party", "gpai"];
const OWNERS: AiOwnerTeam[] = ["legal", "privacy", "product", "security", "engineering", "other"];
const STATUSES: AiApprovalStatus[] = ["draft", "in_review", "approved", "rejected"];

function emptyEntry(): Omit<AiGovernanceEntry, "id" | "created_at" | "updated_at"> {
  return {
    toolName: "",
    useCase: "",
    dataTypes: "",
    modelType: "unknown",
    riskTier: "unknown",
    owner: "privacy",
    approvalStatus: "draft",
    linkedAssessmentIds: [],
  };
}

export function AiGovernancePage({ onNavigateHome, prefillAssessmentId, onClearPrefill }: Props) {
  const [entries, setEntries] = useState<AiGovernanceEntry[]>(() => loadAiGovernanceEntries());
  const [editing, setEditing] = useState<
    Omit<AiGovernanceEntry, "id" | "created_at" | "updated_at"> & { id?: string }
  >(emptyEntry());
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!prefillAssessmentId) return;
    setEditing(
      createEntryFromIntake({
        assessmentId: prefillAssessmentId,
        productName: "",
        productSummary: "",
        aiUsageDescription: "",
      }),
    );
    setShowForm(true);
    onClearPrefill?.();
  }, [prefillAssessmentId, onClearPrefill]);

  function refresh() {
    setEntries(loadAiGovernanceEntries());
  }

  function handleSave() {
    if (!editing.toolName.trim()) return;
    upsertAiGovernanceEntry(editing);
    refresh();
    setEditing(emptyEntry());
    setShowForm(false);
  }

  function handleEdit(entry: AiGovernanceEntry) {
    setEditing({ ...entry });
    setShowForm(true);
  }

  function handleDelete(id: string) {
    deleteAiGovernanceEntry(id);
    refresh();
  }

  return (
    <div className="ct-page ct-app-page ct-ai-gov-page">
      <header className="ct-app-page-header ct-workspace-header">
        <div>
          <h1 className="ct-dashboard-title">AI governance register</h1>
          <p className="ct-page-sub">
            Track AI tools, vendors, use cases, risk tiers, and approval status.
          </p>
        </div>
        <button type="button" className="ct-btn-secondary" onClick={onNavigateHome}>
          Back to workspace
        </button>
      </header>

      <div className="ct-ai-gov-toolbar">
        <button
          type="button"
          className="ct-btn-primary"
          onClick={() => {
            setEditing(emptyEntry());
            setShowForm(true);
          }}
        >
          Add entry
        </button>
      </div>

      {showForm ? (
        <section className="ct-panel ct-ai-gov-form">
          <h2 className="ct-review-section-title">{editing.id ? "Edit entry" : "New entry"}</h2>
          <div className="ct-ai-gov-form-grid">
            <label>
              Tool / vendor name
              <input
                className="ct-intake-input"
                value={editing.toolName}
                onChange={(e) => setEditing((v) => ({ ...v, toolName: e.target.value }))}
              />
            </label>
            <label>
              Vendor (optional)
              <input
                className="ct-intake-input"
                value={editing.vendor ?? ""}
                onChange={(e) => setEditing((v) => ({ ...v, vendor: e.target.value }))}
              />
            </label>
            <label className="ct-ai-gov-span-2">
              Use case
              <textarea
                className="ct-intake-input ct-intake-input--textarea"
                rows={3}
                value={editing.useCase}
                onChange={(e) => setEditing((v) => ({ ...v, useCase: e.target.value }))}
              />
            </label>
            <label className="ct-ai-gov-span-2">
              Data types
              <input
                className="ct-intake-input"
                value={editing.dataTypes}
                onChange={(e) => setEditing((v) => ({ ...v, dataTypes: e.target.value }))}
                placeholder="e.g. viewing IDs, device graphs"
              />
            </label>
            <label>
              Model type
              <select
                className="ct-intake-input"
                value={editing.modelType}
                onChange={(e) => setEditing((v) => ({ ...v, modelType: e.target.value as AiModelType }))}
              >
                {MODEL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Risk tier
              <select
                className="ct-intake-input"
                value={editing.riskTier}
                onChange={(e) => setEditing((v) => ({ ...v, riskTier: e.target.value as AiRiskTier }))}
              >
                {RISK_TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Owner
              <select
                className="ct-intake-input"
                value={editing.owner}
                onChange={(e) => setEditing((v) => ({ ...v, owner: e.target.value as AiOwnerTeam }))}
              >
                {OWNERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Approval status
              <select
                className="ct-intake-input"
                value={editing.approvalStatus}
                onChange={(e) =>
                  setEditing((v) => ({ ...v, approvalStatus: e.target.value as AiApprovalStatus }))
                }
              >
                {STATUSES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="ct-ai-gov-form-actions">
            <button type="button" className="ct-btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="button" className="ct-btn-primary" onClick={handleSave}>
              Save entry
            </button>
          </div>
        </section>
      ) : null}

      <section className="ct-panel ct-ai-gov-list" aria-label="AI governance entries">
        {entries.length === 0 ? (
          <p className="ct-muted">No AI governance entries yet. Add tools and use cases from assessments.</p>
        ) : (
          <ul className="ct-ai-gov-entries">
            {entries.map((entry) => (
              <li key={entry.id} className="ct-ai-gov-entry">
                <div className="ct-ai-gov-entry-head">
                  <strong>{entry.toolName}</strong>
                  <span className={`ct-ai-gov-badge ct-ai-gov-badge--${entry.riskTier}`}>
                    {entry.riskTier} risk
                  </span>
                  <span className="ct-ai-gov-badge">{entry.approvalStatus.replace(/_/g, " ")}</span>
                </div>
                <p className="ct-ai-gov-entry-use">{entry.useCase}</p>
                <p className="ct-ai-gov-entry-meta">
                  Owner: {entry.owner} · Model: {entry.modelType.replace(/_/g, " ")}
                  {entry.linkedAssessmentIds.length
                    ? ` · ${entry.linkedAssessmentIds.length} linked assessment(s)`
                    : ""}
                </p>
                <div className="ct-ai-gov-entry-actions">
                  <button type="button" className="ct-btn-secondary" onClick={() => handleEdit(entry)}>
                    Edit
                  </button>
                  <button type="button" className="ct-btn-secondary" onClick={() => handleDelete(entry.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
