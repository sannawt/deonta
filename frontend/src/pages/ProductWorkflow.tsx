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
import { ThinkingOverlay } from "../components/ui/ThinkingOverlay";
import { PixelIcon } from "../components/ui/PixelIcon";

type Step = "intake" | "laws";

interface Props {
  playbookCompanyId?: string;
  onComplete: (product: ProductRecord) => void;
  onViewProducts: () => void;
}

function specFromParse(spec: ProductKgResponse["spec"]): ProductSpec {
  return {
    name: spec.name || "",
    summary: spec.summary || "",
    markets: spec.markets || ["EU"],
    processesPersonalData: (spec.processesPersonalData as ProductSpec["processesPersonalData"]) || "unknown",
    euLink: (spec.euLink as ProductSpec["euLink"]) || "unknown",
    aiSystem: (spec.aiSystem as ProductSpec["aiSystem"]) || "unknown",
    selectedLaws: [],
  };
}

export function ProductWorkflow({
  onComplete: _onComplete,
  playbookCompanyId: _playbookCompanyId,
  onViewProducts,
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
    markets: ["EU"],
    processesPersonalData: "unknown",
    euLink: "unknown",
    aiSystem: "unknown",
    selectedLaws: [],
  });
  const parseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanStarted = useRef(false);

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

  const hasInput =
    description.trim().length >= 12 || files.length > 0 || kgFacts.length > 0;

  async function handleSeeLaws() {
    if (!hasInput) {
      setError("Describe your product or upload a document first.");
      return;
    }
    if (kgFacts.length === 0) {
      const ok = await runParse();
      if (!ok) return;
    }
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
    runLawScan();
  }, [step, runLawScan]);

  function toggleLaw(code: string) {
    setSpec((s) => {
      const cur = s.selectedLaws ?? [];
      const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
      return { ...s, selectedLaws: next };
    });
  }

  if (step === "laws") {
    return (
      <div className="ct-page ct-card-relative">
        <ThinkingOverlay show={scanning} label="Searching legal database…" />
        <div className="ct-scanner-head">
          <PixelIcon name="scale" size={48} className="ct-scanner-head-icon" />
          <div>
            <p className="ct-scanner-step">Applicability scanner — Step 2</p>
            <p className="ct-scanner-intro">
              Top regulations from the structured legal database ranked by relevance to your product.
            </p>
          </div>
        </div>
        {error && <div className="err">{error}</div>}
        <LawScanResults
          results={scanResults}
          selectedCodes={spec.selectedLaws ?? []}
          loading={scanning}
          onToggle={toggleLaw}
          onRescan={() => {
            scanStarted.current = true;
            runLawScan();
          }}
        />
        <p className="ct-text-link-row">
          <button type="button" className="ct-text-link" onClick={() => setStep("intake")}>
            Back
          </button>
          <span className="ct-text-link-sep">·</span>
          <button type="button" className="ct-text-link" onClick={onViewProducts}>
            My products
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="ct-page ct-product-flow">
      {error && <div className="err">{error}</div>}

      <div className="ct-product-layout">
        <ProductIntakePanel
          description={description}
          files={files}
          parsing={parsing}
          canContinue={hasInput}
          onDescriptionChange={setDescription}
          onFilesChange={setFiles}
          onSeeLaws={handleSeeLaws}
        />
        <ProductKnowledgeGraph nodes={kgNodes} edges={kgEdges} />
      </div>
    </div>
  );
}
