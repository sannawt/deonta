import type { ReactNode } from "react";
import type { SelectionDetail, WorkbenchScenario } from "@/types/workbench";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { factStatusLabel } from "./status";
import { BookOpen, Database, FileCode2, Network } from "lucide-react";

interface Props {
  scenario: WorkbenchScenario;
  selection: SelectionDetail | null;
}

export function RightPanel({ scenario, selection }: Props) {
  const gate = selection?.gate;
  const fact = selection?.fact;

  return (
    <aside className="flex h-full flex-col border-l border-paper-line bg-paper-surface">
      <header className="border-b border-paper-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Evidence, legal text & trace</h2>
        <p className="text-xs text-ink-mid mt-1">Select a gate or fact in the center panel.</p>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {!selection ? (
          <p className="text-sm text-ink-dim">Click an applicability gate card to inspect legal sources, rules, and provenance.</p>
        ) : (
          <>
            <Section icon={<Database className="h-4 w-4" />} title="Decisive fact detail">
              {fact ? (
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-ink">{fact.label}</p>
                  <p className="font-mono text-xs text-legal-accent">{fact.predicate}</p>
                  <Badge variant="outline">{factStatusLabel(fact.status)}</Badge>
                  {fact.effect && <p className="text-xs text-ink-mid">Role: {fact.effect}</p>}
                  {fact.whyItMatters && <p className="text-xs text-ink-mid">{fact.whyItMatters}</p>}
                  {fact.counterfactualImpact && (
                    <p className="text-xs text-legal-warn border-l-2 border-legal-warn pl-2 mt-2">{fact.counterfactualImpact}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-ink-dim">No fact selected.</p>
              )}
            </Section>

            {gate && (
              <>
                <Section icon={<BookOpen className="h-4 w-4" />} title="Legal source">
                  {gate.legalSources.map((s) => (
                    <blockquote key={s.nodeId} className="mb-2 rounded border border-paper-line bg-paper-muted p-2 text-xs italic text-ink-mid">
                      <p className="font-medium not-italic text-ink mb-1">{s.label}</p>
                      {s.excerpt}
                      <p className="mt-1 font-mono text-[10px] text-ink-dim">{s.nodeId}</p>
                    </blockquote>
                  ))}
                  {!gate.legalSources.length && <p className="text-xs text-ink-dim">Future: Legal KG via local CSV / Neo4j</p>}
                </Section>

                <Section icon={<Network className="h-4 w-4" />} title="Scenario evidence">
                  <p className="text-xs text-ink-mid">Future: Scenario Neo4j KG — company products, actors, deployments.</p>
                  {(gate.knownFacts[0]?.source || fact?.source) && (
                    <p className="font-mono text-[10px] mt-1">{gate.knownFacts[0]?.source ?? fact?.source}</p>
                  )}
                </Section>

                <Section icon={<FileCode2 className="h-4 w-4" />} title="Datalog rule snippet">
                  <pre className="rounded bg-paper-muted p-2 font-mono text-[10px] text-ink-mid overflow-x-auto">
                    {gate.ruleSnippet || "—"}
                  </pre>
                </Section>

                <Section icon={<Database className="h-4 w-4" />} title="Graph provenance">
                  <ul className="font-mono text-[10px] text-ink-dim space-y-1">
                    {selection.proofTrace?.legalGraphNodeIds.map((id) => (
                      <li key={id}>Legal: {id} — {scenario.legalGraphNodes[id]?.label ?? "node"}</li>
                    ))}
                    <li>Rule: {selection.proofTrace?.ruleId}</li>
                    <li>Schema: {selection.proofTrace?.predicateSchemaId}</li>
                  </ul>
                </Section>

                <Section icon={<BookOpen className="h-4 w-4" />} title="Counterfactual impact">
                  <p className="text-xs text-ink-mid">{gate.counterfactualImpact || gate.whyItMatters}</p>
                </Section>
              </>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-dim">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-4">{children}</CardContent>
    </Card>
  );
}
