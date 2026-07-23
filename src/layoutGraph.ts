import dagre from "@dagrejs/dagre";
import type { Graph, GraphEdge, GraphNode } from "./types";

export type NodeLayout = { x: number; y: number };

const DAGRE_THRESHOLD = 200;
const CELL_W = 220;
const CELL_H = 100;
const NODE_W = 196;
const NODE_H = 88;

function dagreLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Map<string, NodeLayout> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 70, ranksep: 90, marginx: 40, marginy: 40 });

  const ids = new Set(nodes.map((node) => node.id));

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_W, height: NODE_H });
  }

  const seen = new Set<string>();
  for (const edge of edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
    const key = `${edge.from}|${edge.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    g.setEdge(edge.from, edge.to);
  }

  dagre.layout(g);

  const positions = new Map<string, NodeLayout>();
  for (const node of nodes) {
    const pos = g.node(node.id);
    positions.set(node.id, { x: pos.x, y: pos.y });
  }
  return positions;
}

function folderGridLayout(nodes: GraphNode[]): Map<string, NodeLayout> {
  const sorted = [...nodes].sort((a, b) => {
    const fileCmp = a.file.localeCompare(b.file);
    return fileCmp !== 0 ? fileCmp : a.name.localeCompare(b.name);
  });

  const cols = Math.max(1, Math.ceil(Math.sqrt(sorted.length)));
  const positions = new Map<string, NodeLayout>();

  sorted.forEach((node, index) => {
    positions.set(node.id, {
      x: (index % cols) * CELL_W + NODE_W / 2,
      y: Math.floor(index / cols) * CELL_H + NODE_H / 2,
    });
  });

  return positions;
}

export function computeNodeLayouts(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Map<string, NodeLayout> {
  if (nodes.length === 0) return new Map();
  if (nodes.length <= DAGRE_THRESHOLD) {
    return dagreLayout(nodes, edges);
  }
  return folderGridLayout(nodes);
}

export function attachLayoutToNodes(
  nodes: GraphNode[],
  edges: GraphEdge[],
): GraphNode[] {
  const layouts = computeNodeLayouts(nodes, edges);
  return nodes.map((node) => ({
    ...node,
    layout: layouts.get(node.id),
  }));
}
