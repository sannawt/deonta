import type { RegulationReadiness, SelectionDetail } from "@/types/workbench";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { readinessBadgeVariant } from "./status";
import { FactScale } from "./FactScale";
import { GateCard } from "./GateCard";
import { InterpretationProfiles } from "./InterpretationProfiles";
import { CounterfactualSimulator } from "./CounterfactualSimulator";
import type { InterpretationProfile, Counterfactual } from "@/types/workbench";
import { Scale } from "lucide-react";

interface Props {
  intro: string;
  regulations: RegulationReadiness[];
  interpretationProfiles: InterpretationProfile[];
  counterfactuals: Counterfactual[];
  activeProfileId: string;
  onProfileChange: (id: string) => void;
  counterfactualState: Record<string, boolean>;
  onCounterfactualToggle: (id: string) => void;
  selection: SelectionDetail | null;
  onSelectGate: (detail: SelectionDetail) => void;
  determinationRun: boolean;
}

export function CenterPanel({
  intro,
  regulations,
  interpretationProfiles,
  counterfactuals,
  activeProfileId,
  onProfileChange,
  counterfactualState,
  onCounterfactualToggle,
  selection,
  onSelectGate,
  determinationRun,
}: Props) {
  return (
    <main className="flex h-full flex-col overflow-hidden bg-paper">
      <header className="shrink-0 border-b border-paper-line bg-paper-surface px-6 py-5">
        <div className="flex items-start gap-3">
          <Scale className="mt-0.5 h-5 w-5 text-legal-accent" />
          <div>
            <h1 className="font-serif text-xl font-semibold text-ink">
              Decisive fact map / applicability readiness
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-ink-mid leading-relaxed">{intro}</p>
          </div>
        </div>
        {determinationRun && (
          <p className="mt-3 rounded-md border border-legal-warn/30 bg-legal-warnBg px-3 py-2 text-xs text-legal-warn">
            Mock determination complete — in production this calls the Datalog reasoner only after fact review.
          </p>
        )}
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-6">
        {regulations.map((reg) => (
          <Card key={reg.shortCode} className="overflow-hidden">
            <CardHeader className="bg-paper-muted/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{reg.regulation}</CardTitle>
                  <CardDescription className="mt-1">
                    Applicability readiness — not a final verdict
                  </CardDescription>
                </div>
                <Badge variant={readinessBadgeVariant(reg.readiness)} className="text-xs">
                  {reg.readiness}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-mid">
                <Stat label="Decisive facts" value={reg.decisiveFactCount} />
                <Stat label="Missing" value={reg.missingCount} />
                <Stat label="Contested" value={reg.contestedCount} />
                <Stat label="Exclusions" value={reg.exclusionCount} />
              </div>
              <p className="mt-3 text-sm text-ink-mid border-l-2 border-legal-accent/40 pl-3">
                {reg.determinationNote}
              </p>
              <FactScale regulation={reg.shortCode} scale={reg.scale} />
            </CardHeader>
            <CardContent className="pt-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-dim">
                Four applicability gates
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {reg.gates.map((gate) => (
                  <GateCard
                    key={gate.id}
                    gate={gate}
                    regulation={reg.shortCode}
                    selected={
                      selection?.gate?.id === gate.id &&
                      selection?.regulation === reg.shortCode
                    }
                    onSelect={(g, r) =>
                      onSelectGate({
                        gate: g,
                        regulation: r,
                        fact: g.knownFacts[0] ?? g.missingFacts[0],
                        proofTrace: {
                          legalGraphNodeIds: g.legalSources.map((s) => s.nodeId),
                          scenarioGraphNodeIds: [],
                          ruleId: g.id,
                          predicateSchemaId: g.ruleSnippet.slice(0, 24),
                        },
                      })
                    }
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        <InterpretationProfiles
          profiles={interpretationProfiles}
          activeId={activeProfileId}
          onChange={onProfileChange}
        />
        <CounterfactualSimulator
          items={counterfactuals}
          state={counterfactualState}
          onToggle={onCounterfactualToggle}
        />
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-paper-line bg-paper-surface px-2.5 py-0.5">
      <span className="text-ink-dim">{label}: </span>
      <span className="font-semibold text-ink">{value}</span>
    </span>
  );
}
