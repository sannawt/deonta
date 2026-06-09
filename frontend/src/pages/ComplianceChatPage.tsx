import { useCallback, useEffect, useRef, useState } from "react";
import {
  assessProduct,
  parseProduct,
  scanRelevantLaws,
  sendChat,
  type LawScanResult,
} from "../lib/api";
import { ensureAccountId } from "../lib/account";
import { resolveAssessment } from "../lib/assessment";
import { buildApplicabilityVerdictSummary } from "../lib/applicabilityVerdict";
import { buildScopeChatDocument, type ScopeChatLawBlock } from "../lib/scopeChatNarrative";
import {
  instrumentForLaw,
  lawBlockForInstrument,
  lawScanIntro,
  MIN_INTAKE_LENGTH,
  pause,
  PRIMARY_LAW_COUNT,
  SLIDE_TRANSITION_MS,
  shortProductAck,
  specFromParse,
} from "../lib/complianceChatFlow";
import { createProduct, type KgFact, type ProductSpec } from "../lib/productStore";
import { resolveAssessCodes } from "../lib/utils";
import type { ChatResponse, ScopeInstrument } from "../types/chat";
import { PixelIcon } from "../components/ui/PixelIcon";
import { ChatLawScanBlock } from "../components/chat/ChatLawScanBlock";
import { ChatMessage } from "../components/chat/ChatMessage";
import { ChatScopeLawCard } from "../components/chat/ChatScopeLawCard";

type ChatPhase = "intake" | "running" | "done";
type MessageKind = "text" | "law_scan" | "scope_law";
type BusyLabel = "thinking" | "scanning" | "assessing" | "between_slides" | null;

interface ComplianceChatMessage {
  id: string;
  role: "user" | "assistant";
  kind: MessageKind;
  content?: string;
  laws?: LawScanResult[];
  lawBlock?: ScopeChatLawBlock;
  instrument?: ScopeInstrument;
  openQuestions?: string[];
}

interface Props {
  onNavigateHome?: () => void;
}

const WELCOME =
  "What product or service would you like me to review? Describe what it does, where you sell it, and any data or AI features.";

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function replyFromChat(data: {
  assistant_text?: string;
  narrative?: { verdict_line?: string; bottom_line?: unknown; full_analysis?: string };
  assessment?: { conclusion?: { verdict_line?: string; bottom_line?: unknown } };
}): string {
  return (
    asText(data.assistant_text) ||
    asText(data.assessment?.conclusion?.verdict_line) ||
    asText(data.narrative?.verdict_line) ||
    asText(data.narrative?.full_analysis) ||
    asText(data.narrative?.bottom_line) ||
    asText(data.assessment?.conclusion?.bottom_line) ||
    ""
  );
}

export function ComplianceChatPage({ onNavigateHome }: Props) {
  const [phase, setPhase] = useState<ChatPhase>("intake");
  const [messages, setMessages] = useState<ComplianceChatMessage[]>([
    { id: "welcome", role: "assistant", kind: "text", content: WELCOME },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<BusyLabel>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<LawScanResult[]>([]);
  const [assessedCodes, setAssessedCodes] = useState<string[]>([]);

  const sessionRef = useRef(`chat-${Date.now()}`);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pipelineRef = useRef<{
    description: string;
    scanResults: LawScanResult[];
    kgFacts: KgFact[];
    spec: ProductSpec;
    assessedCodes: string[];
    allInstruments: ScopeInstrument[];
  }>({
    description: "",
    scanResults: [],
    kgFacts: [],
    spec: {
      name: "",
      summary: "",
      markets: [],
      processesPersonalData: "unknown",
      euLink: "unknown",
      aiSystem: "unknown",
      selectedLaws: [],
    },
    assessedCodes: [],
    allInstruments: [],
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, busyLabel]);

  const appendMessage = useCallback((msg: ComplianceChatMessage) => {
    setMessages((m) => [...m, msg]);
  }, []);

  const pauseBetweenSlides = useCallback(
    async (resumeLabel: Exclude<BusyLabel, "between_slides" | null> = "assessing") => {
      setBusyLabel("between_slides");
      await pause(SLIDE_TRANSITION_MS);
      setBusyLabel(resumeLabel);
    },
    [],
  );

  const appendScopeLawMessages = useCallback(
    async (
      codes: string[],
      instruments: ScopeInstrument[],
      response: ChatResponse,
      scanRows: LawScanResult[],
    ) => {
      const assessment = resolveAssessment(response);
      const scopeInstruments = instruments.filter((inst) =>
        codes.some((code) => {
          const norm = code.toLowerCase().replace(/-/g, "_");
          const keys = [inst.reg_key, inst.id, inst.label]
            .filter(Boolean)
            .map((v) => String(v).toLowerCase().replace(/-/g, "_"));
          return keys.some((k) => k === norm || k.includes(norm) || norm.includes(k));
        }),
      );

      const verdictSummary = buildApplicabilityVerdictSummary({
        spec: pipelineRef.current.spec,
        description: pipelineRef.current.description,
        selectedLawCodes: codes,
        scanResults: scanRows,
        instruments: scopeInstruments,
        narrativeVerdictLine:
          assessment?.conclusion?.verdict_line || response.narrative?.verdict_line,
        scenarioGist: assessment?.facts?.summary?.scenario_gist,
      });

      const document = buildScopeChatDocument({
        productTitle: verdictSummary.productTitle,
        productSummary: pipelineRef.current.spec.summary || pipelineRef.current.description,
        scanResults: scanRows,
        selectedCodes: codes,
        tierRows: verdictSummary.rows,
        instruments: scopeInstruments,
        openQuestions: assessment?.open_questions,
        scenarioGist: assessment?.facts?.summary?.scenario_gist,
        narrativeVerdictLine:
          assessment?.conclusion?.verdict_line || response.narrative?.verdict_line,
        productSignals: {
          euLink: pipelineRef.current.spec.euLink,
          processesPersonalData: pipelineRef.current.spec.processesPersonalData,
          aiSystem: pipelineRef.current.spec.aiSystem,
          markets: pipelineRef.current.spec.markets,
        },
      });

      if (codes.length > 1 && document.summaryLine) {
        appendMessage({
          id: `scope-summary-${Date.now()}`,
          role: "assistant",
          kind: "text",
          content: document.summaryLine,
        });
        await pauseBetweenSlides("assessing");
      }

      let scopeCardsShown = 0;
      for (const code of codes) {
        const inst = scopeInstruments.find((i) =>
          [i.reg_key, i.id, i.label].some(
            (k) =>
              String(k).toLowerCase().replace(/-/g, "_") === code.toLowerCase().replace(/-/g, "_"),
          ),
        );
        const lawBlock =
          lawBlockForInstrument(document.lawBlocks, inst, code) ||
          document.lawBlocks.find((b) => b.lawTitle.toLowerCase().includes(code.replace(/_/g, " ")));
        if (!lawBlock) continue;

        if (scopeCardsShown > 0) {
          await pauseBetweenSlides("assessing");
        }

        appendMessage({
          id: `scope-law-${code}-${Date.now()}`,
          role: "assistant",
          kind: "scope_law",
          lawBlock,
          instrument: inst || instrumentForLaw(scopeInstruments, lawBlock.lawTitle),
          openQuestions: (assessment?.open_questions ?? [])
            .map((q) => q.text || "")
            .filter(Boolean),
        });
        scopeCardsShown += 1;
      }
    },
    [appendMessage, pauseBetweenSlides],
  );

  const runScopeForCodes = useCallback(
    async (codes: string[]) => {
      const {
        description: desc,
        scanResults: rows,
        kgFacts: facts,
        spec: currentSpec,
      } = pipelineRef.current;

      const resolvedCodes = resolveAssessCodes(codes, rows);
      const selectedScanRows = rows.filter((r) => resolvedCodes.includes(r.code));
      const aid = await ensureAccountId();
      const created = createProduct({
        ...currentSpec,
        summary: currentSpec.summary || desc,
        selectedLaws: resolvedCodes,
      });
      created.kgFacts = facts;

      const result = await assessProduct({
        spec: { ...currentSpec, summary: currentSpec.summary || desc, regulations: resolvedCodes },
        kg_facts: facts,
        selected_laws: selectedScanRows,
        account_id: aid,
        case_id: created.id,
      });

      const assessment = resolveAssessment(result);
      const newInstruments = assessment?.scope_analysis?.instruments ?? [];
      const merged = [...pipelineRef.current.allInstruments];
      for (const inst of newInstruments) {
        if (!merged.some((m) => m.id === inst.id)) merged.push(inst);
      }
      pipelineRef.current.allInstruments = merged;

      const nextAssessed = Array.from(new Set([...pipelineRef.current.assessedCodes, ...codes]));
      pipelineRef.current.assessedCodes = nextAssessed;
      setAssessedCodes(nextAssessed);

      await appendScopeLawMessages(codes, merged, result, rows);
    },
    [appendScopeLawMessages],
  );

  const runPipeline = useCallback(
    async (text: string) => {
      setPhase("running");
      setBusy(true);
      setError(null);
      pipelineRef.current.description = text;

      try {
        setBusyLabel("thinking");
        const kg = await parseProduct({ description: text });
        const facts = (kg.facts ?? []).map((f) => ({
          id: f.id,
          label: f.label,
          value: f.value,
          source: f.provenance || f.source,
          predicate: f.predicate,
          args: f.args,
        }));
        const nextSpec = specFromParse(kg.spec, text);
        pipelineRef.current.kgFacts = facts;
        pipelineRef.current.spec = nextSpec;

        appendMessage({
          id: `intake-${Date.now()}`,
          role: "assistant",
          kind: "text",
          content: shortProductAck(nextSpec),
        });
        await pauseBetweenSlides("scanning");
        const scan = await scanRelevantLaws({
          description: text,
          kg_facts: [],
          limit: 15,
          min_score: 0.75,
          include_secondary: true,
          full_scan: false,
        });
        const rows = scan.results ?? [];
        pipelineRef.current.scanResults = rows;
        setScanResults(rows);

        if (!rows.length) {
          appendMessage({
            id: `no-laws-${Date.now()}`,
            role: "assistant",
            kind: "text",
            content:
              "I couldn't find regulations that clearly match. Try adding more about your markets, data use, or AI features.",
          });
          setPhase("intake");
          return;
        }

        appendMessage({
          id: `laws-${Date.now()}`,
          role: "assistant",
          kind: "law_scan",
          laws: rows,
        });
        await pauseBetweenSlides("scanning");

        appendMessage({
          id: `law-intro-${Date.now()}`,
          role: "assistant",
          kind: "text",
          content: lawScanIntro(rows),
        });
        await pauseBetweenSlides("assessing");

        const primaryCodes = rows.slice(0, PRIMARY_LAW_COUNT).map((r) => r.code);
        setBusyLabel("assessing");
        await runScopeForCodes(primaryCodes);

        const remaining = rows.length - primaryCodes.length;
        if (remaining > 0) {
          appendMessage({
            id: `more-${Date.now()}`,
            role: "assistant",
            kind: "text",
            content: `That's the scope picture for the top ${primaryCodes.length}. ${remaining} other regulation${remaining === 1 ? "" : "s"} also matched — use the button below to review them, or ask me anything.`,
          });
        } else {
          appendMessage({
            id: `done-${Date.now()}`,
            role: "assistant",
            kind: "text",
            content: "Scope review complete. Ask a follow-up if you'd like to dig into any area.",
          });
        }

        setPhase("done");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        setError(msg);
        appendMessage({
          id: `err-${Date.now()}`,
          role: "assistant",
          kind: "text",
          content: msg,
        });
        setPhase("intake");
      } finally {
        setBusy(false);
        setBusyLabel(null);
      }
    },
    [appendMessage, pauseBetweenSlides, runScopeForCodes],
  );

  const reviewRemaining = useCallback(async () => {
    const rows = pipelineRef.current.scanResults;
    const already = new Set(pipelineRef.current.assessedCodes);
    const remainingCodes = rows.map((r) => r.code).filter((code) => !already.has(code));
    if (!remainingCodes.length || busy) return;

    setBusy(true);
    setBusyLabel("assessing");
    setError(null);
    appendMessage({
      id: `more-intro-${Date.now()}`,
      role: "assistant",
      kind: "text",
      content: `Reviewing the remaining ${remainingCodes.length} matched regulation${remainingCodes.length === 1 ? "" : "s"}…`,
    });

    try {
      await runScopeForCodes(remainingCodes);
      appendMessage({
        id: `more-done-${Date.now()}`,
        role: "assistant",
        kind: "text",
        content: "All matched regulations have now been reviewed. What would you like to explore next?",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not assess remaining laws";
      setError(msg);
      appendMessage({ id: `err-more-${Date.now()}`, role: "assistant", kind: "text", content: msg });
    } finally {
      setBusy(false);
      setBusyLabel(null);
    }
  }, [appendMessage, busy, runScopeForCodes]);

  const sendFollowUp = useCallback(
    async (text: string) => {
      setBusy(true);
      setBusyLabel("thinking");
      setError(null);
      appendMessage({ id: `u-${Date.now()}`, role: "user", kind: "text", content: text });
      try {
        const context = pipelineRef.current.description
          ? `Product context: ${pipelineRef.current.description.slice(0, 800)}\n\nQuestion: ${text}`
          : text;
        const res = await sendChat({
          question: context,
          session_id: sessionRef.current,
        });
        const reply =
          replyFromChat({
            assistant_text: res.assistant_text,
            narrative: res.narrative,
            assessment: res.assessment,
          }) || "I don't have enough to answer that yet — try asking about a specific regulation or scope dimension.";
        appendMessage({
          id: `a-${Date.now()}`,
          role: "assistant",
          kind: "text",
          content: reply,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Chat request failed";
        setError(msg);
        appendMessage({ id: `err-${Date.now()}`, role: "assistant", kind: "text", content: msg });
      } finally {
        setBusy(false);
        setBusyLabel(null);
      }
    },
    [appendMessage],
  );

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");

    if (phase === "done") {
      await sendFollowUp(text);
      return;
    }

    if (text.length < MIN_INTAKE_LENGTH) {
      setError(`Please add a bit more detail (at least ${MIN_INTAKE_LENGTH} characters).`);
      return;
    }

    appendMessage({ id: `u-${Date.now()}`, role: "user", kind: "text", content: text });
    await runPipeline(text);
  }, [input, busy, phase, appendMessage, runPipeline, sendFollowUp]);

  const remainingCount = scanResults.filter((r) => !assessedCodes.includes(r.code)).length;

  const busyText =
    busyLabel === "between_slides"
      ? "Preparing next step…"
      : busyLabel === "scanning"
        ? "Scanning applicable regulations…"
        : busyLabel === "assessing"
          ? "Assessing scope…"
          : "Thinking…";

  return (
    <div className="ct-page ct-chat-page">
      <header className="ct-chat-page-head">
        <PixelIcon name="legalSand" size={56} className="ct-chat-page-icon" />
        <div className="ct-chat-page-head-text">
          <h1 className="ct-chat-page-title">Compliance chat</h1>
          <p className="ct-chat-page-sub">
            Describe your product — I'll match regulations and review scope step by step.
          </p>
        </div>
        {onNavigateHome ? (
          <button type="button" className="ct-btn-secondary ct-chat-back" onClick={onNavigateHome}>
            ← Home
          </button>
        ) : null}
      </header>

      {error ? <div className="err">{error}</div> : null}

      <div className="ct-compliance-chat">
        <div className="ct-compliance-chat-messages" aria-live="polite">
          {(() => {
            let scopeIndex = 0;
            return messages.map((m) => {
              if (m.kind === "law_scan" && m.laws) {
                return (
                  <ChatMessage key={m.id} role="assistant" variant="card">
                    <ChatLawScanBlock laws={m.laws} primaryCount={PRIMARY_LAW_COUNT} />
                  </ChatMessage>
                );
              }
              if (m.kind === "scope_law" && m.lawBlock) {
                const cardIndex = scopeIndex++;
                return (
                  <ChatMessage key={m.id} role="assistant" variant="scope">
                    <ChatScopeLawCard
                      law={m.lawBlock}
                      instrument={m.instrument}
                      openQuestions={m.openQuestions}
                      defaultExpanded={cardIndex === 0}
                    />
                  </ChatMessage>
                );
              }
              return (
                <ChatMessage key={m.id} role={m.role}>
                  <p className="ct-chat-prose">{m.content}</p>
                </ChatMessage>
              );
            });
          })()}
          {busy ? (
            <ChatMessage role="assistant">
              {busyLabel === "between_slides" ? (
                <p className="ct-chat-slide-wait">
                  <span className="ct-hourglass-spin-wrap" aria-hidden>
                    <PixelIcon
                      name="hourglass"
                      size={40}
                      className="ct-chat-slide-wait-icon"
                    />
                  </span>
                  <span>{busyText}</span>
                </p>
              ) : (
                <p className="ct-chat-typing">
                  <span className="ct-chat-typing-dots" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </span>
                  {busyText}
                </p>
              )}
            </ChatMessage>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {phase === "done" && remainingCount > 0 ? (
          <div className="ct-chat-review-more">
            <button
              type="button"
              className="ct-btn-secondary"
              disabled={busy}
              onClick={() => void reviewRemaining()}
            >
              Review {remainingCount} other matched regulation{remainingCount === 1 ? "" : "s"}
            </button>
          </div>
        ) : null}

        <form
          className="ct-compliance-chat-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="ct-compliance-chat-compose-row">
            <textarea
              className="ct-compliance-chat-input"
              rows={2}
              placeholder={
                phase === "done"
                  ? "Ask a follow-up question…"
                  : "Describe your product, markets, data use, and AI features…"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy || phase === "running"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            <button
              type="submit"
              className="ct-btn-primary ct-chat-send-btn"
              disabled={busy || !input.trim() || phase === "running"}
              aria-label="Send message"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
