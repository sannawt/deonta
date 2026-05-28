import { useMemo } from "react";
import type { ChatResponse, ScopeAnalysis } from "../../types/chat";
import { stripInternalIds } from "../../lib/utils";

export type GraphNodeType = "Product" | "Instrument" | "Provision" | "Rule" | "Fact";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  subtitle?: string;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function nodeColor(t: GraphNodeType): { fill: string; stroke: string } {
  switch (t) {
    case "Product":
      return { fill: "rgba(255,255,255,.95)", stroke: "rgba(15,29,78,.25)" };
    case "Instrument":
      return { fill: "rgba(232,242,255,.95)", stroke: "rgba(45,107,228,.35)" };
    case "Provision":
      return { fill: "rgba(238,242,255,.95)", stroke: "rgba(30,58,138,.25)" };
    case "Rule":
      return { fill: "rgba(245,249,255,.95)", stroke: "rgba(45,107,228,.25)" };
    case "Fact":
      return { fill: "rgba(255,251,235,.9)", stroke: "rgba(217,119,6,.25)" };
    default:
      return { fill: "rgba(255,255,255,.95)", stroke: "rgba(45,107,228,.2)" };
  }
}

export function buildProductGraph({
  productId,
  productLabel,
  response,
}: {
  productId: string;
  productLabel: string;
  response: ChatResponse | null;
}): GraphModel {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const addNode = (n: GraphNode) => {
    if (!nodes.some((x) => x.id === n.id)) nodes.push(n);
  };
  const addEdge = (e: GraphEdge) => {
    if (!edges.some((x) => x.id === e.id)) edges.push(e);
  };

  const productNodeId = `product:${productId}`;
  addNode({ id: productNodeId, type: "Product", label: productLabel, subtitle: "Product" });

  const scopeAnalysis: ScopeAnalysis | undefined = response?.assessment?.scope_analysis ?? response?.scope_analysis;
  const instruments = scopeAnalysis?.instruments ?? [];

  for (const inst of instruments) {
    const instId = `inst:${inst.id}`;
    addNode({ id: instId, type: "Instrument", label: inst.label || inst.id, subtitle: "Instrument" });
    addEdge({ id: `e:${productNodeId}->${instId}`, from: productNodeId, to: instId, label: "assessed_under" });

    for (const dim of inst.dimensions || []) {
      for (const c of dim.citations || []) {
        const pid = `prov:${c.provision_long_id || c.label}`;
        addNode({
          id: pid,
          type: "Provision",
          label: stripInternalIds(c.label || c.provision_long_id || "Provision"),
          subtitle: c.eurlex_url ? "EUR‑Lex" : "Provision",
        });
        addEdge({
          id: `e:${instId}->${pid}:${dim.id}`,
          from: instId,
          to: pid,
          label: `legal_basis:${dim.id}`,
        });
      }

      for (const r of dim.rules_invoked || []) {
        const rid = `rule:${r.provision_long_id || r.head_atom || Math.random().toString(16).slice(2)}`;
        addNode({
          id: rid,
          type: "Rule",
          label: stripInternalIds(r.provision_long_id || r.head_atom || "Rule"),
          subtitle: r.kind || "rule",
        });
        addEdge({ id: `e:${instId}->${rid}:${dim.id}`, from: instId, to: rid, label: `invokes:${dim.id}` });
      }

      for (const f of dim.decisive_facts || []) {
        const fid = `fact:${f.atom}`;
        addNode({ id: fid, type: "Fact", label: stripInternalIds(f.label || f.atom), subtitle: f.kind });
        addEdge({ id: `e:${instId}->${fid}:${dim.id}`, from: instId, to: fid, label: `decisive_fact:${dim.id}` });
      }
    }
  }

  return { nodes, edges };
}

function layout(model: GraphModel) {
  // Simple column layout by node type for a crisp, memo-like visual.
  const groups: Record<GraphNodeType, GraphNode[]> = {
    Product: [],
    Instrument: [],
    Provision: [],
    Rule: [],
    Fact: [],
  };
  for (const n of model.nodes) groups[n.type].push(n);

  const columns: Array<{ type: GraphNodeType; x: number }> = [
    { type: "Product", x: 40 },
    { type: "Instrument", x: 320 },
    { type: "Provision", x: 600 },
    { type: "Rule", x: 880 },
    { type: "Fact", x: 1160 },
  ];

  const pos: Record<string, { x: number; y: number; w: number; h: number }> = {};
  for (const col of columns) {
    const items = groups[col.type];
    const w = 240;
    const h = 56;
    const gap = 14;
    items.forEach((n, idx) => {
      pos[n.id] = { x: col.x, y: 40 + idx * (h + gap), w, h };
    });
  }
  const width = columns[columns.length - 1].x + 300;
  const height = Math.max(520, ...Object.values(pos).map((p) => p.y + p.h + 40));
  return { pos, width, height };
}

function pathBetween(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  const x1 = a.x + a.w;
  const y1 = a.y + a.h / 2;
  const x2 = b.x;
  const y2 = b.y + b.h / 2;
  const dx = Math.max(80, (x2 - x1) * 0.6);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export function ProductGraph({
  model,
  selectedNodeId,
  onSelect,
}: {
  model: GraphModel;
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
}) {
  const { pos, width, height } = useMemo(() => layout(model), [model]);

  return (
    <div className="glass" style={{ borderRadius: 12, padding: 10, overflow: "auto" }}>
      <div className="text-label">Knowledge graph</div>
      <div className="text-xs text-muted" style={{ marginTop: 6 }}>
        Product → instruments → legal basis (provisions) → invoked rules → decisive facts.
      </div>

      <svg width={width} height={height} style={{ marginTop: 10, display: "block" }}>
        {/* edges */}
        {model.edges.map((e) => {
          const a = pos[e.from];
          const b = pos[e.to];
          if (!a || !b) return null;
          const d = pathBetween(a, b);
          const active = selectedNodeId === e.from || selectedNodeId === e.to;
          return (
            <g key={e.id}>
              <path d={d} fill="none" stroke={active ? "rgba(45,107,228,.55)" : "rgba(15,29,78,.16)"} strokeWidth={1.4} />
            </g>
          );
        })}

        {/* nodes */}
        {model.nodes.map((n) => {
          const p = pos[n.id];
          if (!p) return null;
          const c = nodeColor(n.type);
          const active = selectedNodeId === n.id;
          return (
            <g key={n.id} style={{ cursor: "pointer" }} onClick={() => onSelect(n.id)}>
              <rect
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                rx={12}
                fill={c.fill}
                stroke={active ? "rgba(45,107,228,.8)" : c.stroke}
                strokeWidth={active ? 2.2 : 1.2}
              />
              <text x={p.x + 12} y={p.y + 22} fontSize={12} fontWeight={700} fill="rgba(15,23,42,.95)">
                {n.label.length > 28 ? n.label.slice(0, 28) + "…" : n.label}
              </text>
              <text x={p.x + 12} y={p.y + 42} fontSize={10} fill="rgba(107,114,128,.95)">
                {(n.subtitle || n.type).toString().slice(0, 36)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

