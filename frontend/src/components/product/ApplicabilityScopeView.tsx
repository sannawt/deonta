import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { assessProduct, parseProduct, type LawScanResult } from "../../lib/api";
import { ensureAccountId } from "../../lib/account";
import { resolveAssessment } from "../../lib/assessment";
import {
  createProduct,
  type KgFact,
  type ProductRecord,
  type ProductSpec,
} from "../../lib/productStore";
import { ScopeAnalysisPanel } from "../workbench/ScopeAnalysisPanel";
import { ThinkingOverlay } from "../ui/ThinkingOverlay";
import { PixelIcon } from "../ui/PixelIcon";
import type { ChatResponse, ScopeAnalysis, ScopeInstrument } from "../../types/chat";

const RESULT_BADGE: Record<string, string> = {
  PASS: "ct-scope-badge-pass",
  FAIL: "ct-scope-badge-fail",
  UNKNOWN: "ct-scope-badge-unknown",
  NOT_REACHED: "ct-scope-badge-muted",
  DEFERRED: "ct-scope-badge-muted",
};

function normCode(value: string): string {
  return value.toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
}

function instrumentMatchesCode(inst: ScopeInstrument, code: string): boolean {
  const c = normCode(code);
  const candidates = [inst.reg_key, inst.id, inst.label]
    .filter(Boolean)
    .map((v) => normCode(String(v)));
  if (candidates.some((k) => k === c || k.includes(c) || c.includes(k))) return true;
  if (c === "ai_act" && candidates.some((k) => k.includes("ai"))) return true;
  return false;
}

function filterScopeAnalysis(
  scope: ScopeAnalysis | undefined,
  selectedCodes: string[]
): ScopeAnalysis | undefined {
  if (!scope?.instruments?.length) return scope;
  const filtered = scope.instruments.filter((inst) =>
    selectedCodes.some((code) => instrumentMatchesCode(inst, code))
  );
  return { ...scope, instruments: filtered.length ? filtered : scope.instruments };
}

interface Props {
  selectedLaws: string[];
  scanResults: LawScanResult[];
  spec: ProductSpec;
  description: string;
  kgFacts: KgFact[];
  playbookCompanyId?: string;
  onComplete: (product: ProductRecord) => void;
  onBackToLaws: () => void;
  onEditProduct: () => void;
}

export function ApplicabilityScopeView({
  selectedLaws,
  scanResults,
  spec,
  description,
  kgFacts,
  playbookCompanyId,
  onComplete,
  onBackToLaws,
  onEditProduct,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ChatResponse | null>(null);

  const payloadRef = useRef({
    spec,
    description,
    kgFacts,
    selectedLaws,
    playbookCompanyId,
  });
  payloadRef.current = { spec, description, kgFacts, selectedLaws, playbookCompanyId };

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const lawMeta = useMemo(() => {
    const byCode = new Map(scanResults.map((r) => [r.code, r]));
    return selectedLaws.map((code) => {
      const row = byCode.get(code);
      return {
        code,
        short: row?.short || code.toUpperCase(),
        number: row?.number || "—",
        engine_mode: row?.engine_mode || "retrieval_only",
      };
    });
  }, [scanResults, selectedLaws]);

  const runSymbolicAssess = useCallback(async () => {
    const {
      spec: currentSpec,
      description: currentDescription,
      kgFacts: currentFacts,
      selectedLaws: laws,
      playbookCompanyId: playbookId,
    } = payloadRef.current;

    setLoading(true);
    setError(null);
    try {
      const aid = await ensureAccountId();
      const freshKg = await parseProduct({
        description: currentDescription,
      });
      const freshFacts = (freshKg.facts ?? []).map((f) => ({
        id: f.id,
        label: f.label,
        value: f.value,
        source: f.provenance || f.source,
        predicate: f.predicate,
        args: f.args,
      }));
      const assessSpec: ProductSpec = {
        ...currentSpec,
        summary: currentSpec.summary?.trim() || currentDescription.trim(),
        selectedLaws: laws,
        ...(freshKg.spec
          ? {
              name: freshKg.spec.name || currentSpec.name,
              markets: freshKg.spec.markets || currentSpec.markets,
              processesPersonalData:
                (freshKg.spec.processesPersonalData as ProductSpec["processesPersonalData"]) ||
                currentSpec.processesPersonalData,
              euLink:
                (freshKg.spec.euLink as ProductSpec["euLink"]) || currentSpec.euLink,
              aiSystem:
                (freshKg.spec.aiSystem as ProductSpec["aiSystem"]) || currentSpec.aiSystem,
            }
          : {}),
      };
      const created = createProduct(assessSpec);
      created.kgFacts = freshFacts.length ? freshFacts : currentFacts;
      const result = await assessProduct({
        spec: { ...assessSpec, regulations: laws },
        kg_facts: created.kgFacts,
        account_id: aid,
        playbook_company_id: playbookId,
        case_id: created.id,
      });
      const updated: ProductRecord = {
        ...created,
        lastAssessment: {
          created_at: Date.now(),
          prompt: assessSpec.summary,
          response: result,
        },
      };
      setResponse(result);
      onCompleteRef.current(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Symbolic scope analysis failed");
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runSymbolicAssess();
  }, [runSymbolicAssess]);

  const assessment = resolveAssessment(response);
  const scopeAnalysis = filterScopeAnalysis(assessment?.scope_analysis, selectedLaws);
  const instruments = scopeAnalysis?.instruments ?? [];

  const summaryRows = lawMeta.map((law) => {
    const inst = instruments.find((i) => instrumentMatchesCode(i, law.code));
    if (!inst) {
      return {
        code: law.code,
        short: law.short,
        number: law.number,
        material: "—",
        territorial: "—",
        temporal: "—",
        verdict: law.engine_mode === "symbolic" ? "Pending" : "No symbolic engine",
      };
    }
    const dim = (id: string) => inst.dimensions?.find((d) => d.id === id)?.result ?? "—";
    return {
      code: law.code,
      short: law.short,
      number: law.number,
      material: dim("material"),
      territorial: dim("territorial"),
      temporal: dim("temporal"),
      verdict: inst.verdict_display || inst.verdict || "—",
    };
  });

  return (
    <div className="ct-page ct-card-relative">
      <ThinkingOverlay show={loading} label="Running symbolic scope rules…" />

      <div className="ct-scanner-head">
        <PixelIcon name="scale" size={64} className="ct-scanner-head-icon" />
        <div>
          <p className="ct-scanner-step">Applicability scanner — Step 3</p>
          <p className="ct-scanner-intro">
            Symbolic scope analysis for the regulations you selected — material, territorial, and
            temporal gates per instrument.
          </p>
        </div>
      </div>

      {error && <div className="err">{error}</div>}

      <div className="ct-scope-selected-laws">
        {lawMeta.map((law) => (
          <span key={law.code} className="ct-chip active">
            {law.short}
            {law.engine_mode !== "symbolic" && (
              <span className="ct-scope-chip-note"> · retrieval only</span>
            )}
          </span>
        ))}
      </div>

      {!loading && response && (
        <>
          <div className="ct-scope-summary">
            <h2 className="ct-card-title">Scope summary</h2>
            <table className="ct-table ct-scope-summary-table">
              <thead>
                <tr>
                  <th>Law</th>
                  <th>Number</th>
                  <th>Material</th>
                  <th>Territorial</th>
                  <th>Temporal</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row) => (
                  <tr key={row.code}>
                    <td>{row.short}</td>
                    <td>{row.number}</td>
                    <td>
                      <span className={RESULT_BADGE[row.material] || ""}>{row.material}</span>
                    </td>
                    <td>
                      <span className={RESULT_BADGE[row.territorial] || ""}>{row.territorial}</span>
                    </td>
                    <td>
                      <span className={RESULT_BADGE[row.temporal] || ""}>{row.temporal}</span>
                    </td>
                    <td>{row.verdict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {instruments.length > 0 ? (
            <div className="ct-scope-detail">
              <h2 className="ct-card-title">Symbolic rules trace</h2>
              <ScopeAnalysisPanel
                scopeAnalysis={scopeAnalysis}
                fallbackWorksheet={assessment?.scope}
                defaultViewMode="symbolic"
                hideViewToggle
              />
            </div>
          ) : (
            <p className="ct-muted">
              No symbolic scope results returned for the selected laws. The rules engine may only
              cover GDPR and AI Act today — other instruments show retrieval-only mode until scope
              rules are added.
            </p>
          )}

          {assessment?.open_questions && assessment.open_questions.length > 0 && (
            <div className="ct-scope-questions">
              <h2 className="ct-card-title">Open questions</h2>
              <ul className="ct-scope-question-list">
                {assessment.open_questions.map((q, i) => (
                  <li key={i}>{q.text || q.predicate || q.missing_atom}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <p className="ct-text-link-row">
        <button
          type="button"
          className="ct-text-link ct-text-link-primary ct-link-with-icon"
          disabled={loading}
          onClick={runSymbolicAssess}
        >
          <PixelIcon name="scale" size={36} className="ct-link-icon" />
          {loading ? "Running…" : "Re-run symbolic rules"}
        </button>
        <span className="ct-text-link-sep">·</span>
        <button type="button" className="ct-text-link" onClick={onBackToLaws}>
          Back to law selection
        </button>
        <span className="ct-text-link-sep">·</span>
        <button type="button" className="ct-text-link" onClick={onEditProduct}>
          Edit product
        </button>
      </p>
    </div>
  );
}
