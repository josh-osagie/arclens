import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import { folderKey } from "./clusterGraph";
import { DAGRE_LAYOUT_THRESHOLD } from "./viewerConfig";
import type { AtlasGraph, AtlasGraphNode, GraphNodeType } from "./types";
import type { AtlasNodeData } from "./buildFlowGraph";

export const LAYOUT_PRESETS = [
  { id: "tree-down", label: "Tree down" },
  { id: "tree-right", label: "Tree right" },
  { id: "layers-from-entry", label: "Layers from entry" },
  { id: "by-folder", label: "By folder" },
  { id: "by-type", label: "By type" },
  { id: "compact", label: "Compact" },
] as const;

export type LayoutPreset = (typeof LAYOUT_PRESETS)[number]["id"];

export const DEFAULT_LAYOUT_PRESET: LayoutPreset = "tree-down";

const STORAGE_KEY = "react-atlas-layout-preset";

export const NODE_W = 196;
export const NODE_H = 88;
const GRID_GAP_X = 24;
const GRID_GAP_Y = 24;
const COMPACT_GRID_GAP_X = 12;
const COMPACT_GRID_GAP_Y = 12;

const DAGRE_DEFAULT = { nodesep: 70, ranksep: 90, marginx: 40, marginy: 40 };
const DAGRE_COMPACT = { nodesep: 35, ranksep: 45, marginx: 20, marginy: 20 };

const TYPE_ORDER: GraphNodeType[] = [
  "entry",
  "component",
  "hook",
  "context",
  "utility",
  "config",
];

type DagreOptions = {
  rankdir?: "TB" | "LR";
  compact?: boolean;
};

export function loadLayoutPreset(): LayoutPreset {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && LAYOUT_PRESETS.some((preset) => preset.id === raw)) {
      return raw as LayoutPreset;
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_LAYOUT_PRESET;
}

export function saveLayoutPreset(preset: LayoutPreset): void {
  try {
    localStorage.setItem(STORAGE_KEY, preset);
  } catch {
    // ignore quota errors
  }
}

export function nextLayoutPreset(current: LayoutPreset): LayoutPreset {
  const index = LAYOUT_PRESETS.findIndex((preset) => preset.id === current);
  const next = LAYOUT_PRESETS[(index + 1) % LAYOUT_PRESETS.length];
  return next?.id ?? DEFAULT_LAYOUT_PRESET;
}

function dagreLayout(
  nodes: Node<AtlasNodeData>[],
  edges: Edge[],
  options: DagreOptions = {},
) {
  const compact = options.compact ?? false;
  const rankdir = options.rankdir ?? "TB";
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir,
    ...(compact ? DAGRE_COMPACT : DAGRE_DEFAULT),
  });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_W, height: NODE_H });
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const seen = new Set<string>();
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
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

function gridLayout(nodes: Node<AtlasNodeData>[], compact = false) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const gapX = compact ? COMPACT_GRID_GAP_X : GRID_GAP_X;
  const gapY = compact ? COMPACT_GRID_GAP_Y : GRID_GAP_Y;
  const cellW = NODE_W + gapX;
  const cellH = NODE_H + gapY;

  return nodes.map((node, index) => ({
    ...node,
    position: {
      x: (index % cols) * cellW,
      y: Math.floor(index / cols) * cellH,
    },
  }));
}

function layoutGroup(
  nodes: Node<AtlasNodeData>[],
  edges: Edge[],
  options: DagreOptions,
) {
  if (nodes.length === 0) return nodes;
  const compact = options.compact ?? false;
  return nodes.length <= DAGRE_LAYOUT_THRESHOLD
    ? dagreLayout(nodes, edges, options)
    : gridLayout(nodes, compact);
}

function atlasNodeForFlowNode(
  node: Node<AtlasNodeData>,
  graph?: AtlasGraph,
): AtlasGraphNode | undefined {
  if (!graph) return undefined;
  return graph.nodes.find(
    (candidate) => candidate.id === (node.data.nodeId ?? node.id),
  );
}

function bfsLayersLayout(
  nodes: Node<AtlasNodeData>[],
  edges: Edge[],
  entryIds: string[],
  compact: boolean,
) {
  const ranksep = compact ? DAGRE_COMPACT.ranksep : DAGRE_DEFAULT.ranksep;
  const nodesep = compact ? DAGRE_COMPACT.nodesep : DAGRE_DEFAULT.nodesep;

  const nodeIds = new Set(nodes.map((node) => node.id));
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    const list = adjacency.get(edge.source) ?? [];
    list.push(edge.target);
    adjacency.set(edge.source, list);
  }

  const layers = new Map<string, number>();
  const queue: string[] = [];
  const seeds = entryIds.filter((id) => nodeIds.has(id));

  if (seeds.length === 0) {
    const incoming = new Set<string>();
    for (const edge of edges) {
      if (nodeIds.has(edge.target)) incoming.add(edge.target);
    }
    for (const id of nodeIds) {
      if (!incoming.has(id)) seeds.push(id);
    }
  }

  if (seeds.length === 0) {
    seeds.push(...nodeIds);
  }

  for (const id of seeds) {
    if (!layers.has(id)) {
      layers.set(id, 0);
      queue.push(id);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const depth = layers.get(current)!;
    for (const next of adjacency.get(current) ?? []) {
      if (!layers.has(next)) {
        layers.set(next, depth + 1);
        queue.push(next);
      }
    }
  }

  let maxLayer = 0;
  for (const depth of layers.values()) {
    maxLayer = Math.max(maxLayer, depth);
  }
  for (const id of nodeIds) {
    if (!layers.has(id)) {
      layers.set(id, maxLayer + 1);
    }
  }

  const byLayer = new Map<number, string[]>();
  for (const [id, layer] of layers) {
    const list = byLayer.get(layer) ?? [];
    list.push(id);
    byLayer.set(layer, list);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const [layer, ids] of [...byLayer.entries()].sort(([a], [b]) => a - b)) {
    const sorted = [...ids].sort();
    sorted.forEach((id, index) => {
      positions.set(id, {
        x: index * (NODE_W + nodesep),
        y: layer * (NODE_H + ranksep),
      });
    });
  }

  return nodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? { x: 0, y: 0 },
  }));
}

function byFolderLayout(
  nodes: Node<AtlasNodeData>[],
  edges: Edge[],
  graph: AtlasGraph,
  compact: boolean,
) {
  const groups = new Map<string, Node<AtlasNodeData>[]>();

  for (const node of nodes) {
    const atlasNode = atlasNodeForFlowNode(node, graph);
    const folder = atlasNode ? folderKey(atlasNode.file) : "unknown";
    const list = groups.get(folder) ?? [];
    list.push(node);
    groups.set(folder, list);
  }

  const folderGap = compact ? 80 : 120;
  let offsetX = 0;
  const positions = new Map<string, { x: number; y: number }>();

  for (const folder of [...groups.keys()].sort()) {
    const groupNodes = groups.get(folder)!;
    const groupIds = new Set(groupNodes.map((node) => node.id));
    const groupEdges = edges.filter(
      (edge) => groupIds.has(edge.source) && groupIds.has(edge.target),
    );
    const laidOut = layoutGroup(groupNodes, groupEdges, {
      rankdir: "TB",
      compact,
    });

    let maxX = 0;
    for (const laidOutNode of laidOut) {
      positions.set(laidOutNode.id, {
        x: laidOutNode.position.x + offsetX,
        y: laidOutNode.position.y,
      });
      maxX = Math.max(maxX, laidOutNode.position.x + NODE_W);
    }

    offsetX += maxX + folderGap;
  }

  return nodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  }));
}

function byTypeLayout(
  nodes: Node<AtlasNodeData>[],
  edges: Edge[],
  compact: boolean,
) {
  const groups = new Map<GraphNodeType, Node<AtlasNodeData>[]>();

  for (const node of nodes) {
    const type = node.data.type ?? "utility";
    const list = groups.get(type) ?? [];
    list.push(node);
    groups.set(type, list);
  }

  const typeGap = compact ? 60 : 100;
  let offsetX = 0;
  const positions = new Map<string, { x: number; y: number }>();

  for (const type of TYPE_ORDER) {
    const groupNodes = groups.get(type);
    if (!groupNodes?.length) continue;

    const groupIds = new Set(groupNodes.map((node) => node.id));
    const groupEdges = edges.filter(
      (edge) => groupIds.has(edge.source) && groupIds.has(edge.target),
    );
    const laidOut = layoutGroup(groupNodes, groupEdges, {
      rankdir: "TB",
      compact,
    });

    let maxX = 0;
    for (const laidOutNode of laidOut) {
      positions.set(laidOutNode.id, {
        x: laidOutNode.position.x + offsetX,
        y: laidOutNode.position.y,
      });
      maxX = Math.max(maxX, laidOutNode.position.x + NODE_W);
    }

    offsetX += maxX + typeGap;
  }

  return nodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  }));
}

export type LayoutContext = {
  entryIds?: string[];
  graph?: AtlasGraph;
};

export function layoutNodesByPreset(
  nodes: Node<AtlasNodeData>[],
  edges: Edge[],
  mode: LayoutPreset,
  context: LayoutContext = {},
): Node<AtlasNodeData>[] {
  if (nodes.length === 0) return nodes;

  const compact = mode === "compact";

  switch (mode) {
    case "tree-down":
      return layoutGroup(nodes, edges, { rankdir: "TB", compact: false });
    case "tree-right":
      return layoutGroup(nodes, edges, { rankdir: "LR", compact: false });
    case "layers-from-entry":
      return bfsLayersLayout(nodes, edges, context.entryIds ?? [], compact);
    case "by-folder":
      if (!context.graph) {
        return layoutGroup(nodes, edges, { rankdir: "TB", compact: false });
      }
      return byFolderLayout(nodes, edges, context.graph, compact);
    case "by-type":
      return byTypeLayout(nodes, edges, compact);
    case "compact":
      return layoutGroup(nodes, edges, { rankdir: "TB", compact: true });
    default:
      return layoutGroup(nodes, edges, { rankdir: "TB", compact: false });
  }
}
