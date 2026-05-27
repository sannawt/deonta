import type { Counterfactual } from "@/types/workbench";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleLeft, ToggleRight } from "lucide-react";

interface Props {
  items: Counterfactual[];
  state: Record<string, boolean>;
  onToggle: (id: string) => void;
}

export function CounterfactualSimulator({ items, state, onToggle }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">What would change the answer?</CardTitle>
        <p className="text-xs text-ink-mid">Toggle hypothetical facts — shows gate/rule sensitivity before Datalog rerun.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((cf) => {
          const on = state[cf.id] ?? cf.enabled;
          return (
            <button
              key={cf.id}
              type="button"
              onClick={() => onToggle(cf.id)}
              className="w-full rounded-lg border border-paper-line bg-paper-surface px-3 py-2.5 text-left transition-colors hover:bg-paper-muted"
            >
              <div className="flex items-start gap-2">
                {on ? <ToggleRight className="h-5 w-5 text-legal-accent shrink-0" /> : <ToggleLeft className="h-5 w-5 text-ink-dim shrink-0" />}
                <div>
                  <p className="text-sm font-medium text-ink">{cf.label}</p>
                  <p className="mt-1 text-[11px] text-ink-dim">
                    Gates: {cf.gatesAffected.join("; ") || "—"}
                  </p>
                  <p className="text-[11px] text-ink-dim">
                    Rules: {cf.rulesAffected.join("; ") || "—"}
                  </p>
                  {cf.requiresRerun && (
                    <p className="mt-1 text-[10px] font-medium text-legal-accent">Requires Datalog reasoner rerun</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
