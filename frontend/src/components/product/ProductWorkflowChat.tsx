import { useEffect, useRef } from "react";
import type { LawScanResponse } from "../../lib/api";
import type { LawScanResult } from "../../lib/api";
import type { ScopeChatDocument } from "../../lib/scopeChatNarrative";
import { PixelIcon } from "../ui/PixelIcon";
import { LawScanResults } from "./LawScanResults";
import { ScopeAnalysisChatBlock } from "./ScopeAnalysisChatBlock";

export type WorkflowChatMessage =
  | {
      id: string;
      role: "assistant" | "user" | "system";
      kind: "text";
      content: string;
    }
  | {
      id: string;
      role: "assistant";
      kind: "law-scan";
      content: string;
    }
  | {
      id: string;
      role: "assistant";
      kind: "status";
      content: string;
    }
  | {
      id: string;
      role: "assistant";
      kind: "scope-analysis";
      content: string;
      document: ScopeChatDocument | null;
      loading?: boolean;
    };

interface Props {
  messages: WorkflowChatMessage[];
  input: string;
  files: File[];
  parsing: boolean;
  scanning: boolean;
  canSend: boolean;
  placeholder: string;
  scanResponse: LawScanResponse | null;
  scanResults: LawScanResult[];
  allScanResults: LawScanResult[] | null;
  loadingAllResults: boolean;
  selectedCodes: string[];
  onInputChange: (value: string) => void;
  onFilesChange: (files: File[]) => void;
  onSend: () => void;
  onLoadAll: () => void;
  onCheckApplicability: () => void;
  hideCompose?: boolean;
}

export function ProductWorkflowChat({
  messages,
  input,
  files,
  parsing,
  scanning,
  canSend,
  placeholder,
  scanResponse,
  scanResults,
  allScanResults,
  loadingAllResults,
  selectedCodes,
  onInputChange,
  onFilesChange,
  onSend,
  onLoadAll,
  onCheckApplicability,
  hideCompose = false,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, parsing, scanning]);

  function addFiles(list: FileList | File[]) {
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!next.find((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    onFilesChange(next);
  }

  return (
    <div
      className="ct-workflow-chat"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
      }}
    >
      <div className="ct-workflow-chat-messages" aria-live="polite">
        {messages.map((msg) => {
          if (msg.kind === "scope-analysis") {
            return (
              <div
                key={msg.id}
                className="ct-workflow-chat-block ct-workflow-chat-block-assistant"
              >
                {msg.content ? (
                  <p className="ct-workflow-chat-bubble ct-workflow-chat-bubble-assistant">
                    {msg.content}
                  </p>
                ) : null}
                <div className="ct-workflow-chat-card ct-workflow-chat-card--prose">
                  {msg.document ? (
                    <ScopeAnalysisChatBlock
                      document={msg.document}
                      loading={msg.loading}
                    />
                  ) : (
                    <p className="ct-scope-chat-doc-loading">
                      Running per-law scope assessment…
                    </p>
                  )}
                </div>
              </div>
            );
          }

          if (msg.kind === "law-scan") {
            return (
              <div
                key={msg.id}
                className="ct-workflow-chat-block ct-workflow-chat-block-assistant"
              >
                <p className="ct-workflow-chat-bubble ct-workflow-chat-bubble-assistant">
                  {msg.content}
                </p>
                <div className="ct-workflow-chat-card">
                  <LawScanResults
                    scanResponse={scanResponse}
                    results={scanResults}
                    allResults={allScanResults}
                    loadingAll={loadingAllResults}
                    onLoadAll={onLoadAll}
                    selectedCodes={selectedCodes}
                    loading={scanning}
                    onCheckApplicability={onCheckApplicability}
                  />
                </div>
              </div>
            );
          }

          const bubbleClass =
            msg.role === "user"
              ? "ct-workflow-chat-bubble-user"
              : msg.role === "system"
                ? "ct-workflow-chat-bubble-system"
                : msg.kind === "status"
                  ? "ct-workflow-chat-bubble-status"
                  : "ct-workflow-chat-bubble-assistant";

          return (
            <div
              key={msg.id}
              className={`ct-workflow-chat-bubble ${bubbleClass}`}
            >
              {msg.content}
            </div>
          );
        })}
        {(parsing || scanning) && (
          <div className="ct-workflow-chat-bubble ct-workflow-chat-bubble-status">
            <span className="ct-hourglass-spin-wrap" aria-hidden>
              <PixelIcon name="hourglass" size={28} className="ct-workflow-chat-status-icon" />
            </span>
            {scanning && !parsing
              ? "Thinking…"
              : parsing && scanning
                ? "Reading your description and scanning laws…"
                : parsing
                  ? "Reading your description…"
                  : "Finding relevant laws…"}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {!hideCompose ? (
      <form
        className="ct-workflow-chat-compose"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        {files.length > 0 && (
          <p className="ct-product-files text-sm">
            {files.map((f) => f.name).join(" · ")}
          </p>
        )}

        <div className="ct-workflow-chat-compose-row">
          <button
            type="button"
            className="ct-workflow-chat-upload"
            onClick={() => fileRef.current?.click()}
            aria-label="Upload document"
          >
            <PixelIcon name="document" size={40} className="ct-workflow-chat-upload-icon" />
          </button>

          <div className="ct-workflow-chat-input-wrap">
            <textarea
              className="ct-workflow-chat-input"
              rows={3}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={placeholder}
              aria-label="Message"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) onSend();
                }
              }}
            />
          </div>

          <button
            type="submit"
            className="ct-workflow-chat-send"
            disabled={!canSend || parsing || scanning}
          >
            Send
          </button>
        </div>
      </form>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        accept=".pdf,.txt,.md,.doc,.docx"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
