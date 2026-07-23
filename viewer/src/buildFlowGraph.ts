import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import { edgeColors } from "./design/tokens";
import { DAGRE_LAYOUT_THRESHOLD } from "./viewerConfig";
import type { AtlasGraph, AtlasGraphNode } from "./types";

export { edgeColors, nodeTypes, typeColors, typeLabels } from "./design/tokens";

export type AtlasNodeData = {
  label: string;
  type: AtlasGraphNode["type"];
  fileLabel?: string;
  nodeId: string;
  compact?: boolean;
  selected?: boolean;
  dimmed?: boolean;
};

export type ClusterNodeData = {
  label: string;
  folder: string;
  count: number;
  selected?: boolean;
  dimmed?: boolean;
};

const NODE_W = 196;
const NODE_H = 88;
const GRID_GAP_X = 24;
const GRID_GAP_Y = 24;

function dagreLayout(nodes: Node<AtlasNodeData>[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 70, ranksep: 90, marginx: 40, marginy: 40 });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_W, height: NODE_H });
  }

  const seen = new Set<string>();
  for (const edge of edges) {
    const key = `${edge.source}|${edge.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const position = g.node(node.id);
    return {
      ...node,
      position: {
        x: position.x - NODE_W / 2,
        y: position.y - NODE_H / 2,
      },
    };
  });
}

function gridLayout(nodes: Node<AtlasNodeData>[]) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const cellW = NODE_W + GRID_GAP_X;
  const cellH = NODE_H + GRID_GAP_Y;

  return nodes.map((node, index) => ({
    ...node,
    position: {
      x: (index % cols) * cellW,
      y: Math.floor(index / cols) * cellH,
    },
  }));
}

function layoutFromSaved(graph: AtlasGraph, nodes: Node<AtlasNodeData>[]) {
  const positions = new Map(
    graph.nodes
      .filter((node) => node.layout)
      .map((node) => [node.id, node.layout!]),
  );

  if (positions.size === 0) return null;

  return nodes.map((node) => {
    const saved = positions.get(node.id);
    if (!saved) return node;
    return {
      ...node,
      position: {
        x: saved.x - NODE_W / 2,
        y: saved.y - NODE_H / 2,
      },
    };
  });
}

function layoutNodes(
  graph: AtlasGraph,
  nodes: Node<AtlasNodeData>[],
  edges: Edge[],
) {
  if (nodes.length === 0) return nodes;

  const layoutTargets = nodes.filter((node) => node.type !== "cluster");
  const saved = layoutFromSaved(graph, layoutTargets);
  const laidOut = saved ?? (layoutTargets.length <= DAGRE_LAYOUT_THRESHOLD
    ? dagreLayout(layoutTargets, edges)
    : gridLayout(layoutTargets));

  const positions = new Map(laidOut.map((node) => [node.id, node.position]));

  return nodes.map((node, index) => {
    if (node.type === "cluster") {
      const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
      const cellW = NODE_W + GRID_GAP_X;
      const cellH = NODE_H + GRID_GAP_Y;
      return {
        ...node,
        position: {
          x: (index % cols) * cellW,
          y: Math.floor(index / cols) * cellH,
        },
      };
    }
    return {
      ...node,
      position: positions.get(node.id) ?? node.position,
    };
  });
}

export function buildFlowGraph(
  graph: AtlasGraph,
  options: { compact?: boolean } = {},
): {
  nodes: Node<AtlasNodeData>[];
  edges: Edge[];
} {
  const compact = options.compact ?? false;
  const initialNodes: Node<AtlasNodeData>[] = graph.nodes.map((node) => {
    if (node.cluster) {
      return {
        id: node.id,
        type: "cluster",
        position: { x: 0, y: 0 },
        draggable: true,
        data: {
          label: node.name,
          folder: node.cluster.folder,
          count: node.cluster.count,
        },
      } as unknown as Node<AtlasNodeData>;
    }

    return {
      id: node.id,
      type: "atlas",
      position: { x: 0, y: 0 },
      draggable: true,
      data: {
        label: node.name,
        type: node.type,
        fileLabel: node.file === "external" ? undefined : relFile(node.file),
        nodeId: node.id,
        compact,
      },
    };
  });

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
      label: compact ? undefined : edge.type,
      type: "default",
      // Never use stroke-dasharray bulk animation — costly at scale (see Liam ERD).
      animated: false,
      style: {
        stroke: edgeColors[edge.type],
        strokeWidth: compact ? 1.25 : 2,
      },
      ...(compact
        ? {}
        : {
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
          }),
      markerEnd: {
        type: "arrowclosed" as const,
        color: edgeColors[edge.type],
      },
    }));

  return {
    nodes: layoutNodes(graph, initialNodes, initialEdges),
    edges: initialEdges,
  };
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
