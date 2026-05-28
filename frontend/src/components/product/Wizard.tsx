import { useMemo, useState } from "react";
import type { ChatResponse } from "../../types/chat";
import { createProduct, type ProductRecord, type ProductSpec } from "../../lib/productStore";

function joinNonEmpty(parts: string[]): string {
  return parts.map((p) => p.trim()).filter(Boolean).join("\n");
}

function specToPrompt(spec: ProductSpec): string {
  const markets = spec.markets.length ? spec.markets.join(", ") : "unknown";
  return joinNonEmpty([
    `Assess applicable EU laws (GDPR, EU AI Act) for this product and provide a defensible scope record with citations and reasoning trace.`,
    ``,
    `Product name: ${spec.name || "unknown"}`,
    `Product summary: ${spec.summary || "unknown"}`,
    `Markets: ${markets}`,
    ``,
    `Signals (if known):`,
    `- Processes personal data: ${spec.processesPersonalData}`,
    `- EU territorial link: ${spec.euLink}`,
    `- Is an AI system: ${spec.aiSystem}`,
  ]);
}

interface Props {
  playbookCompanyId?: string;
  onAssessment: (product: ProductRecord, prompt: string, resp: ChatResponse) => void;
  runAssessment: (prompt: string, sessionId: string, playbookCompanyId?: string) => Promise<ChatResponse>;
}

export function Wizard({ playbookCompanyId, onAssessment, runAssessment }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [spec, setSpec] = useState<ProductSpec>({
    name: "",
    summary: "",
    markets: ["EU"],
    processesPersonalData: "unknown",
    euLink: "unknown",
    aiSystem: "unknown",
  });

  const prompt = useMemo(() => specToPrompt(spec), [spec]);

  async function handleRun() {
    setLoading(true);
    setError(null);
    try {
      const product = createProduct(spec);
      const resp = await runAssessment(prompt, product.id, playbookCompanyId);
      onAssessment(product, prompt, resp);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assessment failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="card-title">New assessment</div>
      <div className="card-subtitle">Structured product onboarding → instant applicability record</div>

      {error && <div className="err" style={{ marginTop: 10 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <span className={`badge ${step === 1 ? "badge-blue" : "badge-gray"}`}>1. Product</span>
        <span className={`badge ${step === 2 ? "badge-blue" : "badge-gray"}`}>2. Signals</span>
        <span className={`badge ${step === 3 ? "badge-blue" : "badge-gray"}`}>3. Record</span>
      </div>

      {step === 1 && (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div>
            <div className="text-label">Product name</div>
            <input
              className="input"
              value={spec.name}
              onChange={(e) => setSpec((s) => ({ ...s, name: e.target.value }))}
              placeholder="e.g. Predictive maintenance platform"
            />
          </div>
          <div>
            <div className="text-label">Short description</div>
            <textarea
              className="textarea"
              value={spec.summary}
              onChange={(e) => setSpec((s) => ({ ...s, summary: e.target.value }))}
              placeholder="What it does, who uses it, what data it touches."
            />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="hdr-btn" type="button" onClick={() => setStep(2)}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <div className="text-label">Processes personal data?</div>
              <select
                className="input"
                value={spec.processesPersonalData}
                onChange={(e) => setSpec((s) => ({ ...s, processesPersonalData: e.target.value as any }))}
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <div className="text-label">EU territorial link?</div>
              <select
                className="input"
                value={spec.euLink}
                onChange={(e) => setSpec((s) => ({ ...s, euLink: e.target.value as any }))}
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <div className="text-label">AI system?</div>
              <select
                className="input"
                value={spec.aiSystem}
                onChange={(e) => setSpec((s) => ({ ...s, aiSystem: e.target.value as any }))}
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          <details className="assessment-details">
            <summary>Preview prompt</summary>
            <pre className="text-xs" style={{ whiteSpace: "pre-wrap" }}>{prompt}</pre>
          </details>

          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <button className="hdr-btn" type="button" onClick={() => setStep(1)} disabled={loading}>
              Back
            </button>
            <button className="run-btn" type="button" onClick={handleRun} disabled={loading}>
              {loading ? "Running…" : "Run assessment"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ marginTop: 12 }}>
          <div className="empty">
            Assessment created and saved in Products. Open Products to review the record and trace.
          </div>
        </div>
      )}
    </div>
  );
}

