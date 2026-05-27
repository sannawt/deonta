import type { InterpretationProfile } from "@/types/workbench";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GitBranch } from "lucide-react";

interface Props {
  profiles: InterpretationProfile[];
  activeId: string;
  onChange: (id: string) => void;
}

export function InterpretationProfiles({ profiles, activeId, onChange }: Props) {
  const active = profiles.find((p) => p.id === activeId) ?? profiles[0];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <GitBranch className="h-4 w-4 text-legal-accent" />
          Interpretation profiles
        </CardTitle>
        <p className="text-xs text-ink-mid">Rule sensitivity — not probability. Future: reasoner profile config.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                p.id === activeId
                  ? "border-legal-accent bg-legal-soft text-legal-accent"
                  : "border-paper-line bg-paper-surface text-ink-mid hover:border-legal-accent/40"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {active && (
          <div className="rounded-md border border-paper-line bg-paper-muted/50 p-4 text-sm space-y-3">
            <p className="text-ink-mid">{active.description}</p>
            <Section title="Rules that change" items={active.ruleChanges} />
            <Section title="Decisive fact shifts" items={active.decisiveFactShifts} />
            {active.gateSensitivity.length > 0 && (
              <div>
                <p className="text-xs font-medium text-ink-dim mb-1">Gate sensitivity</p>
                <ul className="space-y-1 text-xs text-ink-mid">
                  {active.gateSensitivity.map((g, i) => (
                    <li key={i} className="font-mono">
                      {g.regulation} / {g.gate}: {g.from} → {g.to}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {active.likelyDeterminationChange && (
              <p className="text-xs text-legal-warn border-l-2 border-legal-warn pl-2">
                If reasoner run: {active.likelyDeterminationChange}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-medium text-ink-dim mb-1">{title}</p>
      <ul className="list-disc pl-4 text-xs text-ink-mid space-y-0.5">{items.map((x) => <li key={x}>{x}</li>)}</ul>
    </div>
  );
}
