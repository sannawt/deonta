import type { ChatResponse } from "../../types/chat";
import { resolveAssessment } from "../../lib/assessment";

interface Props {
  response: ChatResponse | null;
}

export function AssessmentTable({ response }: Props) {
  const assessment = resolveAssessment(response);
  const rows = assessment?.conclusion?.bottom_line?.rows ?? [];
  const scope = assessment?.scope_analysis;

  if (!response) {
    return <div className="empty">No assessment data.</div>;
  }

  const scopeRows =
    scope?.instruments?.map((inst) => {
      const dim = (id: string) => inst.dimensions?.find((d) => d.id === id)?.result ?? "—";
      return {
        instrument: inst.label || inst.id || "—",
        material: dim("material"),
        territorial: dim("territorial"),
        temporal: dim("temporal"),
        overall: inst.verdict_display || inst.verdict || "—",
      };
    }) ?? [];

  const data = rows.length
    ? rows.map((r) => ({
        instrument: r.instrument,
        result: r.result,
        conclusion: r.conclusion_text,
      }))
    : scopeRows.map((r) => ({
        instrument: r.instrument,
        result: String(r.overall),
        conclusion: `Material: ${r.material} · Territorial: ${r.territorial} · Temporal: ${r.temporal}`,
      }));

  if (!data.length) {
    return <div className="empty">No tabular results in this assessment.</div>;
  }

  function exportCsv() {
    const header = ["Instrument", "Result", "Notes"];
    const lines = [
      header.join(","),
      ...data.map((d) =>
        [d.instrument, d.result, d.conclusion]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "applicability.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button type="button" className="ct-btn-secondary" onClick={exportCsv}>
          Export CSV
        </button>
      </div>
      <table className="ct-table">
        <thead>
          <tr>
            <th>Instrument</th>
            <th>Result</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <td>{d.instrument}</td>
              <td>{d.result}</td>
              <td>{d.conclusion}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
