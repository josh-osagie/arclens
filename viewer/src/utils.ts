import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import graph from "../../graph.json";

const typeColors = {
  component: "#3b82f6",
  hook: "#bbffee",
  utility: "#10b981",
  service: "#10b981",
} as const;

type NodeType = keyof typeof typeColors;

type GraphNode = {
  id: string;
  name: string;
  file: string;
  type: NodeType;
};

type GraphEdge = {
  from: string;
  to: string;
  type: "imports" | "renders" | "uses";
};

const edgeColors: Record<GraphEdge["type"], string> = {
  imports: "#64748b",
  renders: "#3b82f6",
  uses: "#8b5cf6",
};

const typedGraph = graph as {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

const nodeTypes = ["component", "hook", "utility"] as const;

function layoutGraph(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 70, ranksep: 90, marginx: 40, marginy: 40 });

  for (const node of nodes) {
    g.setNode(node.id, { width: 180, height: 72 });
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
        x: position.x - 90,
        y: position.y - 36,
      },
    };
  });
}

const initialNodes: Node[] = typedGraph.nodes.map((node) => ({
  id: node.id,
  type: "atlas",
  position: { x: 0, y: 0 },
  data: { label: node.name, type: node.type },
}));

const seenEdges = new Set<string>();
const initialEdges: Edge[] = typedGraph.edges
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
    type: "smoothstep",
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

const rfNodes = layoutGraph(initialNodes, initialEdges);
const rfEdges = initialEdges;

export { rfNodes, rfEdges, nodeTypes, typeColors };
