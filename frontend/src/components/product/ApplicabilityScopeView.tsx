import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { assessProduct, parseProduct, type LawScanResult, type LawScanResponse } from "../../lib/api";
import { ensureAccountId } from "../../lib/account";
import { resolveAssessment } from "../../lib/assessment";
import {
  createProduct,
  type KgFact,
  type ProductRecord,
  type ProductSpec,
} from "../../lib/productStore";
import { ThinkingOverlay } from "../ui/ThinkingOverlay";
import { PixelIcon } from "../ui/PixelIcon";
import { ApplicabilityScopeWorkbench } from "./ApplicabilityScopeWorkbench";
import { buildApplicabilityVerdictSummary } from "../../lib/applicabilityVerdict";
import { instrumentMatchesCode } from "../../lib/applicabilityScan";
import { resolveAssessCodes } from "../../lib/utils";
import type { ChatResponse, ScopeAnalysis } from "../../types/chat";
import {
  assessCacheKey,
  readAssessCache,
  writeAssessCache,
} from "../../lib/prototypeCache";

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
  allScanResults?: LawScanResult[] | null;
  scanResponse?: LawScanResponse | null;
  spec: ProductSpec;
  description: string;
  kgFacts: KgFact[];
  playbookCompanyId?: string;
  onComplete: (product: ProductRecord) => void;
}

export function ApplicabilityScopeView({
  selectedLaws,
  scanResults,
  allScanResults = null,
  scanResponse = null,
  spec,
  description,
  kgFacts,
  playbookCompanyId,
  onComplete,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ChatResponse | null>(null);

  const displayScanResults = allScanResults?.length ? allScanResults : scanResults;

  const payloadRef = useRef({
    spec,
    description,
    kgFacts,
    selectedLaws,
    scanResults,
    playbookCompanyId,
  });
  payloadRef.current = { spec, description, kgFacts, selectedLaws, scanResults, playbookCompanyId };

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const assessCodes = useMemo(
    () => resolveAssessCodes(selectedLaws, scanResults),
    [selectedLaws, scanResults],
  );

  const runSymbolicAssess = useCallback(async () => {
    const {
      spec: currentSpec,
      description: currentDescription,
      kgFacts: currentFacts,
      selectedLaws: rowCodes,
      scanResults: results,
      playbookCompanyId: playbookId,
    } = payloadRef.current;
    const resolvedCodes = resolveAssessCodes(rowCodes, results);
    const cacheKey = assessCacheKey(
      currentDescription.trim(),
      resolvedCodes,
    );
    const cached = readAssessCache(cacheKey);
    if (cached) {
      setResponse(cached);
    }

    setLoading(!cached);
    setError(null);
    try {
      const aid = await ensureAccountId();
      let factsForAssess = currentFacts;
      let assessSpec: ProductSpec = {
        ...currentSpec,
        summary: currentSpec.summary?.trim() || currentDescription.trim(),
        selectedLaws: resolvedCodes,
      };

      if (!currentFacts.length) {
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
        factsForAssess = freshFacts;
        assessSpec = {
          ...assessSpec,
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
      }

      const created = createProduct(assessSpec);
      created.kgFacts = factsForAssess;
      const selectedScanRows = results.filter((r) => rowCodes.includes(r.code));
      const result = await assessProduct({
        spec: { ...assessSpec, regulations: resolvedCodes },
        kg_facts: factsForAssess,
        selected_laws: selectedScanRows,
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
      writeAssessCache(cacheKey, result);
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
  const scopeAnalysis = filterScopeAnalysis(assessment?.scope_analysis, assessCodes);
  const instruments = scopeAnalysis?.instruments ?? [];

  const verdictSummary = useMemo(
    () =>
      buildApplicabilityVerdictSummary({
        spec,
        description,
        selectedLawCodes: selectedLaws,
        scanResults,
        instruments,
        minScanScore: scanResponse?.min_score ?? 0.75,
        narrativeVerdictLine:
          assessment?.conclusion?.verdict_line || response?.narrative?.verdict_line,
        scenarioGist: assessment?.facts?.summary?.scenario_gist,
      }),
    [
      spec,
      description,
      selectedLaws,
      scanResults,
      instruments,
      scanResponse?.min_score,
      assessment?.conclusion?.verdict_line,
      assessment?.facts?.summary?.scenario_gist,
      response?.narrative?.verdict_line,
    ],
  );

  return (
    <div className="ct-page ct-card-relative">
      <ThinkingOverlay show={loading} label="Running per-law scope assessment…" />

      <div className="ct-scanner-head">
        <PixelIcon name="scale" size={64} className="ct-scanner-head-icon" />
        <div>
          <p className="ct-scanner-step">Applicability scanner — Step 3</p>
          <p className="ct-scanner-intro">
            Review scanned laws, per-instrument verdicts, and the facts driving each assessment.
          </p>
        </div>
      </div>

      {error && <div className="err">{error}</div>}

      <ApplicabilityScopeWorkbench
        productTitle={verdictSummary.productTitle}
        productSummary={spec.summary || description}
        scanResults={displayScanResults}
        selectedCodes={selectedLaws}
        tierRows={verdictSummary.rows}
        instruments={instruments}
        openQuestions={assessment?.open_questions}
        scenarioGist={assessment?.facts?.summary?.scenario_gist}
        narrativeVerdictLine={
          assessment?.conclusion?.verdict_line || response?.narrative?.verdict_line
        }
        productSignals={{
          euLink: spec.euLink,
          processesPersonalData: spec.processesPersonalData,
          aiSystem: spec.aiSystem,
          markets: spec.markets,
        }}
        loading={loading}
        playbookCompanyId={playbookCompanyId}
        sessionId={response?.symbolic?.context?.session_id || undefined}
      />
    </div>
  );
}
