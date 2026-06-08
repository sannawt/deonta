import { useCallback, useEffect, useRef, useState } from "react";
import { sendChat } from "../lib/api";
import { PixelIcon } from "../components/ui/PixelIcon";
import { fetchUiMeta, type UiMeta } from "../lib/uiInstance";

interface ChatLine {
  id: string;
  role: "user" | "assistant";
  content: string;
}

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

export function ComplianceChatPage() {
  const [meta, setMeta] = useState<UiMeta | null>(null);
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef(`chat-${Date.now()}`);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUiMeta().then(setMeta);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: text }]);
    setSending(true);
    try {
      const res = await sendChat({
        question: text,
        session_id: sessionRef.current,
      });
      const reply =
        replyFromChat({
          assistant_text: res.assistant_text,
          narrative: res.narrative,
          assessment: res.assessment,
        }) ||
        "I could not generate a reply. Try asking whether a specific regulation applies to your product.";
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Chat request failed";
      setError(msg);
      setMessages((m) => [...m, { id: `err-${Date.now()}`, role: "assistant", content: msg }]);
    } finally {
      setSending(false);
    }
  }, [input, sending]);

  const peer = meta?.peer_url;

  return (
    <div className="ct-page ct-chat-page">
      <header className="ct-scanner-head">
        <PixelIcon name="legalSand" size={96} className="ct-scanner-head-icon" />
        <div className="ct-scanner-head-text">
          <p className="ct-scanner-step">Compliance chat</p>
          <p className="ct-scanner-intro">
            Ask whether GDPR, the AI Act, or other EU rules apply — with reasoning from the legal graph.
          </p>
          {peer ? (
            <p className="ct-chat-peer-link">
              Product applicability workflow:{" "}
              <a href={peer} target="_blank" rel="noreferrer">
                {meta?.peer_label || peer}
              </a>
            </p>
          ) : null}
        </div>
      </header>

      {error ? <div className="err">{error}</div> : null}

      <div className="ct-compliance-chat">
        <div className="ct-compliance-chat-messages" aria-live="polite">
          {messages.length === 0 ? (
            <p className="ct-compliance-chat-empty">
              Example: &ldquo;Does GDPR apply if we sell a B2B SaaS tool to EU customers?&rdquo;
            </p>
          ) : null}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`ct-compliance-chat-bubble ct-compliance-chat-bubble-${m.role}`}
            >
              {m.content}
            </div>
          ))}
          {sending ? (
            <div className="ct-compliance-chat-bubble ct-compliance-chat-bubble-assistant">
              Thinking…
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <form
          className="ct-compliance-chat-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            className="ct-compliance-chat-input"
            rows={3}
            placeholder="Ask a compliance question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
          />
          <button type="submit" className="ct-btn-primary" disabled={sending || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
