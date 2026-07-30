import { useCallback, useEffect, useRef, useState } from "react";
import { scanRelevantLaws, type LawScanResult, type LawScanResponse } from "../lib/api";
import { type ProductRecord } from "../lib/productStore";
import { ProductIntakePanel } from "../components/product/ProductIntakePanel";
import { ProductKnowledgeGraph } from "../components/product/ProductKnowledgeGraph";
import { KgFactsList } from "../components/product/KgFactsList";
import { WorkflowSplitLayout } from "../components/product/WorkflowSplitLayout";
import { LawScanResults } from "../components/product/LawScanResults";
import { ApplicabilityScopeView } from "../components/product/ApplicabilityScopeView";
import { ThinkingOverlay } from "../components/ui/ThinkingOverlay";
import { WorkflowStepper } from "../components/product/WorkflowStepper";
import {
  readScanCache,
  scanCacheKey,
  writeScanCache,
} from "../lib/prototypeCache";
import { pause, SLIDE_TRANSITION_MS } from "../lib/complianceChatFlow";
import { useProductIntake } from "../hooks/useProductIntake";

const PREPARING_STEP_LABEL = "Preparing next step…";

type Step = "intake" | "laws" | "scope";

const EMPTY_LAW_CODES: string[] = [];

interface Props {
  playbookCompanyId?: string;
  onComplete: (product: ProductRecord) => void;
  onNavigateHome: () => void;
}

export function ProductWorkflowLab({
  onComplete,
  playbookCompanyId,
  onNavigateHome: _onNavigateHome,
}: Props) {
  const [step, setStep] = useState<Step>("intake");
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<LawScanResult[]>([]);
  const [allScanResults, setAllScanResults] = useState<LawScanResult[] | null>(null);
  const [scanResponse, setScanResponse] = useState<LawScanResponse | null>(null);
  const [loadingAllResults, setLoadingAllResults] = useState(false);
  const includeSecondary = true;
  const scanStarted = useRef(false);
  const [step1Complete, setStep1Complete] = useState(false);
  const [preparingStep, setPreparingStep] = useState(false);

  const {
    intake,
    patchIntake,
    fieldSources,
    extractSummary,
    files,
    setFiles,
    kgNodes,
    kgEdges,
    kgFacts,
    spec,
    setSpec,
    parsing,
    error,
    setError,
    description,
    hasInput,
    setReviewed,
    runParse,
    scheduleParse,
  } = useProductIntake();

  const waitBeforeNextStep = useCallback(async () => {
    setPreparingStep(true);
    await pause(SLIDE_TRANSITION_MS);
    setPreparingStep(false);
  }, []);

  const step2Ready =
    step1Complete && scanResults.length > 0 && (spec.selectedLaws?.length ?? 0) > 0;

  function buildTopTabs(current: Step) {
    return [
      {
        id: "playbook",
        label: "Company playbook",
        enabled: true,
        current: current === "intake",
        onClick: () => setStep("intake"),
        subTabs: [
          { id: "company", label: "Company", enabled: true, current: current === "intake", onClick: () => setStep("intake") },
          { id: "product", label: "Product", enabled: true, current: false, onClick: () => setStep("intake") },
          { id: "market", label: "Market", enabled: true, current: false, onClick: () => setStep("intake") },
        ],
      },
      {
        id: "scope",
        label: "Scope Analysis",
        enabled: step1Complete && hasInput,
        current: current === "laws" || current === "scope",
        onClick: () => {
          if (current === "laws" || current === "scope") return;
          void goToLawsStep();
        },
        subTabs: [
          {
            id: "laws",
            label: "Laws",
            enabled: step1Complete && hasInput,
            current: current === "laws",
            onClick: () => {
              if (!step1Complete || !hasInput || current === "laws") return;
              void goToLawsStep();
            },
          },
          {
            id: "reasoning",
            label: "Reasoning",
            enabled: step2Ready,
            current: current === "scope",
            onClick: () => {
              if (!step2Ready || current === "scope") return;
              void goToScopeStep();
            },
          },
          { id: "scope-reports", label: "Reports", enabled: step2Ready, current: false, onClick: () => { if (step2Ready) void goToScopeStep(); } },
        ],
      },
      {
        id: "obligations",
        label: "Obligations",
        enabled: false,
        current: false,
        onClick: undefined,
        subTabs: [
          { id: "reporting", label: "Reporting", enabled: false, current: false },
          { id: "design-req", label: "Design requirements", enabled: false, current: false },
          { id: "overlapping", label: "Overlapping", enabled: false, current: false },
        ],
      },
      {
        id: "evidence",
        label: "Evidence",
        enabled: false,
        current: false,
        onClick: undefined,
        subTabs: [
          { id: "ev-reports", label: "Reports", enabled: false, current: false },
          { id: "audits", label: "Audits", enabled: false, current: false },
        ],
      },
      {
        id: "reports",
        label: "Reports",
        enabled: false,
        current: false,
        onClick: undefined,
        subTabs: [],
      },
    ];
  }

  const runLawScan = useCallback(async (secondaryOverride?: boolean) => {
    const includeSec = secondaryOverride ?? includeSecondary;
    const desc = description.trim();
    const cacheKey = scanCacheKey(desc, includeSec);
    const cached = readScanCache(cacheKey);
    if (cached?.results?.length) {
      const rows = cached.results;
      setScanResponse(cached);
      setScanResults(rows);
      setAllScanResults(null);
      setSpec((s) => ({
        ...s,
        selectedLaws:
          s.selectedLaws?.length
            ? s.selectedLaws.filter((c) => rows.some((r) => r.code === c))
            : rows.map((r) => r.code),
      }));
    }
    setScanning(!cached?.results?.length);
    setError(null);
    try {
      let data = await scanRelevantLaws({
        description: description.trim(),
        kg_facts: kgFacts,
        limit: 15,
        min_score: 0.75,
        include_secondary: includeSec,
        full_scan: false,
      });
      if (!data.results?.length && kgFacts.length > 0) {
        data = await scanRelevantLaws({
          description: description.trim(),
          kg_facts: kgFacts,
          limit: 15,
          min_score: 0.6,
          include_secondary: true,
          full_scan: false,
        });
      }
      const rows = data.results ?? [];
      setScanResponse(data);
      setScanResults(rows);
      setAllScanResults(null);
      setSpec((s) => ({
        ...s,
        selectedLaws:
          s.selectedLaws?.length
            ? s.selectedLaws.filter((c) => rows.some((r) => r.code === c))
            : rows.map((r) => r.code),
      }));
      writeScanCache(cacheKey, data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Law scan failed");
      setScanResponse(null);
      setScanResults([]);
      setAllScanResults(null);
    } finally {
      setScanning(false);
    }
  }, [description, includeSecondary, kgFacts, setError, setSpec]);

  const loadAllScanResults = useCallback(async () => {
    if (loadingAllResults || allScanResults) return;
    setLoadingAllResults(true);
    setError(null);
    try {
      const data = await scanRelevantLaws({
        description: description.trim(),
        kg_facts: kgFacts,
        limit: 0,
        min_score: 0.75,
        include_secondary: includeSecondary,
        full_scan: true,
      });
      setAllScanResults(data.results ?? []);
      setScanResponse((prev) =>
        prev
          ? {
              ...prev,
              total_match_count: data.total_match_count ?? data.match_count,
            }
          : data,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load all law matches");
    } finally {
      setLoadingAllResults(false);
    }
  }, [allScanResults, description, includeSecondary, kgFacts, loadingAllResults, setError]);

  async function goToScopeStep() {
    const selected = spec.selectedLaws ?? [];
    if (!selected.length) {
      setError("Select at least one regulation to check.");
      return;
    }
    setError(null);
    await waitBeforeNextStep();
    setStep("scope");
  }

  async function goToLawsStep() {
    if (!hasInput) {
      setError("Fill in product details or upload a document first.");
      return;
    }
    setError(null);
    await waitBeforeNextStep();
    setStep1Complete(true);
    setReviewed(true);
    setStep("laws");
    if (scanStarted.current) return;

    setScanning(true);
    setScanResults([]);
    setScanResponse(null);
    scanStarted.current = true;

    const ok = await runParse();
    if (!ok) {
      setScanning(false);
      scanStarted.current = false;
      return;
    }
    await runLawScan();
  }

  function handleCheckApplicability() {
    void goToScopeStep();
  }

  function handleSeeLaws() {
    void goToLawsStep();
  }

  useEffect(() => {
    if (step !== "intake") return;
    scheduleParse();
  }, [intake, files, step, scheduleParse]);

  useEffect(() => {
    if (step !== "laws") return;
    if (scanStarted.current) return;
    scanStarted.current = true;
    void (async () => {
      setScanning(true);
      setScanResults([]);
      setScanResponse(null);
      setError(null);
      const ok = await runParse();
      if (!ok) {
        setScanning(false);
        scanStarted.current = false;
        return;
      }
      await runLawScan();
    })();
  }, [step, runLawScan, runParse, setError]);

  if (step === "scope") {
    return (
      <>
        <ThinkingOverlay show={preparingStep} label={PREPARING_STEP_LABEL} />
        <WorkflowStepper topTabs={buildTopTabs("scope")} />
        <div className="ct-page ct-scope-page">
          <ApplicabilityScopeView
            selectedLaws={spec.selectedLaws ?? EMPTY_LAW_CODES}
            scanResults={scanResults}
            allScanResults={allScanResults}
            scanResponse={scanResponse}
            spec={spec}
            description={description}
            kgFacts={kgFacts}
            playbookCompanyId={playbookCompanyId}
            onComplete={onComplete}
          />
        </div>
      </>
    );
  }

  if (step === "laws") {
    return (
      <>
        <ThinkingOverlay show={preparingStep} label={PREPARING_STEP_LABEL} />
        <WorkflowStepper topTabs={buildTopTabs("laws")} />
        <div className={`ct-page ct-product-flow${scanning ? " ct-law-scan-loading" : ""}`}>
          <ThinkingOverlay show={scanning && !preparingStep} label={PREPARING_STEP_LABEL} />
          {!scanning && (
            <>
              {error && <div className="err">{error}</div>}
              <LawScanResults
                scanResponse={scanResponse}
                results={scanResults}
                allResults={allScanResults}
                loadingAll={loadingAllResults}
                onLoadAll={loadAllScanResults}
                selectedCodes={spec.selectedLaws ?? []}
                loading={false}
                onCheckApplicability={handleCheckApplicability}
                onBack={() => setStep("intake")}
              />
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <ThinkingOverlay show={preparingStep} label={PREPARING_STEP_LABEL} />
      <WorkflowStepper topTabs={buildTopTabs("intake")} />
      <div className="ct-page ct-product-flow">
        {error && <div className="err">{error}</div>}

        <WorkflowSplitLayout
          stepLabel=""
          title=""
          intro=""
          actionsTitle=""
          resultsTitle="Knowledge graph"
          actionsAriaLabel="Product intake"
          resultsAriaLabel="Knowledge graph"
          actions={
            <ProductIntakePanel
              intake={intake}
              fieldSources={fieldSources}
              extractSummary={extractSummary}
              files={files}
              parsing={parsing}
              canContinue={hasInput}
              onIntakeChange={patchIntake}
              onFilesChange={setFiles}
              onRunParse={runParse}
              onSeeLaws={handleSeeLaws}
            />
          }
          results={
            <div className="ct-intake-graph-column">
              <div className="ct-intake-graph-area">
                <ProductKnowledgeGraph nodes={kgNodes} edges={kgEdges} />
              </div>
              <KgFactsList facts={kgFacts} />
            </div>
          }
        />
      </div>
    </>
  );
}
