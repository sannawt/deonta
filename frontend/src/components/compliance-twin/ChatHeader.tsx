import { useState, useEffect } from "react";
import { CompanyPlaybookTabs } from "./CompanyPlaybookTabs";

interface HealthStatus {
  corpus?: { ready?: boolean };
  souffle?: boolean;
  legal?: { backend?: string; ok?: boolean };
  playbook?: { ok?: boolean; error?: string | null };
}

interface UiMeta {
  ui?: string;
  js_bundle?: string | null;
}

interface Props {
  title: string;
  playbookCompanyId: string;
  onPlaybookCompanyChange: (id: string) => void;
}

export function ChatHeader({ title, playbookCompanyId, onPlaybookCompanyChange }: Props) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [uiMeta, setUiMeta] = useState<UiMeta | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => null);
    fetch("/api/ui-meta")
      .then((r) => r.json())
      .then(setUiMeta)
      .catch(() => null);
  }, []);

  const corpusOk = health?.corpus?.ready !== false;
  const souffleOk = health?.souffle !== false;
  const legalOk = health?.legal?.ok !== false;
  const playbookOk = health?.playbook?.ok === true;

  return (
    <header className="mhdr">
      <div className="mhdr-l">
        <div
          className="sdot"
          title="engine status"
          style={{
            background: corpusOk && souffleOk && legalOk ? "#10b981" : "#d97706",
            boxShadow: `0 0 0 3px ${corpusOk && souffleOk && legalOk ? "rgba(16,185,129,.18)" : "rgba(217,119,6,.18)"}`,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div className="mhdr-title">{title || "New session"}</div>
          <div className="mhdr-meta">
            Today · playbook {playbookOk ? "connected" : "offline"} · legal {health?.legal?.backend || "local"}
            {uiMeta?.ui === "compliance_twin" && uiMeta.js_bundle ? (
              <> · UI {uiMeta.js_bundle.replace(/^index-|\.js$/g, "").slice(0, 8)}</>
            ) : uiMeta?.ui === "missing" ? (
              <> · <span style={{ color: "var(--red)" }}>UI not built</span></>
            ) : null}
          </div>
        </div>
      </div>

      <div className="hdr-btns">
        <CompanyPlaybookTabs
          header
          value={playbookCompanyId}
          onChange={onPlaybookCompanyChange}
        />
      </div>
    </header>
  );
}
