import { useEffect, useState } from "react";
import type { UiMeta } from "../../lib/uiInstance";

interface Props {
  uiMode?: "chat" | "workflow";
  peerUrl?: string;
}

export function InstanceBadge({ uiMode, peerUrl }: Props) {
  const [meta, setMeta] = useState<UiMeta | null>(null);

  useEffect(() => {
    fetch("/api/ui-meta")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: UiMeta | null) => setMeta(data))
      .catch(() => setMeta(null));
  }, []);

  const mode = uiMode || meta?.ui_mode || (meta?.prototype_mode ? "workflow" : "chat");
  const label = mode === "workflow" ? "Workflow" : "Chat";
  const port = meta?.port ? `:${meta.port}` : "";
  const peer = peerUrl || meta?.peer_url;

  return (
    <span className="ct-instance-badge-wrap">
      <span
        className={`ct-instance-badge ct-instance-badge--${mode}`}
        title={meta?.local_url ? `${label} at ${meta.local_url}` : label}
      >
        {label}
        {port}
      </span>
      {peer ? (
        <a className="ct-instance-peer" href={peer} title={`Open ${meta?.peer_label || "other instance"}`}>
          → {mode === "workflow" ? "Chat" : "Workflow"}
        </a>
      ) : null}
    </span>
  );
}
