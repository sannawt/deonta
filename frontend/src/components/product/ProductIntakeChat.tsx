import { useRef, useState } from "react";
import { sendChat } from "../../lib/api";
import type { ProductIntakeState } from "../../lib/kgIntakeSchema";
import { intakeGaps } from "../../lib/kgIntakeSchema";

interface ChatLine {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Props {
  intake: ProductIntakeState;
  onPatch: (patch: Partial<ProductIntakeState>) => void;
  collapsed?: boolean;
}

function extractPatchFromReply(
  reply: string,
  intake: ProductIntakeState,
): Partial<ProductIntakeState> {
  const patch: Partial<ProductIntakeState> = {};
  const lower = reply.toLowerCase();

  if (/\b(yes|does|processes)\b.*\bpersonal data\b/.test(lower)) {
    patch.processesPersonalData = "yes";
  } else if (/\b(no|not|doesn't|does not)\b.*\bpersonal data\b/.test(lower)) {
    patch.processesPersonalData = "no";
  }

  if (/\b(yes|uses|includes)\b.*\b(ai|machine learning|ml)\b/.test(lower)) {
    patch.hasAi = "yes";
  } else if (/\b(no|not|doesn't|does not)\b.*\b(ai|machine learning)\b/.test(lower)) {
    patch.hasAi = "no";
  }

  if (/\b(eu|european union|eea)\b/.test(lower) && /\b(established|based|located|headquarter)/.test(lower)) {
    patch.establishedInEu = "yes";
    if (!intake.markets.includes("eu")) {
      patch.markets = [...intake.markets, "eu"];
    }
  }

  for (const role of ["controller", "processor", "provider", "deployer"]) {
    if (new RegExp(`\\b${role}\\b`).test(lower)) {
      const id = role.toUpperCase();
      if (!intake.actorRoles.includes(id)) {
        patch.actorRoles = [...(patch.actorRoles ?? intake.actorRoles), id];
      }
    }
  }

  const nameMatch = reply.match(/product(?:\s+name)?[:\s]+["']?([^"'\n.]+)/i);
  if (nameMatch && !intake.productName.trim()) {
    patch.productName = nameMatch[1].trim().slice(0, 80);
  }

  return patch;
}

export function ProductIntakeChat({ intake, onPatch, collapsed: initialCollapsed = true }: Props) {
  const [open, setOpen] = useState(!initialCollapsed);
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef(`intake-${Date.now()}`);
  const turnCount = messages.filter((m) => m.role === "user").length;
  const gaps = intakeGaps(intake);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || turnCount >= 3) return;

    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: text }]);
    setInput("");
    setSending(true);
    setError(null);

    const prompt = [
      "You help fill a structured compliance intake form. Reply in 1-2 short sentences.",
      gaps.length ? `Still missing: ${gaps.join(", ")}.` : "Most core fields are filled.",
      `Current intake: ${JSON.stringify(intake)}`,
      `User: ${text}`,
    ].join("\n");

    try {
      const res = await sendChat({ question: prompt, session_id: sessionRef.current });
      const reply =
        res.assistant_text?.trim() ||
        "I could not extract details — try stating product name, markets, or data/AI usage clearly.";
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
      const patch = extractPatchFromReply(reply, intake);
      if (Object.keys(patch).length) onPatch(patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ct-intake-chat">
      <button
        type="button"
        className="ct-intake-chat-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Add detail via chat {gaps.length ? `(${gaps.length} gaps)` : ""}
      </button>

      {open ? (
        <div className="ct-intake-chat-body">
          {messages.length === 0 ? (
            <p className="ct-intake-chat-hint">
              Optional — up to 3 turns to clarify missing fields.
            </p>
          ) : (
            <ul className="ct-intake-chat-messages">
              {messages.map((m) => (
                <li key={m.id} className={`ct-intake-chat-line ct-intake-chat-line--${m.role}`}>
                  {m.content}
                </li>
              ))}
            </ul>
          )}
          {error ? <p className="err ct-intake-chat-err">{error}</p> : null}
          {turnCount < 3 ? (
            <div className="ct-intake-chat-input-row">
              <input
                type="text"
                className="ct-intake-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void send();
                }}
                placeholder="e.g. We are a controller based in Finland…"
                disabled={sending}
              />
              <button
                type="button"
                className="ct-btn-outline ct-intake-chat-send"
                onClick={() => void send()}
                disabled={sending || !input.trim()}
              >
                Send
              </button>
            </div>
          ) : (
            <p className="ct-intake-chat-hint">Chat limit reached — edit fields above or continue.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
