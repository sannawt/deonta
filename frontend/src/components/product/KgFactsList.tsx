import type { KgFact } from "../../lib/api";

interface Props {
  facts: KgFact[];
}

export function KgFactsList({ facts }: Props) {
  const rows = facts.filter((f) => f.predicate || f.label);
  if (!rows.length) return null;

  return (
    <div className="ct-kg-facts" aria-label="Knowledge graph facts">
      <p className="ct-kg-facts-title">Facts from your intake</p>
      <ul className="ct-kg-facts-list">
        {rows.map((f) => (
          <li key={f.id} className="ct-kg-facts-row">
            <span className="ct-kg-facts-value">
              {f.value || `${f.predicate}(${f.args?.join(", ") ?? ""})`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
