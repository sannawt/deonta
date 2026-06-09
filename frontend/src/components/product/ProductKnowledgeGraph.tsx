import { useEffect, useRef } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import type { KgEdge, KgNode } from "../../lib/api";
import { KG_EDGE_COLOR, KG_EDGE_HIGHLIGHT, KG_TYPE_COLORS } from "../../lib/kgTheme";

function nodeStyle(type: string) {
  const fill = KG_TYPE_COLORS[type] ?? "#8aa8c8";
  const border = type === "Actor" ? "#333333" : fill;
  return {
    background: fill,
    border,
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

  useEffect(() => {
    if (!containerRef.current) return;

    const productNodes = nodes.filter((n) => n.type !== "PlaybookContext" && n.source !== "playbook");
    const productIds = new Set(productNodes.map((n) => n.id));
    const productEdges = edges.filter((e) => productIds.has(e.from) && productIds.has(e.to));

    const visNodes = new DataSet(
      productNodes.map((n) => {
        const label = n.label || n.type;
        return {
          id: n.id,
          label,
          title: `${n.type}: ${label}`,
          shape: "dot",
          size: n.type === "Product" ? 24 : n.type === "Scenario" ? 20 : 14,
          color: nodeStyle(n.type),
          font: { color: "#333333", size: 13, face: "Plus Jakarta Sans" },
        };
      }),
    );
    const visEdges = new DataSet(
      productEdges.map((e) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        label: e.label || e.type,
        arrows: { to: { enabled: true, scaleFactor: 0.45 } },
        color: { color: KG_EDGE_COLOR, highlight: KG_EDGE_HIGHLIGHT, hover: KG_EDGE_HIGHLIGHT },
        width: 1,
        smooth: { enabled: true, type: "continuous", roundness: 0.4 },
        font: { size: 9, color: "#888888", strokeWidth: 0, face: "Plus Jakarta Sans" },
      })),
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
      edges: { font: { align: "middle" } },
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
        <p className="ct-kg-hint">Your product map appears here as you fill in the form.</p>
      )}
    </div>
  );
}
