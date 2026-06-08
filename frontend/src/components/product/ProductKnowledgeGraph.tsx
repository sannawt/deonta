import { useEffect, useRef } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import type { KgEdge, KgNode } from "../../lib/api";

const TYPE_COLORS: Record<string, string> = {
  Product: "#4a7fd4",
  Scenario: "#4a7fd4",
  Market: "#5ba8a0",
  Data: "#c4a574",
  Datum: "#c4a574",
  AI: "#9b8ec4",
  AISystem: "#9b8ec4",
  Actor: "#7a9e6a",
  Document: "#a8b4c0",
};

function nodeStyle(type: string) {
  const fill = TYPE_COLORS[type] ?? "#b8c5d4";
  return {
    background: fill,
    border: fill,
    highlight: { background: fill, border: "#2d6be4" },
    hover: { background: fill, border: "#2d6be4" },
  };
}

interface Props {
  nodes: KgNode[];
  edges: KgEdge[];
}

export function ProductKnowledgeGraph({ nodes, edges }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesRef = useRef(nodes);

  nodesRef.current = nodes;

  useEffect(() => {
    if (!containerRef.current) return;

    const productNodes = nodes.filter((n) => n.type !== "PlaybookContext" && n.source !== "playbook");
    const productIds = new Set(productNodes.map((n) => n.id));
    const productEdges = edges.filter((e) => productIds.has(e.from) && productIds.has(e.to));

    const visNodes = new DataSet(
      productNodes.map((n) => {
        const isMain =
          n.type === "Product" || n.type === "Scenario";
        const label = isMain ? "Your product" : n.label || n.type;
        return {
        id: n.id,
        label,
        title: `${n.type}: ${label}`,
        shape: "dot",
        size: n.type === "Product" ? 24 : n.type === "Scenario" ? 20 : 14,
        color: nodeStyle(n.type),
        font: { color: "#334155", size: 13, face: "Plus Jakarta Sans" },
      };
      })
    );
    const visEdges = new DataSet(
      productEdges.map((e) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        arrows: { to: { enabled: true, scaleFactor: 0.45 } },
        color: { color: "#e8ecf0", highlight: "#c5d0dc", hover: "#c5d0dc" },
        width: 1,
        smooth: { enabled: true, type: "continuous", roundness: 0.4 },
      }))
    );

    const data = { nodes: visNodes, edges: visEdges };
    const options = {
      physics: {
        enabled: true,
        stabilization: { iterations: 80 },
        barnesHut: {
          gravitationalConstant: -12000,
          springLength: 140,
          damping: 0.09,
        },
      },
      interaction: {
        hover: true,
        zoomView: true,
        dragView: true,
        navigationButtons: false,
        keyboard: true,
      },
      edges: { font: { size: 0 } },
      layout: { improvedLayout: true },
    };

    if (networkRef.current) {
      networkRef.current.setData(data);
    } else {
      networkRef.current = new Network(containerRef.current, data, options);
    }
  }, [nodes, edges]);

  useEffect(() => {
    return () => {
      networkRef.current?.destroy();
      networkRef.current = null;
    };
  }, []);

  return (
    <div className="ct-kg-wrap">
      <div ref={containerRef} className="ct-kg-canvas" aria-label="Product knowledge graph" />
      {nodes.length === 0 && (
        <p className="ct-kg-hint">Your product map appears here as you add details.</p>
      )}
    </div>
  );
}
