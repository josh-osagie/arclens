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

type Positioned = DagreLayoutPosition & { width?: number; height: number };

type Box = { x: number; y: number; width: number; height: number };

const DEFAULT_BOX_W = 196;
const BOX_GAP = 20;
const MAX_RANK_COLS = 5;

function boxesOverlap(a: Box, b: Box, gap: number): boolean {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

/**
 * Prevent ultra-wide horizontal ribbons when many sibling nodes share a Dagre rank
 * (e.g. 50 UI components or step forms). Wraps ranks wider than `MAX_RANK_COLS` into
 * balanced centered rows and pushes subsequent ranks down cleanly.
 */
function wrapWideHorizontalRanks(items: Positioned[]): Positioned[] {
  if (items.length <= MAX_RANK_COLS) return items;

  const sortedByY = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const ranks: Positioned[][] = [];

  for (const item of sortedByY) {
    const lastRank = ranks[ranks.length - 1];
    if (lastRank && Math.abs(item.y - lastRank[0]!.y) < 32) {
      lastRank.push(item);
    } else {
      ranks.push([item]);
    }
  }

  if (!ranks.some((rank) => rank.length > MAX_RANK_COLS)) {
    return items;
  }

  const out = new Map<string, Positioned>();
  let extraY = 0;

  for (const rank of ranks) {
    if (rank.length <= MAX_RANK_COLS) {
      for (const item of rank) {
        out.set(item.id, { ...item, y: item.y + extraY });
      }
      continue;
    }

    const ordered = [...rank].sort((a, b) => a.x - b.x);
    const minX = Math.min(...ordered.map((n) => n.x));
    const maxX = Math.max(
      ...ordered.map((n) => n.x + (n.width ?? DEFAULT_BOX_W))
    );
    const centerX = (minX + maxX) / 2;
    const baseY = ordered[0]!.y + extraY;

    const maxW = Math.max(...ordered.map((n) => n.width ?? DEFAULT_BOX_W));
    const maxH = Math.max(...ordered.map((n) => n.height));
    const colGap = 32;
    const rowStep = maxH + 38;
    const numRows = Math.ceil(ordered.length / MAX_RANK_COLS);
    const colsPerRow = Math.ceil(ordered.length / numRows);

    for (let r = 0; r < numRows; r++) {
      const slice = ordered.slice(r * colsPerRow, (r + 1) * colsPerRow);
      const rowW = slice.length * maxW + Math.max(0, slice.length - 1) * colGap;
      let startX = centerX - rowW / 2;

      for (const item of slice) {
        out.set(item.id, {
          ...item,
          x: Math.round(startX),
          y: Math.round(baseY + r * rowStep),
        });
        startX += maxW + colGap;
      }
    }

    extraY += (numRows - 1) * rowStep;
  }

  return items.map((item) => out.get(item.id) ?? item);
}

/** Resolve bounding-box collisions so nodes or clusters never overlap. */
export function spreadCoincidentPositions(items: Positioned[]): Positioned[] {
  const placed: Box[] = [];

  return items.map((item) => {
    const x = item.x;
    let y = item.y;
    const width = item.width ?? DEFAULT_BOX_W;
    const height = item.height;

    let collider = placed.find((other) =>
      boxesOverlap({ x, y, width, height }, other, BOX_GAP)
    );
    while (collider) {
      y = collider.y + collider.height + BOX_GAP;
      collider = placed.find((other) =>
        boxesOverlap({ x, y, width, height }, other, BOX_GAP)
      );
    }

    placed.push({ x, y, width, height });
    return { ...item, x, y };
  });
}

function packIsolatedGrid(
  isolated: DagreLayoutNodeInput[],
  startX: number,
  startY: number
): Positioned[] {
  if (isolated.length === 0) return [];

  const maxW = Math.max(...isolated.map((n) => n.width));
  const maxH = Math.max(...isolated.map((n) => n.height));
  const cellW = maxW + 44;
  const cellH = maxH + 36;
  const cols = Math.max(
    2,
    Math.min(6, Math.ceil(Math.sqrt(isolated.length)))
  );

  const sorted = [...isolated].sort((a, b) => a.id.localeCompare(b.id));
  return sorted.map((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      id: node.id,
      x: startX + col * cellW,
      y: startY + row * cellH,
      width: node.width,
      height: node.height,
    };
  });
}

/**
 * Pure dagre layout over serializable node/edge payloads.
 * Connected components are ranked by dagre; isolated nodes pack into a compact grid below.
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

  const nodeIds = new Set(nodes.map((node) => node.id));
  const validEdges: Array<{ source: string; target: string }> = [];
  const connectedIds = new Set<string>(
    entryIds.filter((id) => nodeIds.has(id))
  );
  const seen = new Set<string>();

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    if (edge.source === edge.target) continue;
    const key = `${edge.source}|${edge.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    validEdges.push({ source: edge.source, target: edge.target });
    connectedIds.add(edge.source);
    connectedIds.add(edge.target);
  }

  const connectedNodes = nodes.filter((node) => connectedIds.has(node.id));
  const isolatedNodes = nodes.filter((node) => !connectedIds.has(node.id));

  let connectedPositions: Positioned[] = [];
  if (connectedNodes.length > 0) {
    const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: direction, ...DAGRE_GRAPH });

    for (const node of connectedNodes) {
      g.setNode(node.id, { width: node.width, height: node.height });
    }

    for (const id of entryIds) {
      if (g.hasNode(id)) {
        g.setNode(id, { ...g.node(id), rank: 0 });
      }
    }

    for (const edge of validEdges) {
      g.setEdge(edge.source, edge.target);
    }

    dagre.layout(g);

    const rawConnected = connectedNodes.map((node) => {
      const layoutNode = g.node(node.id);
      return {
        id: node.id,
        x: layoutNode.x - node.width / 2,
        y: layoutNode.y - node.height / 2,
        width: node.width,
        height: node.height,
      };
    });

    connectedPositions = spreadCoincidentPositions(
      isHorizontal ? rawConnected : wrapWideHorizontalRanks(rawConnected)
    );
  }

  let isolatedStartX = DAGRE_GRAPH.marginx;
  let isolatedStartY = DAGRE_GRAPH.marginy;
  if (connectedPositions.length > 0) {
    isolatedStartX = Math.min(...connectedPositions.map((p) => p.x));
    isolatedStartY =
      Math.max(...connectedPositions.map((p) => p.y + p.height)) + 64;
  }

  const isolatedPositions = packIsolatedGrid(
    isolatedNodes,
    isolatedStartX,
    isolatedStartY
  );

  const byId = new Map(
    [...connectedPositions, ...isolatedPositions].map((pos) => [
      pos.id,
      { id: pos.id, x: pos.x, y: pos.y },
    ])
  );

  return {
    positions: nodes.map((node) => byId.get(node.id)!),
    sourcePosition,
    targetPosition,
  };
}
