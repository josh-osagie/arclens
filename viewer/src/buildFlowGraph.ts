import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import type { AtlasGraph, AtlasGraphNode } from "./types";

export const typeColors = {
  component: "#60a5fa",
  hook: "#c084fc",
  utility: "#34d399",
  context: "#fbbf24",
  entry: "#22d3ee",
  config: "#94a3b8",
} as const;

export const typeLabels = {
  component: "Component",
  hook: "Hook",
  utility: "Utility",
  context: "Context",
  entry: "Entry",
  config: "Config",
} as const;

export const nodeTypes = [
  "component",
  "hook",
  "utility",
  "context",
  "entry",
  "config",
] as const;

const edgeColors: Record<"imports" | "renders" | "uses", string> = {
  imports: "#64748b",
  renders: "#3b82f6",
  uses: "#8b5cf6",
};

export type AtlasNodeData = {
  label: string;
  type: AtlasGraphNode["type"];
  fileLabel?: string;
  graphNode: AtlasGraphNode;
};

function layoutGraph(nodes: Node<AtlasNodeData>[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 70, ranksep: 90, marginx: 40, marginy: 40 });

  for (const node of nodes) {
    g.setNode(node.id, { width: 196, height: 88 });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const position = g.node(node.id);
    return {
      ...node,
      position: {
        x: position.x - 98,
        y: position.y - 44,
      },
    };
  });
}

export function buildFlowGraph(graph: AtlasGraph): {
  nodes: Node<AtlasNodeData>[];
  edges: Edge[];
} {
  const initialNodes: Node<AtlasNodeData>[] = graph.nodes.map((node) => ({
    id: node.id,
    type: "atlas",
    position: { x: 0, y: 0 },
    draggable: true,
    data: {
      label: node.name,
      type: node.type,
      fileLabel: node.file === "external" ? undefined : relFile(node.file),
      graphNode: node,
    },
  }));

  const seenEdges = new Set<string>();
  const initialEdges: Edge[] = graph.edges
    .filter((edge) => {
      const key = `${edge.from}|${edge.to}|${edge.type}`;
      if (seenEdges.has(key)) return false;
      seenEdges.add(key);
      return true;
    })
    .map((edge, i) => ({
      id: `e${i}`,
      source: edge.from,
      target: edge.to,
      label: edge.type,
      type: "default",
      animated: edge.type === "uses",
      style: { stroke: edgeColors[edge.type], strokeWidth: 2 },
      labelStyle: {
        fill: "#e2e8f0",
        fontSize: 11,
        fontWeight: 600,
      },
      labelBgStyle: {
        fill: "#1e293b",
        fillOpacity: 0.9,
      },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: {
        type: "arrowclosed" as const,
        color: edgeColors[edge.type],
      },
    }));

  return {
    nodes: layoutGraph(initialNodes, initialEdges),
    edges: initialEdges,
  };
}

export function getConnectedNodeIds(
  graphNode: AtlasGraphNode,
): Set<string> {
  const ids = new Set<string>([graphNode.id]);
  for (const conn of graphNode.connections.incoming) {
    ids.add(conn.nodeId);
  }
  for (const conn of graphNode.connections.outgoing) {
    ids.add(conn.nodeId);
  }
  return ids;
}

export function relFile(filePath: string): string {
  if (filePath === "external") return "external";
  const parts = filePath.replace(/\\/g, "/").split("/");
  const samplesIdx = parts.lastIndexOf("samples");
  if (samplesIdx >= 0) {
    return parts.slice(samplesIdx).join("/");
  }
  return parts.slice(-2).join("/") || filePath;
}
