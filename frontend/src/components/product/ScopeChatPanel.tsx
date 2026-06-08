import { useCallback, useEffect, useRef, useState } from "react";
import { sendChat } from "../../lib/api";
import type { ScopeInstrument } from "../../types/chat";

interface ChatLine {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface Props {
  productTitle: string;
  productSummary: string;
  focusedLawLabel?: string;
  focusedInstrument?: ScopeInstrument;
  playbookCompanyId?: string;
  sessionId?: string;
}

function assistantFromResponse(data: {
  assistant_text?: string;
  narrative?: { verdict_line?: string; full_analysis?: string };
  assessment?: { conclusion?: { verdict_line?: string } };
}): string {
  return (
    data.assistant_text?.trim() ||
    data.assessment?.conclusion?.verdict_line?.trim() ||
    data.narrative?.verdict_line?.trim() ||
    data.narrative?.full_analysis?.trim() ||
    ""
  );
}

export function ScopeChatPanel({
  productTitle,
  productSummary,
  focusedLawLabel,
  focusedInstrument,
  playbookCompanyId,
  sessionId,
}: Props) {
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef(sessionId || `scope-${Date.now()}`);

  useEffect(() => {
    if (sessionId) chatSessionRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const buildQuestion = useCallback(
    (userText: string) => {
      const parts = [
        `Product: ${productTitle}`,
        productSummary ? `Summary: ${productSummary.slice(0, 600)}` : "",
        focusedLawLabel ? `Focused law: ${focusedLawLabel}` : "",
        focusedInstrument?.verdict_display || focusedInstrument?.verdict
          ? `Focused verdict: ${focusedInstrument.verdict_display || focusedInstrument.verdict}`
          : "",
        focusedInstrument?.headline ? `Scope headline: ${focusedInstrument.headline}` : "",
        "",
        `User question: ${userText}`,
      ];
      return parts.filter(Boolean).join("\n");
    },
    [productTitle, productSummary, focusedLawLabel, focusedInstrument],
  );

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userId = `u-${Date.now()}`;
    setMessages((m) => [...m, { id: userId, role: "user", content: text }]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await sendChat({
        question: buildQuestion(text),
        session_id: chatSessionRef.current,
        playbook_company_id: playbookCompanyId,
      });
      const reply =
        assistantFromResponse(res) ||
        "I could not generate a reply. Try rephrasing your question about scope or a specific law.";
      setMessages((m) => [
        ...m,
        { id: `a-${Date.now()}`, role: "assistant", content: reply },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Chat request failed";
      setError(msg);
      setMessages((m) => [
        ...m,
        { id: `err-${Date.now()}`, role: "assistant", content: msg },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <aside className="ct-scope-chat" aria-label="Scope assistant chat">
      <header className="ct-scope-chat-head">
        <h3 className="ct-scope-chat-title">Scope assistant</h3>
        <p className="ct-scope-chat-hint">
          {focusedLawLabel
            ? `Discussing ${focusedLawLabel}`
            : "Select a law to add context"}
        </p>
      </header>

      <div className="ct-scope-chat-messages">
        {messages.length === 0 ? (
          <p className="ct-scope-chat-empty">
            Ask about scope, missing facts, or a specific law. Open a law card on the left for context.
          </p>
        ) : null}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`ct-scope-chat-msg ct-scope-chat-msg-${m.role}`}
          >
            {m.content}
          </div>
        ))}
        {sending ? (
          <div className="ct-scope-chat-msg ct-scope-chat-msg-assistant ct-scope-chat-typing">
            Thinking…
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="err ct-scope-chat-error">{error}</p> : null}

      <form
        className="ct-scope-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          className="ct-scope-chat-input"
          rows={3}
          placeholder="Ask about scope, missing facts, or a specific law…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button type="submit" className="ct-scope-chat-send" disabled={sending || !input.trim()}>
          Send
        </button>
      </form>
    </aside>
  );
}
