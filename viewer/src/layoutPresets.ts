import { Position, type Edge, type Node } from "@xyflow/react";
import type { AtlasGraph } from "./types";
import type { AtlasNodeData } from "./buildFlowGraph";
import {
  computeDagreLayout,
  spreadCoincidentPositions,
  type DagreDirection,
  type DagreLayoutRequest,
  type DagreLayoutResponse,
  type LayoutWorkerRequest,
  type LayoutWorkerResponse,
} from "./layoutDagreCore";
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

export type LayoutContext = {
  entryIds?: string[];
  graph?: AtlasGraph;
};

export class LayoutCancelledError extends Error {
  constructor() {
    super("Layout cancelled");
    this.name = "LayoutCancelledError";
  }
}

/** Prefer render-tree edges for ranked layout — matches React Flow dagre examples. */
export function filterEdgesForDagreLayout(edges: Edge[]): Edge[] {
  const renders = edges.filter((edge) => {
    const types = edge.data?.edgeTypes as string[] | undefined;
    if (types?.includes("renders")) return true;
    return edge.data?.edgeType === "renders";
  });
  return renders.length > 0 ? renders : edges;
}

export function nodeLayoutDimensions(node: Node<AtlasNodeData>): {
  width: number;
  height: number;
} {
  if (node.type === "cluster") {
    return { width: CLUSTER_NODE_W, height: CLUSTER_NODE_H };
  }
  return { width: NODE_W, height: NODE_H };
}

/** All visible nodes participate in dagre (including folder cluster bubbles). */
export function layoutIncludesClusterNodes(_mode: LayoutPreset): boolean {
  return true;
}

function toDagreRequest(
  nodes: Node<AtlasNodeData>[],
  edges: Edge[],
  direction: DagreDirection,
  entryIds: string[]
): DagreLayoutRequest {
  const layoutEdges = filterEdgesForDagreLayout(edges);
  return {
    direction,
    entryIds,
    nodes: nodes.map((node) => ({
      id: node.id,
      ...nodeLayoutDimensions(node),
    })),
    edges: layoutEdges.map((edge) => ({
      source: edge.source,
      target: edge.target,
    })),
  };
}

function applyDagreResult(
  nodes: Node<AtlasNodeData>[],
  result: DagreLayoutResponse
): Node<AtlasNodeData>[] {
  const byId = new Map(
    result.positions.map((position) => [position.id, position])
  );
  const sourcePosition =
    result.sourcePosition === "right" ? Position.Right : Position.Bottom;
  const targetPosition =
    result.targetPosition === "left" ? Position.Left : Position.Top;

  return nodes.map((node) => {
    const laidOut = byId.get(node.id);
    return {
      ...node,
      targetPosition,
      sourcePosition,
      position: laidOut ? { x: laidOut.x, y: laidOut.y } : node.position,
    };
  });
}

/**
 * Dagre layout following https://reactflow.dev/examples/layout/dagre
 * — ranked nodes, top/bottom or left/right handles, centered anchor conversion.
 */
export function getDagreLayoutedNodes(
  nodes: Node<AtlasNodeData>[],
  edges: Edge[],
  direction: "TB" | "LR",
  entryIds: string[] = []
): Node<AtlasNodeData>[] {
  if (nodes.length === 0) return nodes;
  return applyDagreResult(
    nodes,
    computeDagreLayout(toDagreRequest(nodes, edges, direction, entryIds))
  );
}

/** Nudge nodes that dagre placed at the same coordinates (common for isolated clusters). */
export function spreadCoincidentNodes(
  nodes: Node<AtlasNodeData>[]
): Node<AtlasNodeData>[] {
  const spread = spreadCoincidentPositions(
    nodes.map((node) => ({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      height: nodeLayoutDimensions(node).height,
    }))
  );
  const byId = new Map(spread.map((item) => [item.id, item]));

  return nodes.map((node) => {
    const next = byId.get(node.id);
    if (!next) return node;
    return { ...node, position: { x: next.x, y: next.y } };
  });
}

export function layoutNodesByPreset(
  nodes: Node<AtlasNodeData>[],
  edges: Edge[],
  mode: LayoutPreset,
  context: LayoutContext = {}
): Node<AtlasNodeData>[] {
  const direction = mode === "dagre-lr" ? "LR" : "TB";
  return getDagreLayoutedNodes(nodes, edges, direction, context.entryIds ?? []);
}

type PendingLayout = {
  resolve: (result: DagreLayoutResponse) => void;
  reject: (error: Error) => void;
};

let layoutWorker: Worker | null | undefined;
let nextWorkerRequestId = 0;
let layoutGeneration = 0;
const pendingLayouts = new Map<number, PendingLayout>();

function settlePending(requestId: number, result: DagreLayoutResponse): void {
  const pending = pendingLayouts.get(requestId);
  if (!pending) return;
  pendingLayouts.delete(requestId);
  pending.resolve(result);
}

function rejectPending(requestId: number, error: Error): void {
  const pending = pendingLayouts.get(requestId);
  if (!pending) return;
  pendingLayouts.delete(requestId);
  pending.reject(error);
}

function getLayoutWorker(): Worker | null {
  if (layoutWorker !== undefined) return layoutWorker;

  try {
    if (typeof Worker === "undefined") {
      layoutWorker = null;
      return null;
    }

    const worker = new Worker(new URL("./layout.worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (event: MessageEvent<LayoutWorkerResponse>) => {
      const { requestId, ...result } = event.data;
      settlePending(requestId, result);
    };

    worker.onerror = () => {
      for (const [requestId] of pendingLayouts) {
        rejectPending(requestId, new Error("Layout worker failed"));
      }
      try {
        worker.terminate();
      } catch {
        // ignore terminate errors
      }
      layoutWorker = null;
    };

    layoutWorker = worker;
    return worker;
  } catch {
    layoutWorker = null;
    return null;
  }
}

function layoutViaWorker(
  request: DagreLayoutRequest
): Promise<DagreLayoutResponse> {
  const worker = getLayoutWorker();
  if (!worker) {
    return Promise.reject(new Error("Layout worker unavailable"));
  }

  const requestId = ++nextWorkerRequestId;
  const message: LayoutWorkerRequest = { requestId, ...request };

  return new Promise<DagreLayoutResponse>((resolve, reject) => {
    pendingLayouts.set(requestId, { resolve, reject });
    try {
      worker.postMessage(message);
    } catch (error) {
      pendingLayouts.delete(requestId);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

async function computeDagreLayoutAsync(
  request: DagreLayoutRequest
): Promise<DagreLayoutResponse> {
  try {
    const result = await layoutViaWorker(request);
    console.debug("[arclens] layout via worker", {
      nodes: request.nodes.length,
    });
    return result;
  } catch {
    console.debug("[arclens] layout via sync fallback", {
      nodes: request.nodes.length,
    });
    return computeDagreLayout(request);
  }
}

/**
 * Async dagre layout via Web Worker, with sync fallback when workers are unavailable.
 * Newer calls cancel older in-flight results (throws LayoutCancelledError).
 */
export async function getDagreLayoutedNodesAsync(
  nodes: Node<AtlasNodeData>[],
  edges: Edge[],
  direction: "TB" | "LR",
  entryIds: string[] = []
): Promise<Node<AtlasNodeData>[]> {
  if (nodes.length === 0) return nodes;

  const generation = ++layoutGeneration;
  const request = toDagreRequest(nodes, edges, direction, entryIds);
  const result = await computeDagreLayoutAsync(request);

  if (generation !== layoutGeneration) {
    throw new LayoutCancelledError();
  }

  return applyDagreResult(nodes, result);
}

export async function layoutNodesByPresetAsync(
  nodes: Node<AtlasNodeData>[],
  edges: Edge[],
  mode: LayoutPreset,
  context: LayoutContext = {}
): Promise<Node<AtlasNodeData>[]> {
  const direction = mode === "dagre-lr" ? "LR" : "TB";
  return getDagreLayoutedNodesAsync(
    nodes,
    edges,
    direction,
    context.entryIds ?? []
  );
}

/** Reset worker state (tests). */
export function resetLayoutWorkerForTests(): void {
  layoutGeneration += 1;
  for (const [requestId] of pendingLayouts) {
    rejectPending(requestId, new LayoutCancelledError());
  }
  if (layoutWorker) {
    try {
      layoutWorker.terminate();
    } catch {
      // ignore
    }
  }
  layoutWorker = undefined;
  nextWorkerRequestId = 0;
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
