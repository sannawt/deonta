import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assessProduct,
  assessScopeRules,
  fetchSymbolicLaws,
  scanRelevantLaws,
  type LawScanResponse,
  type LawScanResult,
  type SymbolicLawItem,
} from "../../lib/api";
import { resolveAssessment } from "../../lib/assessment";
import {
  buildApplicabilityVerdictSummary,
} from "../../lib/applicabilityVerdict";
import {
  buildDiscoveredItems,
  buildScopeRuleItems,
  defaultFocusedRowCode,
  filterDiscoveryCodes,
  instrumentMatchesCode,
  isSymbolicCode,
  lawsEligibleForObligations,
} from "../../lib/applicabilityScan";
import { lawNameFromScannedItem } from "../../lib/lawDisplayName";
import {
  createProduct,
  type KgFact,
  type ProductRecord,
  type ProductSpec,
} from "../../lib/productStore";
import { ensureScopeInstruments } from "../../lib/scopeFallback";
import type { ChatResponse } from "../../types/chat";
import { assessCacheKey, readAssessCache, writeAssessCache } from "../../lib/prototypeCache";
import { suggestAssessmentTitle } from "../../lib/assessmentRef";
import { ApplicabilityLawAccordion } from "./ApplicabilityLawAccordion";
import { DiscoveredLawsPanel } from "./DiscoveredLawsPanel";
import { LawScanLawDetail } from "./LawScanLawDetail";
import { ScopeLegalBasisInspector } from "./ScopeLegalBasisInspector";
import { ScopeRulesPanel } from "./ScopeRulesPanel";
import { ThinkingOverlay } from "../ui/ThinkingOverlay";
import { WorkflowSplitLayout } from "./WorkflowSplitLayout";
import type { ScopeDimensionId } from "../../lib/scopeLegalBasis";

interface Props {
  spec: ProductSpec;
  description: string;
  kgFacts: KgFact[];
  playbookCompanyId?: string;
  playbookId?: string;
  assessmentId: string;
  assessmentLabel: string;
  onAssessmentLabelChange: (label: string) => void;
  titleSuggested?: boolean;
  initialAssessment?: ChatResponse | null;
  initialScanResults?: LawScanResult[];
  initialScanResponse?: LawScanResponse | null;
  onComplete: (product: ProductRecord) => void;
  onContinueToWorksheet: (payload: {
    lawCodes: string[];
    scanResults: import("../../lib/api").LawScanResult[];
    symbolicLaws: import("../../lib/api").SymbolicLawItem[];
    symbolicCodes: string[];
    includedDiscovery: string[];
  }) => void;
  onAdvanceStateChange?: (state: {
    canAdvance: boolean;
    busy: boolean;
    advance: () => void;
  }) => void;
  /** Which track to emphasize in the left rail. */
  phase?: "laws" | "scope";
}

function scrollToDimension(dimensionId: ScopeDimensionId) {
  const el = document.getElementById(`ct-scope-dim-${dimensionId}`);
  el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

export function ApplicabilityStep({
  spec,
  description,
  kgFacts,
  playbookCompanyId,
  playbookId,
  assessmentId,
  assessmentLabel,
  onAssessmentLabelChange,
  titleSuggested = false,
  initialAssessment,
  initialScanResults,
  initialScanResponse,
  onComplete,
  onContinueToWorksheet,
  onAdvanceStateChange,
  phase = "scope",
}: Props) {
  const [symbolicLaws, setSymbolicLaws] = useState<SymbolicLawItem[]>([]);
  const [symbolicCodes, setSymbolicCodes] = useState<string[]>([]);
  const [scanResults, setScanResults] = useState<LawScanResult[]>(initialScanResults ?? []);
  const [scanResponse, setScanResponse] = useState<LawScanResponse | null>(
    initialScanResponse ?? null,
  );
  const [includedDiscovery, setIncludedDiscovery] = useState<string[]>(() =>
    filterDiscoveryCodes(spec.selectedLaws ?? []),
  );
  const [assessResponse, setAssessResponse] = useState<ChatResponse | null>(
    initialAssessment ?? null,
  );
  const [scanning, setScanning] = useState(!initialScanResults?.length);
  const [assessingRules, setAssessingRules] = useState(!initialAssessment);
  const [assessingDiscovery, setAssessingDiscovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [focusedCode, setFocusedCode] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedProvisionId, setSelectedProvisionId] = useState<string | null>(null);

  const loadedRef = useRef(false);
  const assessRunRef = useRef(0);

  const assessment = resolveAssessment(assessResponse);
  const instruments = useMemo(() => {
    const raw = assessment?.scope_analysis?.instruments ?? [];
    const allCodes = [...symbolicCodes, ...includedDiscovery];
    return ensureScopeInstruments(raw, allCodes, scanResults, spec);
  }, [assessment, symbolicCodes, includedDiscovery, scanResults, spec]);

  const verdictSummary = useMemo(
    () =>
      buildApplicabilityVerdictSummary({
        spec,
        description,
        selectedLawCodes: [...symbolicCodes, ...includedDiscovery],
        scanResults,
        instruments,
        minScanScore: scanResponse?.min_score ?? 0.75,
        narrativeVerdictLine:
          assessment?.conclusion?.verdict_line || assessResponse?.narrative?.verdict_line,
        scenarioGist: assessment?.facts?.summary?.scenario_gist,
      }),
    [spec, description, symbolicCodes, includedDiscovery, scanResults, instruments, scanResponse, assessment, assessResponse],
  );

  const scopeRuleItems = useMemo(
    () =>
      buildScopeRuleItems({
        symbolicCodes: symbolicCodes.length ? symbolicCodes : ["gdpr", "ai_act"],
        symbolicLaws,
        instruments,
        tierRows: verdictSummary.rows,
        assessing: assessingRules,
      }),
    [symbolicCodes, symbolicLaws, instruments, verdictSummary.rows, assessingRules],
  );

  const discoveredItems = useMemo(
    () =>
      buildDiscoveredItems({
        scanResults,
        includedCodes: includedDiscovery,
        tierRows: verdictSummary.rows,
        instruments,
      }),
    [scanResults, includedDiscovery, verdictSummary.rows, instruments],
  );

  const allItems = useMemo(
    () => [...scopeRuleItems, ...discoveredItems],
    [scopeRuleItems, discoveredItems],
  );

  useEffect(() => {
    if (focusedCode && allItems.some((i) => i.rowCode === focusedCode)) return;
    setFocusedCode(defaultFocusedRowCode(allItems));
  }, [allItems, focusedCode]);

  const focusedItem =
    allItems.find((i) => i.rowCode === focusedCode) ?? scopeRuleItems[0] ?? discoveredItems[0];

  const focusedInstrument = focusedItem
    ? instruments.find((inst) =>
        instrumentMatchesCode(inst, focusedItem.scanRow?.catalog_code || focusedItem.rowCode),
      )
    : undefined;

  const persistProduct = useCallback(
    (response: ChatResponse) => {
      const assessSpec: ProductSpec = {
        ...spec,
        summary: spec.summary?.trim() || description.trim(),
        selectedLaws: includedDiscovery,
      };
      const product = createProduct(assessSpec, { id: assessmentId, label: assessmentLabel });
      product.kgFacts = kgFacts;
      product.playbook_id = playbookId;
      product.lastAssessment = {
        created_at: Date.now(),
        prompt: assessSpec.summary,
        response,
      };
      onComplete(product);
    },
    [spec, description, includedDiscovery, kgFacts, assessmentId, assessmentLabel, onComplete, playbookId],
  );

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    void (async () => {
      setError(null);
      setScanError(null);
      setScanning(!initialScanResults?.length);
      setAssessingRules(!initialAssessment);

      try {
        const sym = await fetchSymbolicLaws();
        setSymbolicLaws(sym);
        setSymbolicCodes(sym.map((l) => l.code));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load scope rules");
        setScanning(false);
        setAssessingRules(false);
        return;
      }

      const rulesPromise = initialAssessment
        ? Promise.resolve(initialAssessment)
        : assessScopeRules({
            spec: { ...spec, summary: spec.summary || description },
            kg_facts: kgFacts,
            case_id: assessmentId,
            playbook_id: playbookId,
          });

      const scanPromise = initialScanResults?.length
        ? Promise.resolve({
            results: initialScanResults,
            ...(initialScanResponse ?? {}),
          } as LawScanResponse)
        : scanRelevantLaws({
            description: description.trim(),
            kg_facts: kgFacts,
            limit: 15,
            min_score: 0.75,
            include_secondary: true,
          }).catch((e: unknown): LawScanResponse => {
            const message = e instanceof Error ? e.message : "Law scan failed";
            setScanError(message);
            return {
              version: 1,
              scan_query: description.trim(),
              backend: "unavailable",
              results: [],
            };
          });

      try {
        const [rulesData, scanData] = await Promise.all([rulesPromise, scanPromise]);

        const discoveryRows = (scanData.results ?? []).filter(
          (r) => !isSymbolicCode(r.catalog_code || r.code),
        );
        setScanResults(discoveryRows);
        setScanResponse(scanData);
        if (scanData.symbolic_codes?.length) {
          setSymbolicCodes(scanData.symbolic_codes);
        }

        setAssessResponse(rulesData);
        if (!initialAssessment) {
          persistProduct(rulesData);
        }
        if (titleSuggested) {
          const gist = resolveAssessment(rulesData)?.facts?.summary?.scenario_gist;
          const suggested = suggestAssessmentTitle({
            productName: spec.name,
            productSummary: spec.summary || description,
            scenarioGist: gist,
          });
          if (suggested) onAssessmentLabelChange(suggested);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Applicability step failed");
      } finally {
        setScanning(false);
        setAssessingRules(false);
      }
    })();
  }, []);

  const runDiscoveryAssess = useCallback(
    async (codes: string[]) => {
      const runId = ++assessRunRef.current;
      setAssessingDiscovery(true);
      setError(null);
      try {
        const cacheKey = assessCacheKey(description.trim(), codes);
        const cached = readAssessCache(cacheKey);
        let result = cached;
        if (!result) {
          result = await assessProduct({
            spec: {
              ...spec,
              summary: spec.summary || description,
              regulations: codes,
            },
            kg_facts: kgFacts,
            selected_laws: scanResults.filter((r) => codes.includes(r.code)),
            playbook_company_id: playbookCompanyId,
            playbook_id: playbookId,
            case_id: assessmentId,
          });
          writeAssessCache(cacheKey, result);
        }
        if (runId !== assessRunRef.current) return;
        setAssessResponse(result);
        persistProduct(result);
      } catch (e) {
        if (runId !== assessRunRef.current) return;
        setError(e instanceof Error ? e.message : "Discovery assessment failed");
      } finally {
        if (runId === assessRunRef.current) setAssessingDiscovery(false);
      }
    },
    [assessmentId, description, kgFacts, persistProduct, playbookCompanyId, playbookId, scanResults, spec],
  );

  const handleToggleDiscovery = useCallback(
    (code: string) => {
      setIncludedDiscovery((prev) => {
        const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
        void runDiscoveryAssess(next);
        return next;
      });
    },
    [runDiscoveryAssess],
  );

  const canContinue = lawsEligibleForObligations(allItems).length > 0;
  const busy = scanning || assessingRules;

  const advanceToWorksheet = useCallback(() => {
    onContinueToWorksheet({
      lawCodes: lawsEligibleForObligations(allItems),
      scanResults,
      symbolicLaws,
      symbolicCodes,
      includedDiscovery,
    });
  }, [allItems, includedDiscovery, onContinueToWorksheet, scanResults, symbolicCodes, symbolicLaws]);

  useEffect(() => {
    onAdvanceStateChange?.({
      canAdvance: phase === "laws" ? !scanning : canContinue,
      busy,
      advance: advanceToWorksheet,
    });
  }, [advanceToWorksheet, busy, canContinue, onAdvanceStateChange, phase, scanning]);

  const rightTitle = focusedItem
    ? lawNameFromScannedItem(focusedItem)
    : phase === "laws"
      ? "Relevant laws"
      : "Scope analysis";

  const rightBody = !focusedItem ? (
    <div className="ct-workflow-results-empty">
      <p className="ct-muted">
        {phase === "laws"
          ? "Select a discovered law on the left to review it."
          : "Select a law on the left to read its assessment."}
      </p>
    </div>
  ) : focusedInstrument || isSymbolicCode(focusedItem.rowCode) ? (
    <ApplicabilityLawAccordion
      item={focusedItem}
      instrument={focusedInstrument}
      openQuestions={assessment?.open_questions}
      collapsible={false}
      defaultOpen
      onCitationSelect={(id) => {
        setSelectedProvisionId(id);
        setInspectorOpen(true);
      }}
      onViewLegalBasis={() => setInspectorOpen(true)}
    />
  ) : (
    <LawScanLawDetail
      row={focusedItem.scanRow ?? null}
      scanResponse={scanResponse}
      shownCount={discoveredItems.length}
      compact
    />
  );

  return (
    <div className="ct-applicability-step">
      <ThinkingOverlay show={busy} label="Assessing applicability…" />
      {error ? <div className="err">{error}</div> : null}
      {scanError && !error ? (
        <div className="ct-muted ct-applicability-scan-note">
          Discovery scan unavailable: {scanError}. Scope rules are still evaluated below.
        </div>
      ) : null}
      {assessingDiscovery ? (
        <div className="ct-muted ct-applicability-scan-note">Updating discovered laws…</div>
      ) : null}

      <WorkflowSplitLayout
        stepLabel=""
        title=""
        intro=""
        actionsTitle=""
        resultsTitle={rightTitle}
        actionsAriaLabel="Applicability assessment"
        resultsAriaLabel="Applicability detail"
        actions={
          <div className="ct-applicability-tracks">
            {phase === "scope" ? (
              <ScopeRulesPanel
                items={scopeRuleItems}
                focusedCode={focusedCode}
                onSelect={setFocusedCode}
              />
            ) : null}
            <DiscoveredLawsPanel
              items={discoveredItems}
              focusedCode={focusedCode}
              loading={scanning}
              onSelect={setFocusedCode}
              onToggleInclude={handleToggleDiscovery}
            />
          </div>
        }
        results={<div className="ct-workflow-results-stack">{rightBody}</div>}
        detail={
          inspectorOpen && focusedItem && (focusedInstrument || isSymbolicCode(focusedItem.rowCode)) ? (
            <ScopeLegalBasisInspector
              lawTitle={lawNameFromScannedItem(focusedItem)}
              instrument={focusedInstrument}
              regKey={
                focusedInstrument?.reg_key ||
                focusedItem.scanRow?.catalog_code ||
                focusedItem.rowCode
              }
              selectedProvisionId={selectedProvisionId}
              onSelectProvision={setSelectedProvisionId}
              onDimensionClick={scrollToDimension}
              onClose={() => setInspectorOpen(false)}
            />
          ) : undefined
        }
      />
    </div>
  );
}
