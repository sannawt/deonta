import { useEffect, useState } from "react";
import { fetchEvidencePack, fetchLawSummary } from "../lib/api";
import { ThinkingOverlay } from "../components/ui/ThinkingOverlay";
import { ThinkingSpinner } from "../components/ui/ThinkingSpinner";

type Step = "summary" | "obligations" | "evidence";

interface Props {
  lawCodes: string[];
  onBack: () => void;
}

export function LawWorkflow({ lawCodes, onBack }: Props) {
  const [step, setStep] = useState<Step>("summary");
  const [activeCode, setActiveCode] = useState(lawCodes[0] || "gdpr");
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<{
    documents: Array<Record<string, string>>;
    related_laws: Array<Record<string, string>>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCode) return;
    setLoading(true);
    setError(null);
    fetchLawSummary(activeCode)
      .then((s) => {
        setSummary(s);
        const obs = (s.obligations as Array<{ id: string }>) || [];
        setSelected(obs.map((o) => o.id));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load law"))
      .finally(() => setLoading(false));
  }, [activeCode]);

  async function generateEvidence() {
    setLoading(true);
    setError(null);
    try {
      const pack = await fetchEvidencePack(selected, lawCodes);
      setEvidence(pack);
      setStep("evidence");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const obligations =
    (summary?.obligations as Array<{ id: string; topic: string; text: string }>) || [];

  return (
    <div className="ct-page">
      <h1 className="ct-page-title">Law-led workflow</h1>
      <p className="ct-page-sub">
        Understand obligations and build an evidence document list for: {lawCodes.join(", ")}
      </p>

      <div className="ct-law-tabs">
        {lawCodes.map((code) => (
          <button
            key={code}
            type="button"
            className={`ct-chip ${activeCode === code ? "active" : ""}`}
            onClick={() => {
              setActiveCode(code);
              setStep("summary");
            }}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="ct-stepper">
        <span className={`ct-step ${step === "summary" ? "active" : ""}`}>Summary</span>
        <span className={`ct-step ${step === "obligations" ? "active" : ""}`}>Obligations</span>
        <span className={`ct-step ${step === "evidence" ? "active" : ""}`}>Evidence</span>
      </div>

      {error && <div className="err">{error}</div>}
      <ThinkingOverlay
        show={loading && (step !== "evidence" || !evidence)}
        label={step === "evidence" ? "Building evidence pack…" : "Loading law data…"}
      />

      {step === "summary" && summary && !loading && (
        <div className="ct-block">
          <h2 className="ct-card-title">{String(summary.label || activeCode)}</h2>
          <p className="text-body">{String(summary.summary || "")}</p>
          <p className="text-xs text-muted" style={{ marginTop: 8 }}>
            Engine: {String(summary.engine_mode)} · Neo4j:{" "}
            {summary.neo4j_configured ? "connected" : "local stub"}
          </p>
          <div className="ct-actions">
            <button type="button" className="ct-btn-secondary" onClick={onBack}>
              Back
            </button>
            <button type="button" className="ct-btn-primary" onClick={() => setStep("obligations")}>
              View obligations
            </button>
          </div>
        </div>
      )}

      {step === "obligations" && (
        <div className="ct-block">
          {obligations.map((ob) => (
            <label key={ob.id} className="ct-ob-row">
              <input
                type="checkbox"
                checked={selected.includes(ob.id)}
                onChange={() =>
                  setSelected((s) =>
                    s.includes(ob.id) ? s.filter((x) => x !== ob.id) : [...s, ob.id]
                  )
                }
              />
              <div>
                <div className="text-strong">{ob.topic}</div>
                <div className="text-sm">{ob.text}</div>
              </div>
            </label>
          ))}
          <div className="ct-actions">
            <button type="button" className="ct-btn-secondary" onClick={() => setStep("summary")}>
              Back
            </button>
            <button
              type="button"
              className="ct-btn-primary ct-btn-with-spinner"
              disabled={loading || selected.length === 0}
              onClick={generateEvidence}
            >
              {loading && <ThinkingSpinner active label="" size={22} />}
              <span>{loading ? "Building…" : "Generate evidence pack"}</span>
            </button>
          </div>
        </div>
      )}

      {step === "evidence" && evidence && (
        <div className="ct-block">
          <h2 className="ct-card-title">Required evidence documents</h2>
          <table className="ct-table">
            <thead>
              <tr>
                <th>Law</th>
                <th>Topic</th>
                <th>Document</th>
              </tr>
            </thead>
            <tbody>
              {evidence.documents.map((d, i) => (
                <tr key={i}>
                  <td>{d.law}</td>
                  <td>{d.obligation_topic}</td>
                  <td>{d.document}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {evidence.related_laws?.length > 0 && (
            <>
              <h3 className="ct-card-title" style={{ marginTop: 16 }}>
                Related laws
              </h3>
              <div className="ct-law-chips">
                {evidence.related_laws.map((r) => (
                  <span key={r.code} className="ct-chip">
                    {r.label || r.code}
                  </span>
                ))}
              </div>
            </>
          )}
          <div className="ct-actions">
            <button type="button" className="ct-btn-secondary" onClick={() => setStep("obligations")}>
              Back
            </button>
            <button type="button" className="ct-btn-secondary" onClick={onBack}>
              Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
