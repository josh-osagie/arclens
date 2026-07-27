import dagre from "@dagrejs/dagre";
import { Position, type Edge, type Node } from "@xyflow/react";
import type { AtlasGraph } from "./types";
import type { AtlasNodeData } from "./buildFlowGraph";
import { readLocalStorage, writeLocalStorage } from "./storageCompat";

export const LAYOUT_PRESETS = [
  { id: "dagre-tb", label: "Tree down" },
  { id: "dagre-lr", label: "Tree right" },
] as const;

export type LayoutPreset = (typeof LAYOUT_PRESETS)[number]["id"];

export const DEFAULT_LAYOUT_PRESET: LayoutPreset = "dagre-tb";

const STORAGE_KEY = "arclens-layout-preset";

/** @deprecated Legacy preset ids stored in localStorage before the dagre simplification. */
const LEGACY_LAYOUT_PRESETS: Record<string, LayoutPreset> = {
  "tree-down": "dagre-tb",
  "tree-right": "dagre-lr",
  "tidy-tree": "dagre-tb",
  "layers-from-entry": "dagre-tb",
  "by-folder": "dagre-tb",
  "by-type": "dagre-tb",
  compact: "dagre-tb",
};

export const NODE_W = 196;
export const NODE_H = 88;
export const CLUSTER_NODE_W = 168;
export const CLUSTER_NODE_H = 104;

const DAGRE_GRAPH = {
  nodesep: 60,
  ranksep: 90,
  marginx: 20,
  marginy: 20,
};

export type LayoutContext = {
  entryIds?: string[];
  graph?: AtlasGraph;
};

/** Prefer render-tree edges for ranked layout — matches React Flow dagre examples. */
export function filterEdgesForDagreLayout(edges: Edge[]): Edge[] {
  const renders = edges.filter((edge) => {
    const types = edge.data?.edgeTypes as string[] | undefined;
    if (types?.includes("renders")) return true;
    return edge.data?.edgeType === "renders";
  });
  return renders.length > 0 ? renders : edges;
}

export function nodeLayoutDimensions(node: Node<AtlasNodeData>): { width: number; height: number } {
  if (node.type === "cluster") {
    return { width: CLUSTER_NODE_W, height: CLUSTER_NODE_H };
  }
  return { width: NODE_W, height: NODE_H };
}

/** All visible nodes participate in dagre (including folder cluster bubbles). */
export function layoutIncludesClusterNodes(_mode: LayoutPreset): boolean {
  return true;
}

/**
 * Dagre layout following https://reactflow.dev/examples/layout/dagre
 * — ranked nodes, top/bottom or left/right handles, centered anchor conversion.
 */
export function getDagreLayoutedNodes(
  nodes: Node<AtlasNodeData>[],
  edges: Edge[],
  direction: "TB" | "LR",
  entryIds: string[] = [],
): Node<AtlasNodeData>[] {
  if (nodes.length === 0) return nodes;

  const isHorizontal = direction === "LR";
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, ...DAGRE_GRAPH });

  for (const node of nodes) {
    g.setNode(node.id, nodeLayoutDimensions(node));
  }

  for (const id of entryIds) {
    if (g.hasNode(id)) {
      g.setNode(id, { ...g.node(id), rank: 0 });
    }
  }

  const layoutEdges = filterEdgesForDagreLayout(edges);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const seen = new Set<string>();
  for (const edge of layoutEdges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    const key = `${edge.source}|${edge.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return spreadCoincidentNodes(
    nodes.map((node) => {
      const layoutNode = g.node(node.id);
      const { width, height } = nodeLayoutDimensions(node);
      return {
        ...node,
        targetPosition: isHorizontal ? Position.Left : Position.Top,
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        position: {
          x: layoutNode.x - width / 2,
          y: layoutNode.y - height / 2,
        },
      };
    }),
  );
}

/** Nudge nodes that dagre placed at the same coordinates (common for isolated clusters). */
export function spreadCoincidentNodes(
  nodes: Node<AtlasNodeData>[],
): Node<AtlasNodeData>[] {
  const placed: { x: number; y: number; h: number }[] = [];
  const GAP = 16;

  return nodes.map((node) => {
    const { height } = nodeLayoutDimensions(node);
    let { x, y } = node.position;

    const overlaps = () =>
      placed.some(
        (other) => Math.abs(other.x - x) < 8 && Math.abs(other.y - y) < 8,
      );

    while (overlaps()) {
      y += height + GAP;
    }

    placed.push({ x, y, h: height });
    return { ...node, position: { x, y } };
  });
}

export function layoutNodesByPreset(
  nodes: Node<AtlasNodeData>[],
  edges: Edge[],
  mode: LayoutPreset,
  context: LayoutContext = {},
): Node<AtlasNodeData>[] {
  const direction = mode === "dagre-lr" ? "LR" : "TB";
  return getDagreLayoutedNodes(nodes, edges, direction, context.entryIds ?? []);
}

export function loadLayoutPreset(): LayoutPreset {
  try {
    const raw = readLocalStorage(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT_PRESET;
    if (LAYOUT_PRESETS.some((preset) => preset.id === raw)) {
      return raw as LayoutPreset;
    }
    return LEGACY_LAYOUT_PRESETS[raw] ?? DEFAULT_LAYOUT_PRESET;
  } catch {
    return DEFAULT_LAYOUT_PRESET;
  }
}

export function saveLayoutPreset(preset: LayoutPreset): void {
  try {
    writeLocalStorage(STORAGE_KEY, preset);
  } catch {
    // ignore quota errors
  }
}

export function nextLayoutPreset(current: LayoutPreset): LayoutPreset {
  const index = LAYOUT_PRESETS.findIndex((preset) => preset.id === current);
  const next = LAYOUT_PRESETS[(index + 1) % LAYOUT_PRESETS.length];
  return next?.id ?? DEFAULT_LAYOUT_PRESET;
}
