import dagre from "@dagrejs/dagre";

export const DAGRE_GRAPH = {
  nodesep: 60,
  ranksep: 90,
  marginx: 20,
  marginy: 20,
};

export type DagreDirection = "TB" | "LR";

export type DagreLayoutNodeInput = {
  id: string;
  width: number;
  height: number;
};

export type DagreLayoutEdgeInput = {
  source: string;
  target: string;
};

export type DagreLayoutRequest = {
  nodes: DagreLayoutNodeInput[];
  edges: DagreLayoutEdgeInput[];
  direction: DagreDirection;
  entryIds?: string[];
};

export type DagreLayoutPosition = {
  id: string;
  x: number;
  y: number;
};

export type DagreLayoutResponse = {
  positions: DagreLayoutPosition[];
  sourcePosition: "bottom" | "right";
  targetPosition: "top" | "left";
};

export type LayoutWorkerRequest = DagreLayoutRequest & {
  requestId: number;
};

export type LayoutWorkerResponse = DagreLayoutResponse & {
  requestId: number;
};

type Positioned = DagreLayoutPosition & { height: number };

/** Nudge nodes that dagre placed at the same coordinates (common for isolated clusters). */
export function spreadCoincidentPositions(items: Positioned[]): Positioned[] {
  const placed: { x: number; y: number }[] = [];
  const GAP = 16;

  return items.map((item) => {
    let { x, y } = item;
    const { height } = item;

    const overlaps = () =>
      placed.some(
        (other) => Math.abs(other.x - x) < 8 && Math.abs(other.y - y) < 8
      );

    while (overlaps()) {
      y += height + GAP;
    }

    placed.push({ x, y });
    return { ...item, x, y };
  });
}

/**
 * Pure dagre layout over serializable node/edge payloads.
 * Positions are top-left anchors (dagre centers converted).
 */
export function computeDagreLayout(
  request: DagreLayoutRequest
): DagreLayoutResponse {
  const { nodes, edges, direction, entryIds = [] } = request;
  const isHorizontal = direction === "LR";
  const sourcePosition = isHorizontal ? "right" : "bottom";
  const targetPosition = isHorizontal ? "left" : "top";

  if (nodes.length === 0) {
    return { positions: [], sourcePosition, targetPosition };
  }

  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, ...DAGRE_GRAPH });

  for (const node of nodes) {
    g.setNode(node.id, { width: node.width, height: node.height });
  }

  for (const id of entryIds) {
    if (g.hasNode(id)) {
      g.setNode(id, { ...g.node(id), rank: 0 });
    }
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

  const positioned = spreadCoincidentPositions(
    nodes.map((node) => {
      const layoutNode = g.node(node.id);
      return {
        id: node.id,
        x: layoutNode.x - node.width / 2,
        y: layoutNode.y - node.height / 2,
        height: node.height,
      };
    })
  );

  return {
    positions: positioned.map(({ id, x, y }) => ({ id, x, y })),
    sourcePosition,
    targetPosition,
  };
}
