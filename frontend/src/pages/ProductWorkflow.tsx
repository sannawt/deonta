import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchHealth,
  parseProduct,
  scanRelevantLaws,
  sendChat,
  sendWorkflowChat,
  type KgEdge,
  type KgNode,
  type LawScanResult,
  type LawScanResponse,
  type ProductKgResponse,
  type WorkflowChatStage,
} from "../lib/api";
import { ProductKnowledgeGraph } from "../components/product/ProductKnowledgeGraph";
import { ensureAccountId } from "../lib/account";
import {
  type ProductRecord,
  type ProductSpec,
  type KgFact,
} from "../lib/productStore";
import { ApplicabilityScopeView } from "../components/product/ApplicabilityScopeView";
import { PixelIcon } from "../components/ui/PixelIcon";
import {
  ProductWorkflowChat,
  type WorkflowChatMessage,
} from "../components/product/ProductWorkflowChat";
import {
  readScanCache,
  scanCacheKey,
  writeScanCache,
} from "../lib/prototypeCache";
type Phase = "intake" | "laws" | "scope";

interface Props {
  playbookCompanyId?: string;
  onComplete: (product: ProductRecord) => void;
  onNavigateHome: () => void;
}

const WELCOME_MESSAGE: WorkflowChatMessage = {
  id: "welcome",
  role: "assistant",
  kind: "text",
  content:
    "Describe your product or service and I'll scan EU regulations that may apply.",
};

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
  const [phase, setPhase] = useState<Phase>("intake");
  const [messages, setMessages] = useState<WorkflowChatMessage[]>([WELCOME_MESSAGE]);
  const [chatInput, setChatInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<LawScanResult[]>([]);
  const [allScanResults, setAllScanResults] = useState<LawScanResult[] | null>(null);
  const [scanResponse, setScanResponse] = useState<LawScanResponse | null>(null);
  const [loadingAllResults, setLoadingAllResults] = useState(false);
  const [includeSecondary, setIncludeSecondary] = useState(true);
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [kgFacts, setKgFacts] = useState<KgFact[]>([]);
  const [kgNodes, setKgNodes] = useState<KgNode[]>([]);
  const [kgEdges, setKgEdges] = useState<KgEdge[]>([]);
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);
  const [sendingScopeChat, setSendingScopeChat] = useState(false);
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
  const lawScanMessageId = useRef<string | null>(null);
  const chatSessionRef = useRef(`workflow-${Date.now()}`);

  const requestAssistantCopy = useCallback(
    async (
      stage: WorkflowChatStage,
      context: {
        user_message?: string;
        product_summary?: string;
        selected_laws?: string[];
        law_scan_results?: LawScanResult[];
      } = {},
    ): Promise<string> => {
      try {
        const res = await sendWorkflowChat({
          stage,
          user_message: context.user_message,
          product_summary: context.product_summary,
          selected_laws: context.selected_laws,
          law_scan_results: context.law_scan_results,
        });
        return res.assistant_text;
      } catch {
        return "";
      }
    },
    [],
  );

  const appendAssistantText = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `a-${Date.now()}`,
        role: "assistant",
        kind: "text",
        content,
      },
    ]);
  }, []);

  const upsertLawScanMessage = useCallback((intro: string) => {
    const id = lawScanMessageId.current || `law-scan-${Date.now()}`;
    lawScanMessageId.current = id;
    setMessages((prev) => {
      const without = prev.filter((m) => m.id !== id);
      return [
        ...without,
        { id, role: "assistant", kind: "law-scan", content: intro },
      ];
    });
  }, []);

  const runParse = useCallback(async (): Promise<{ ok: boolean; summary: string }> => {
    const text = description.trim();
    if (text.length < 12 && files.length === 0) {
      setKgFacts([]);
      setKgNodes([]);
      setKgEdges([]);
      return { ok: false, summary: "" };
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
      let summary = description.trim();
      if (kg.spec) {
        const parsed = specFromParse(kg.spec);
        setSpec((s) => ({ ...parsed, selectedLaws: s.selectedLaws }));
        summary = parsed.summary || summary;
      }
      return { ok: true, summary };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not parse product description");
      return { ok: false, summary: "" };
    } finally {
      setParsing(false);
    }
  }, [description, files]);

  const runLawScan = useCallback(async (secondaryOverride?: boolean, productSummary?: string) => {
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
      setPhase("laws");
      const summary = productSummary || spec.summary || description;
      const intro =
        (await requestAssistantCopy("law_scan_intro", {
          product_summary: summary,
          selected_laws: rows.map((r) => r.code),
          law_scan_results: rows,
        })) ||
        (rows.length
          ? `I found ${rows.length} regulation${rows.length === 1 ? "" : "s"} that may apply. Adjust the selection, then check applicability.`
          : "I could not find regulations above the relevance threshold. Try a longer description or add more product detail.");
      upsertLawScanMessage(intro);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Law scan failed");
      setScanResponse(null);
      setScanResults([]);
      setAllScanResults(null);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          kind: "text",
          content: e instanceof Error ? e.message : "Law scan failed",
        },
      ]);
    } finally {
      setScanning(false);
    }
  }, [description, includeSecondary, requestAssistantCopy, spec.summary, upsertLawScanMessage]);

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

  const startLawScan = useCallback(async (userMessage?: string) => {
    setScanning(true);
    setScanResults([]);
    setScanResponse(null);
    setAllScanResults(null);
    setError(null);
    const parsed = await runParse();
    if (!parsed.ok) {
      setScanning(false);
      return;
    }
    const ack =
      (await requestAssistantCopy("intake_ack", {
        user_message: userMessage || description,
        product_summary: parsed.summary || description,
      })) ||
      "Thanks — I'm reading your description and scanning relevant EU law.";
    appendAssistantText(ack);
    await runLawScan(undefined, parsed.summary || description);
  }, [appendAssistantText, description, requestAssistantCopy, runLawScan, runParse]);

  async function handleCheckApplicability() {
    const selected = spec.selectedLaws ?? [];
    if (!selected.length) {
      setError("Select at least one regulation to check.");
      return;
    }
    setError(null);
    setPhase("scope");
    const intro =
      (await requestAssistantCopy("scope_start", {
        product_summary: spec.summary || description,
        selected_laws: selected,
        law_scan_results: scanResults,
      })) ||
      `Here is the scope analysis for ${selected.length} selected instrument${selected.length === 1 ? "" : "s"}.`;
    appendAssistantText(intro);
  }

  async function handleSend() {
    const text = chatInput.trim();
    if (!text && !files.length) return;

    const userContent = text || `Uploaded: ${files.map((f) => f.name).join(", ")}`;
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", kind: "text", content: userContent },
    ]);

    if (text) {
      setDescription(text);
      setChatInput("");
    }

    const nextDescription = text || description;
    if (nextDescription.trim().length < 12 && !files.length) {
      setError("Add a bit more detail about your product (at least a sentence).");
      return;
    }

    setError(null);

    if (phase === "scope") {
      setSendingScopeChat(true);
      try {
        const res = await sendChat({
          question: [
            `Product: ${spec.name || spec.summary || description}`,
            spec.summary ? `Summary: ${spec.summary.slice(0, 600)}` : "",
            `Selected laws: ${(spec.selectedLaws ?? []).join(", ")}`,
            "",
            `User question: ${text}`,
          ]
            .filter(Boolean)
            .join("\n"),
          session_id: chatSessionRef.current,
          playbook_company_id: playbookCompanyId,
        });
        const reply =
          res.assistant_text?.trim() ||
          res.assessment?.conclusion?.verdict_line?.trim() ||
          res.narrative?.verdict_line?.trim() ||
          res.narrative?.full_analysis?.trim() ||
          "I could not generate a reply. Try rephrasing your question.";
        appendAssistantText(reply);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Chat request failed";
        setError(msg);
        appendAssistantText(msg);
      } finally {
        setSendingScopeChat(false);
      }
      return;
    }

    const looksLikeQuestion = /\?\s*$/.test(text) || /^(what|why|how|explain|tell me)\b/i.test(text);
    if (phase === "laws" && looksLikeQuestion) {
      const reply =
        (await requestAssistantCopy("follow_up", {
          user_message: text,
          product_summary: spec.summary || description,
          selected_laws: spec.selectedLaws,
          law_scan_results: scanResults,
        })) ||
        "I can help clarify the scan — add more product detail and send again to refresh matches.";
      appendAssistantText(reply);
      return;
    }

    if (phase === "intake" || phase === "laws") {
      await startLawScan(text);
    }
  }

  function handleInputChange(value: string) {
    setChatInput(value);
    if (phase === "intake") setDescription(value);
  }

  useEffect(() => {
    void (async () => {
      try {
        const health = await fetchHealth();
        const configured = Boolean(health.llm?.openai_configured);
        setLlmConfigured(configured);
        if (configured) {
          const welcome = await requestAssistantCopy("welcome");
          if (welcome) {
            setMessages([
              { id: "welcome", role: "assistant", kind: "text", content: welcome },
            ]);
          }
        }
      } catch {
        setLlmConfigured(false);
      }
    })();
  }, [requestAssistantCopy]);

  useEffect(() => {
    if (phase !== "intake") return;
    if (parseTimer.current) clearTimeout(parseTimer.current);
    parseTimer.current = setTimeout(() => {
      void runParse();
    }, 700);
    return () => {
      if (parseTimer.current) clearTimeout(parseTimer.current);
    };
  }, [runParse, phase]);

  function toggleLaw(code: string) {
    setSpec((s) => {
      const cur = s.selectedLaws ?? [];
      return {
        ...s,
        selectedLaws: cur.includes(code)
          ? cur.filter((c) => c !== code)
          : [...cur, code],
      };
    });
  }

  const chatPlaceholder =
    phase === "scope"
      ? "Ask about scope, missing facts, or a specific law…"
      : phase === "laws"
        ? "Add product detail or send to refresh the law scan…"
        : "Describe your product or service…";

  const canSend =
    phase === "scope"
      ? chatInput.trim().length > 0
      : chatInput.trim().length >= 12 || files.length > 0;

  return (
    <div className="ct-page ct-product-flow">
      <header className="ct-scanner-head">
        <PixelIcon name="productConsole" size={96} className="ct-scanner-head-icon" />
        <div className="ct-scanner-head-text">
          <p className="ct-scanner-step">Applicability assistant</p>
          <p className="ct-scanner-intro">
            One conversation from product description through law scan to per-instrument scope.
          </p>
          <button
            type="button"
            className="ct-workflow-home-link"
            onClick={onNavigateHome}
          >
            ← Back to start
          </button>
        </div>
      </header>

      {llmConfigured === false && (
        <p className="ct-workflow-llm-hint ct-muted">
          OpenAI is not configured. Add{" "}
          <code>OPENAI_API_KEY</code> and <code>LLM_PROVIDER=openai</code> to{" "}
          <code>.env.local</code> for AI-assisted chat, product parsing, and scope analysis.
        </p>
      )}

      {error && <div className="err">{error}</div>}

      <div className="ct-product-layout ct-product-layout--boxed ct-product-layout--chat">
        <div className="ct-product-layout-left">
          <ProductWorkflowChat
            messages={messages}
            input={chatInput}
            files={files}
            parsing={parsing}
            scanning={scanning || sendingScopeChat}
            canSend={canSend}
            placeholder={chatPlaceholder}
            scanResponse={scanResponse}
            scanResults={scanResults}
            allScanResults={allScanResults}
            loadingAllResults={loadingAllResults}
            selectedCodes={spec.selectedLaws ?? []}
            includeSecondary={includeSecondary}
            onInputChange={handleInputChange}
            onFilesChange={setFiles}
            onSend={() => void handleSend()}
            hideCompose={phase === "scope"}
            onLoadAll={() => void loadAllScanResults()}
            onToggleLaw={toggleLaw}
            onIncludeSecondaryChange={(next) => {
              setIncludeSecondary(next);
              setAllScanResults(null);
              void (async () => {
                setScanning(true);
                await runLawScan(next);
              })();
            }}
            onCheckApplicability={() => void handleCheckApplicability()}
          />
        </div>
        <ProductKnowledgeGraph nodes={kgNodes} edges={kgEdges} />
      </div>

      {phase === "scope" ? (
        <div className="ct-workflow-scope-panel">
          <ApplicabilityScopeView
            embedded
            presentation="workbench"
            selectedLaws={spec.selectedLaws ?? []}
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
      ) : null}
    </div>
  );
}
