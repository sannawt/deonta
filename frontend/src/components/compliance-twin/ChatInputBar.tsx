import { useRef, useState, type KeyboardEvent } from "react";

interface Props {
  onSend: (text: string) => void;
  loading: boolean;
}

export function ChatInputBar({ onSend, loading }: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const q = text.trim();
    if (!q || loading) return;
    onSend(q);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  return (
    <div className="input-bar">
      <div className="inbar-wrap">
        <textarea
          ref={textareaRef}
          id="cin"
          value={text}
          onChange={(e) => { setText(e.target.value); autoResize(); }}
          onKeyDown={handleKey}
          placeholder="Ask a compliance question or paste a product URL…"
          rows={1}
          disabled={loading}
        />
        <button type="button" id="sbtn" onClick={submit} disabled={!text.trim() || loading}>
          {loading ? "…" : "Send →"}
        </button>
      </div>
      <div className="text-xs text-muted" style={{ marginTop: 5, textAlign: "center", fontStyle: "italic" }}>
        ↵ Send · Shift+↵ newline
      </div>
    </div>
  );
}
