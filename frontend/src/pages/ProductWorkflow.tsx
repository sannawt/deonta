import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseProduct,
  scanRelevantLaws,
  type KgEdge,
  type KgNode,
  type LawScanResult,
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
import { LawScanResults } from "../components/product/LawScanResults";
import { ApplicabilityScopeView } from "../components/product/ApplicabilityScopeView";
import { ThinkingOverlay } from "../components/ui/ThinkingOverlay";
import { PixelIcon } from "../components/ui/PixelIcon";
import { WorkflowStepper } from "../components/product/WorkflowStepper";

type Step = "intake" | "laws" | "scope";

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
  const [description, setDescription] = useState("");
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
  const step1Done = useRef(false);
  const step2Done = useRef(false);

  const hasInput =
    description.trim().length >= 12 || files.length > 0 || kgFacts.length > 0;
  const step2Complete =
    step1Done.current && scanResults.length > 0 && (spec.selectedLaws?.length ?? 0) > 0;

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
        enabled: step1Done.current && hasInput,
        current: current === "laws",
        onClick: () => {
          if (step1Done.current && hasInput) setStep("laws");
        },
      },
      {
        id: "step3",
        label: "Step 3",
        enabled: step2Done.current && step2Complete,
        current: current === "scope",
        onClick: () => {
          if (step2Done.current && step2Complete) setStep("scope");
        },
      },
    ];
  }

  const runParse = useCallback(async (): Promise<boolean> => {
    const text = description.trim();
    if (text.length < 12 && files.length === 0) {
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
  }, [description, files]);

  const runLawScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      const queryText = [description.trim(), spec.summary?.trim()].filter(Boolean).join("\n");
      const data = await scanRelevantLaws({
        description: queryText,
        kg_facts: kgFacts,
        limit: 10,
      });
      const rows = data.results ?? [];
      setScanResults(rows);
      setSpec((s) => ({
        ...s,
        selectedLaws:
          s.selectedLaws?.length
            ? s.selectedLaws.filter((c) => rows.some((r) => r.code === c))
            : rows.slice(0, 3).map((r) => r.code),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Law scan failed");
      setScanResults([]);
    } finally {
      setScanning(false);
    }
  }, [description, spec.summary, kgFacts]);

  function handleCheckApplicability() {
    const selected = spec.selectedLaws ?? [];
    if (!selected.length) {
      setError("Select at least one regulation to check.");
      return;
    }
    setError(null);
    step2Done.current = true;
    setStep("scope");
  }

  async function handleSeeLaws() {
    if (!hasInput) {
      setError("Describe your product or upload a document first.");
      return;
    }
    const ok = await runParse();
    if (!ok) return;
    step1Done.current = true;
    scanStarted.current = false;
    setStep("laws");
  }

  useEffect(() => {
    if (parseTimer.current) clearTimeout(parseTimer.current);
    parseTimer.current = setTimeout(() => {
      runParse();
    }, 700);
    return () => {
      if (parseTimer.current) clearTimeout(parseTimer.current);
    };
  }, [runParse]);

  useEffect(() => {
    if (step !== "laws") return;
    if (scanStarted.current) return;
    scanStarted.current = true;
    void (async () => {
      await runParse();
      await runLawScan();
    })();
  }, [step, runLawScan, runParse]);

  function toggleLaw(code: string) {
    setSpec((s) => {
      const cur = s.selectedLaws ?? [];
      const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
      return { ...s, selectedLaws: next };
    });
  }

  if (step === "scope") {
    return (
      <>
        <WorkflowStepper steps={workflowSteps("scope")} />
        <ApplicabilityScopeView
          selectedLaws={spec.selectedLaws ?? []}
          scanResults={scanResults}
          spec={spec}
          description={description}
          kgFacts={kgFacts}
          playbookCompanyId={playbookCompanyId}
          onComplete={onComplete}
          onBackToLaws={() => setStep("laws")}
          onEditProduct={() => setStep("intake")}
        />
      </>
    );
  }

  if (step === "laws") {
    return (
      <>
        <WorkflowStepper steps={workflowSteps("laws")} />
        <div className="ct-page ct-card-relative">
          <ThinkingOverlay show={scanning} label="Searching legal database…" />
          <div className="ct-scanner-head">
            <PixelIcon name="scale" size={96} className="ct-scanner-head-icon" />
            <div>
              <p className="ct-scanner-step">Step 2</p>
              <p className="ct-scanner-intro">
                Top regulations from the structured legal database ranked by relevance to your
                product. Select laws, then check applicability.
              </p>
            </div>
          </div>
          {error && <div className="err">{error}</div>}
          <LawScanResults
            results={scanResults}
            selectedCodes={spec.selectedLaws ?? []}
            loading={scanning}
            onToggle={toggleLaw}
            onCheckApplicability={handleCheckApplicability}
            onBack={() => setStep("intake")}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <WorkflowStepper steps={workflowSteps("intake")} />
      <div className="ct-page ct-product-flow">
        {error && <div className="err">{error}</div>}

        <div className="ct-product-layout ct-product-layout--boxed">
          <div className="ct-product-layout-left">
            <ProductIntakePanel
              description={description}
              files={files}
              parsing={parsing}
              canContinue={hasInput}
              onDescriptionChange={setDescription}
              onFilesChange={setFiles}
              onSeeLaws={handleSeeLaws}
            />
            {kgFacts.some((f) => f.predicate && f.args?.length) && (
              <div className="ct-product-predicate-facts">
                <h3 className="ct-card-title">Extracted facts</h3>
                <ul className="ct-product-fact-list">
                  {kgFacts
                    .filter((f) => f.predicate && f.args?.length)
                    .slice(0, 12)
                    .map((f) => (
                      <li key={f.id}>
                        <code>{f.value || f.label}</code>
                        {f.source && <span className="ct-muted"> · {f.source}</span>}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
          <ProductKnowledgeGraph nodes={kgNodes} edges={kgEdges} />
        </div>
      </div>
    </>
  );
}
