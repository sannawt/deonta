import { useState } from "react";
import type { ChatFact, ChatMessage, WorkbenchScenario } from "@/types/workbench";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { factStatusLabel } from "./status";
import { MessageSquare, Plus, HelpCircle, Play, Check, AlertTriangle } from "lucide-react";

interface Props {
  scenario: WorkbenchScenario;
  onRunDetermination: () => void;
  determinationRun: boolean;
}

export function LeftPanel({ scenario, onRunDetermination, determinationRun }: Props) {
  const [input, setInput] = useState("");

  return (
    <aside className="flex h-full flex-col border-r border-paper-line bg-paper-surface">
      <header className="border-b border-paper-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Chat & factual intake</h2>
        <p className="mt-1 text-xs text-ink-mid">
          LLM supports extraction — the symbolic engine decides applicability.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-3">
        {scenario.chatMessages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
      </div>

      <div className="border-t border-paper-line px-4 py-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-dim">Fact ledger</p>
        <ul className="mb-3 max-h-48 space-y-2 overflow-y-auto scrollbar-thin">
          {scenario.chatFacts.map((f) => (
            <FactRow key={f.id} fact={f} />
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm"><Check className="h-3.5 w-3.5" /> Confirm extracted</Button>
          <Button variant="outline" size="sm"><AlertTriangle className="h-3.5 w-3.5" /> Mark contested</Button>
          <Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5" /> Add fact</Button>
          <Button variant="outline" size="sm"><HelpCircle className="h-3.5 w-3.5" /> Follow-up</Button>
        </div>
        <Button
          variant={determinationRun ? "default" : "secondary"}
          size="sm"
          className="mt-3 w-full"
          onClick={onRunDetermination}
        >
          <Play className="h-3.5 w-3.5" />
          {determinationRun ? "Determination ran (mock)" : "Run applicability determination"}
        </Button>
        {!determinationRun && (
          <p className="mt-2 text-[10px] text-ink-dim">
            Secondary until decisive fact map is reviewed. Future: POST /api/applicability-flow
          </p>
        )}
      </div>

      <div className="border-t border-paper-line p-3">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-paper-line bg-paper-muted px-3 py-2 text-sm outline-none focus:border-legal-accent"
            placeholder="Ask about applicability…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button size="sm" variant="default" disabled={!input.trim()}>
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "ml-6" : "mr-4"}>
      <p className="text-[10px] font-medium uppercase text-ink-dim mb-1">{isUser ? "You" : "Extraction assistant"}</p>
      <div className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${isUser ? "bg-legal-soft text-ink" : "bg-paper-muted text-ink-mid border border-paper-line"}`}>
        {message.content}
      </div>
    </div>
  );
}

function FactRow({ fact }: { fact: ChatFact }) {
  const variant =
    fact.status === "confirmed" ? "ok" :
    fact.status === "missing" ? "warn" :
    fact.status === "contested" ? "accent" :
    fact.status === "extracted" ? "default" : "outline";
  return (
    <li className="rounded-md border border-paper-line bg-paper-muted/60 px-2 py-1.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-ink">{fact.label}</p>
          <p className="font-mono text-[10px] text-ink-dim">{fact.predicate}</p>
        </div>
        <Badge variant={variant} className="shrink-0 text-[10px]">{factStatusLabel(fact.status)}</Badge>
      </div>
    </li>
  );
}
