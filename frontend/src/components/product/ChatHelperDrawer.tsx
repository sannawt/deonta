import { useEffect, useRef, useState } from "react";
import type { ChatResponse } from "../../types/chat";

interface Props {
  open: boolean;
  onClose: () => void;
  productLabel?: string;
  runChat: (question: string) => Promise<ChatResponse>;
}

export function ChatHelperDrawer({ open, onClose, productLabel, runChat }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<ChatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setResp(null);
      setError(null);
      setText("");
      setTimeout(() => boxRef.current?.scrollIntoView({ block: "end" }), 10);
    }
  }, [open]);

  async function handleAsk() {
    const q = text.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const full = productLabel ? `Context: product = ${productLabel}\n\n${q}` : q;
      const out = await runChat(full);
      setResp(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(15,23,42,.18)",
      }}
      onClick={onClose}
    >
      <div
        className="glass"
        style={{
          position: "absolute",
          right: 12,
          top: 12,
          bottom: 12,
          width: 520,
          maxWidth: "92vw",
          borderRadius: 16,
          padding: 12,
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div className="text-title">Ask a follow‑up</div>
            <div className="text-xs text-muted">Optional helper (does not replace the record)</div>
          </div>
          <button type="button" className="hdr-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <textarea
            className="textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask something narrow, e.g. “Which GDPR roles apply and why?”"
            style={{ minHeight: 92 }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="run-btn" type="button" disabled={loading} onClick={handleAsk}>
              {loading ? "Asking…" : "Ask"}
            </button>
          </div>
          {error && <div className="err">{error}</div>}
        </div>

        <div style={{ flex: 1, overflow: "auto", marginTop: 10 }}>
          <div ref={boxRef} />
          {!resp && !error && <div className="empty">No answer yet.</div>}
          {resp && (
            <pre className="text-xs" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
              {JSON.stringify(resp.general?.assistant_text || resp.assistant_text || resp.narrative?.verdict_line || resp, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

