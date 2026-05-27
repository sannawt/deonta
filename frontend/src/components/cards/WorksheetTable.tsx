import type { ChatResponse } from "../../types/chat";

const badgeClassForResult: Record<string, string> = {
  PASS: "badge-green",
  FAIL: "badge-red",
  UNKNOWN: "badge-amber",
  NOT_REACHED: "badge-gray",
  DEFERRED: "badge-blue",
};

export function WorksheetTable({
  worksheet,
  title = "How scope was tested",
}: {
  worksheet?: ChatResponse["worksheet"];
  title?: string;
}) {
  const rows = worksheet?.rows || [];
  if (rows.length === 0) return null;

  return (
    <div className="panel-card">
      <div className="panel-card-head">
        <span>{title}</span>
        <span className="badge badge-gray text-mono">{rows.length}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 2 }}>
        {rows.map((r, idx) => (
          <div
            key={idx}
            style={{
              border: "1px solid var(--bdr)",
              borderRadius: 14,
              padding: "10px 12px",
              background: "var(--cloud1)",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px", gap: 10, alignItems: "start" }}>
              <div style={{ fontWeight: 900, color: "var(--txt)", letterSpacing: "-0.01em" }}>{r.legal_test_name}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className={`badge ${badgeClassForResult[r.gdpr_result] || "badge-gray"}`}>GDPR: {r.gdpr_result}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <span className={`badge ${badgeClassForResult[r.ai_act_result] || "badge-gray"}`}>AI Act: {r.ai_act_result}</span>
              </div>
            </div>

            {r.reasoning && (
              <div style={{ marginTop: 8, color: "var(--txt2)", lineHeight: 1.55, fontSize: 13.2 }}>
                {r.reasoning}
              </div>
            )}

            {r.legal_basis && (
              <div style={{ marginTop: 6, color: "var(--txt3)", fontFamily: "'DM Mono', monospace", fontSize: 12.5 }}>
                Legal basis: {r.legal_basis}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

