import type { Message, ChatResponse } from "../../types/chat";

interface Props {
  message: Message;
  onSend: (text: string) => void;
}

function CtLogo() {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        minWidth: 32,
        background: "var(--cloud0)",
        border: "1px solid var(--bdr)",
        borderRadius: 9,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 2,
        flexShrink: 0,
        boxShadow: "var(--sh-sm)",
        padding: 5,
      }}
    >
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 7L9 7L9 41L18 41" stroke="var(--blue-dk)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M30 7L39 7L39 41L30 41" stroke="var(--blue)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="24" r="4" fill="var(--blue)" />
      </svg>
    </div>
  );
}

function GeneralAnswerCard({ text, related }: { text: string; related?: ChatResponse["general"] }) {
  return (
    <div className="ct-card v-info" style={{ padding: "14px 18px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--blue)", letterSpacing: ".1em", textTransform: "uppercase" }}>
          Explanation
        </div>
        {related?.related_provisions && related.related_provisions.length > 0 && (
          <span className="badge badge-blue" style={{ fontFamily: "'DM Mono', monospace", fontSize: 10 }}>
            {related.related_provisions.length} excerpts
          </span>
        )}
      </div>
      <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.65, color: "var(--txt2)", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        {text}
      </div>
    </div>
  );
}

export function ChatMessage({ message, onSend }: Props) {
  void onSend;
  if (message.role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div className="bubble-user">{message.text}</div>
      </div>
    );
  }

  if (message.role === "loading") {
    return (
      <div style={{ display: "flex", gap: 10, maxWidth: "96%" }}>
        <CtLogo />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ct-card v-info" style={{ padding: "12px 17px", borderLeftWidth: 3 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10.5, color: "var(--txt4)", fontStyle: "italic" }}>
                Running symbolic engine…
              </span>
              <span className="blink" style={{ color: "var(--txt4)" }}>▋</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (message.error) {
    return (
      <div style={{ display: "flex", gap: 10, maxWidth: "96%" }}>
        <CtLogo />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ct-card v-no" style={{ padding: "12px 16px", borderLeftWidth: 3 }}>
            <div style={{ color: "var(--red)", fontSize: 13, fontWeight: 600 }}>{message.error}</div>
          </div>
        </div>
      </div>
    );
  }

  const data = message.data;
  if (!data) return null;

  if (data.mode === "general") {
    const assistantText = data.assistant_text || data.general?.assistant_text || "";
    return (
      <div style={{ display: "flex", gap: 10, maxWidth: "96%" }}>
        <CtLogo />
        <div className="bubble-ai" style={{ flex: 1, minWidth: 0 }}>
          <GeneralAnswerCard text={assistantText} related={data.general} />
        </div>
      </div>
    );
  }

  // Applicability: thin chat bubble — full assessment lives in the right panel
  const line =
    data.narrative?.verdict_line ||
    data.assessment?.conclusion?.verdict_line ||
    "Provisional scope assessment complete.";
  return (
    <div style={{ display: "flex", gap: 10, maxWidth: "96%" }}>
      <CtLogo />
      <div className="bubble-ai" style={{ flex: 1, minWidth: 0 }}>
        <div className="ct-card v-info" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--blue)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>
            Scope assessment updated
          </div>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--txt2)" }}>
            On the facts you provided, {line}
          </p>
          <p className="text-xs text-muted" style={{ marginTop: 8, marginBottom: 0 }}>
            See the assessment panel for facts, scope, and open points.
          </p>
        </div>
      </div>
    </div>
  );
}
