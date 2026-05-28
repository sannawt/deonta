import { useEffect, useState } from "react";

interface RuntimeInfoResp {
  ui_meta?: unknown;
  health?: unknown;
}

export function RuntimeInfo() {
  const [data, setData] = useState<RuntimeInfoResp | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/ui-meta").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/health").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([ui_meta, health]) => setData({ ui_meta: ui_meta ?? undefined, health: health ?? undefined }));
  }, []);

  return (
    <div style={{ position: "absolute", right: 14, bottom: 12, zIndex: 2 }}>
      <button type="button" className="hdr-btn" onClick={() => setOpen((o) => !o)} title="Runtime info">
        Runtime
      </button>
      {open && (
        <div className="glass" style={{ marginTop: 8, padding: 10, borderRadius: 12, width: 420, maxWidth: "70vw" }}>
          <div className="text-label">Runtime info</div>
          <pre className="text-xs" style={{ whiteSpace: "pre-wrap", margin: 0, marginTop: 6, maxHeight: 260, overflow: "auto" }}>
            {JSON.stringify(data, null, 2)}
          </pre>
          <div className="text-xs text-muted" style={{ marginTop: 6 }}>
            If Products show 404, this helps confirm you’re hitting the same origin for UI and API.
          </div>
        </div>
      )}
    </div>
  );
}

