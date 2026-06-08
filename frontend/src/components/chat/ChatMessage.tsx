import type { ReactNode } from "react";

interface Props {
  role: "user" | "assistant";
  children: ReactNode;
  variant?: "text" | "card" | "scope";
}

export function ChatMessage({ role, children, variant = "text" }: Props) {
  return (
    <div
      className={[
        "ct-chat-msg",
        `ct-chat-msg--${role}`,
        variant !== "text" ? `ct-chat-msg--${variant}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {role === "assistant" ? (
        <span className="ct-chat-msg-avatar" aria-hidden>
          CT
        </span>
      ) : null}
      <div className="ct-chat-msg-body">{children}</div>
    </div>
  );
}
