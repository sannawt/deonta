import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseProduct,
  scanRelevantLaws,
  type KgEdge,
  type KgNode,
  type LawScanResult,
  type LawScanResponse,
  type ProductKgResponse,
} from "../lib/api";
import { ensureAccountId } from "../lib/account";
import {
  type ProductRecord,
  type ProductSpec,
  type KgFact,
} from "../lib/productStore";
import { ProductIntakePanel } from "../components/product/ProductIntakePanel";
import { ProductKnowledgeGraph } from "../components/product/ProductKnowledgeGraph";
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
import {
  buildIntakeDescription,
  hasIntakeInput,
} from "../lib/productIntake";

const PREPARING_STEP_LABEL = "Preparing next step…";

type Step = "intake" | "laws" | "scope";

const EMPTY_LAW_CODES: string[] = [];

interface Props {
  playbookCompanyId?: string;
  onComplete: (product: ProductRecord) => void;
  onNavigateHome: () => void;
}

function specFromParse(spec: ProductKgResponse["spec"]): ProductSpec {
  return {
    name: spec.name || "",
    summary: spec.summary || "",
    markets: spec.markets || [],
    processesPersonalData: (spec.processesPersonalData as ProductSpec["processesPersonalData"]) || "unknown",
    euLink: (spec.euLink as ProductSpec["euLink"]) || "unknown",
    aiSystem: (spec.aiSystem as ProductSpec["aiSystem"]) || "unknown",
    selectedLaws: [],
  };
}

export function ProductWorkflow({
  onComplete,
  playbookCompanyId,
  onNavigateHome,
}: Props) {
  const [step, setStep] = useState<Step>("intake");
  const [scanning, setScanning] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<LawScanResult[]>([]);
  const [allScanResults, setAllScanResults] = useState<LawScanResult[] | null>(null);
  const [scanResponse, setScanResponse] = useState<LawScanResponse | null>(null);
  const [loadingAllResults, setLoadingAllResults] = useState(false);
  const includeSecondary = true;
  const [productInfo, setProductInfo] = useState("");
  const [marketsAndLocation, setMarketsAndLocation] = useState("");
  const description = buildIntakeDescription(productInfo, marketsAndLocation);
  const [files, setFiles] = useState<File[]>([]);
  const [kgNodes, setKgNodes] = useState<KgNode[]>([]);
  const [kgEdges, setKgEdges] = useState<KgEdge[]>([]);
  const [kgFacts, setKgFacts] = useState<KgFact[]>([]);
  const [spec, setSpec] = useState<ProductSpec>({
    name: "",
    summary: "",
    markets: [],
    processesPersonalData: "unknown",
    euLink: "unknown",
    aiSystem: "unknown",
    selectedLaws: [],
  });
  const parseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanStarted = useRef(false);
  const [step1Complete, setStep1Complete] = useState(false);
  const [preparingStep, setPreparingStep] = useState(false);

  const waitBeforeNextStep = useCallback(async () => {
    setPreparingStep(true);
    await pause(SLIDE_TRANSITION_MS);
    setPreparingStep(false);
  }, []);

  const hasInput = hasIntakeInput(
    productInfo,
    marketsAndLocation,
    files.length,
    kgFacts.length,
  );
  const step2Ready =
    step1Complete && scanResults.length > 0 && (spec.selectedLaws?.length ?? 0) > 0;

  function workflowSteps(current: Step) {
    return [
      {
        id: "start",
        label: "Start",
        enabled: true,
        current: false,
        onClick: onNavigateHome,
      },
      {
        id: "step1",
        label: "Step 1",
        enabled: true,
        current: current === "intake",
        onClick: () => setStep("intake"),
      },
      {
        id: "step2",
        label: "Step 2",
        enabled: step1Complete && hasInput,
        current: current === "laws",
        onClick: () => {
          if (!step1Complete || !hasInput || current === "laws") return;
          void goToLawsStep();
        },
      },
      {
        id: "step3",
        label: "Step 3",
        enabled: step2Ready,
        current: current === "scope",
        onClick: () => {
          if (!step2Ready || current === "scope") return;
          void goToScopeStep();
        },
      },
    ];
  }

  const runParse = useCallback(async (): Promise<boolean> => {
    if (!hasIntakeInput(productInfo, marketsAndLocation, files.length, 0)) {
      setKgNodes([]);
      setKgEdges([]);
      setKgFacts([]);
      return false;
    }
    setParsing(true);
    setError(null);
    try {
      await ensureAccountId();
      const kg = await parseProduct({
        description,
        files: files.length ? files : undefined,
      });
      setKgNodes(kg.nodes ?? []);
      setKgEdges(kg.edges ?? []);
      setKgFacts(
        (kg.facts ?? []).map((f) => ({
          id: f.id,
          label: f.label,
          value: f.value,
          source: f.provenance || f.source,
          predicate: f.predicate,
          args: f.args,
        }))
      );
      if (kg.spec) {
        setSpec((s) => ({ ...specFromParse(kg.spec), selectedLaws: s.selectedLaws }));
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build graph");
      return false;
    } finally {
      setParsing(false);
    }
  }, [description, files, productInfo, marketsAndLocation]);

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
      const data = await scanRelevantLaws({
        description: description.trim(),
        kg_facts: [],
        limit: 15,
        min_score: 0.75,
        include_secondary: includeSec,
        full_scan: false,
      });
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
  }, [description, includeSecondary]);

  const loadAllScanResults = useCallback(async () => {
    if (loadingAllResults || allScanResults) return;
    setLoadingAllResults(true);
    setError(null);
    try {
      const data = await scanRelevantLaws({
        description: description.trim(),
        kg_facts: [],
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
  }, [
    allScanResults,
    description,
    includeSecondary,
    loadingAllResults,
  ]);

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
      setError("Add product details, customer locations, or upload a document first.");
      return;
    }
    setError(null);
    await waitBeforeNextStep();
    setStep1Complete(true);
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

  async function handleSeeLaws() {
    await goToLawsStep();
  }

  useEffect(() => {
    if (step !== "intake") return;
    if (parseTimer.current) clearTimeout(parseTimer.current);
    parseTimer.current = setTimeout(() => {
      runParse();
    }, 700);
    return () => {
      if (parseTimer.current) clearTimeout(parseTimer.current);
    };
  }, [runParse, step]);

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
  }, [step, runLawScan, runParse]);

  if (step === "scope") {
    return (
      <>
        <ThinkingOverlay show={preparingStep} label={PREPARING_STEP_LABEL} />
        <WorkflowStepper steps={workflowSteps("scope")} />
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
        <WorkflowStepper steps={workflowSteps("laws")} />
        <div className={`ct-page ct-card-relative${scanning ? " ct-law-scan-loading" : ""}`}>
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
      <WorkflowStepper steps={workflowSteps("intake")} />
        <div className="ct-page ct-product-flow">
        {error && <div className="err">{error}</div>}

        <WorkflowSplitLayout
          stepLabel="Step 1"
          intro="Tell us about your product step by step. Results update on the right as you go."
          icon="productConsole"
          actionsAriaLabel="Product intake"
          resultsAriaLabel="Knowledge graph"
          actions={
            <ProductIntakePanel
              productInfo={productInfo}
              marketsAndLocation={marketsAndLocation}
              files={files}
              parsing={parsing}
              canContinue={hasInput}
              onProductInfoChange={setProductInfo}
              onMarketsAndLocationChange={setMarketsAndLocation}
              onFilesChange={setFiles}
              onSeeLaws={handleSeeLaws}
            />
          }
          results={<ProductKnowledgeGraph nodes={kgNodes} edges={kgEdges} />}
        />
      </div>
    </>
  );
}
