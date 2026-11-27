import { Position, type Node } from "@xyflow/react";
import type { AtlasNodeData, ClusterNodeData } from "./buildFlowGraph";
import { CLUSTER_NODE_W, NODE_H, NODE_W } from "./layoutPresets";

export type OverviewTierId = "entry" | "feature" | "ui" | "core";

export type TierHeaderNodeData = {
  label: string;
  tierId: OverviewTierId;
  count: number;
};

export const OVERVIEW_TIER_META: ReadonlyArray<{
  id: OverviewTierId;
  title: string;
}> = [
  { id: "entry", title: "01 · App Startup & Routing" },
  { id: "feature", title: "02 · User-Facing Features & Screens" },
  { id: "ui", title: "03 · Shared Interface Components" },
  { id: "core", title: "04 · Data, State & Shared Helpers" },
];

export const OVERVIEW_MAX_COLS = 5;
export const OVERVIEW_CLUSTER_H = 98;
const COL_GAP = 18;
const ROW_GAP = 20;
const HEADER_HEIGHT = 20;
const HEADER_TO_CARDS_GAP = 6;
const TIER_GAP = 18;
const CENTER_X = 560;

export function classifyOverviewFolderTier(folder: string): OverviewTierId {
  const norm = folder
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();

  if (
    norm === "src" ||
    norm === "src/app" ||
    norm === "app" ||
    norm === "pages" ||
    norm === "root" ||
    norm === "src/routing" ||
    norm === "src/router"
  ) {
    return "entry";
  }

  if (
    /^(?:src\/)?(?:features|modules|domains|pages|routes|views|screens|sections|apps|packages)(?:\/|$)/.test(
      norm
    )
  ) {
    return "feature";
  }

  if (
    /^(?:src\/)?(?:components|ui|assets|icons|layouts|styles|design)(?:\/|$)/.test(
      norm
    )
  ) {
    return "ui";
  }

  return "core";
}

export function classifyOverviewNodeTier(
  node: Node<AtlasNodeData>
): OverviewTierId {
  if (node.type === "cluster") {
    const data = node.data as unknown as ClusterNodeData;
    return classifyOverviewFolderTier(data.folder ?? String(data.label ?? ""));
  }

  if (node.data.type === "entry") return "entry";
  if (node.data.fileLabel) {
    return classifyOverviewFolderTier(node.data.fileLabel);
  }
  return "core";
}

function cardDimensions(node: Node<AtlasNodeData>): {
  width: number;
  height: number;
} {
  if (node.type === "cluster") {
    return { width: CLUSTER_NODE_W, height: OVERVIEW_CLUSTER_H };
  }
  return { width: NODE_W, height: NODE_H };
}

function nodeWeight(node: Node<AtlasNodeData>): number {
  if (node.type === "cluster") {
    return (node.data as unknown as ClusterNodeData).count ?? 0;
  }
  return node.data.type === "entry" ? 1000 : 1;
}

function sortTierNodes(
  nodes: Node<AtlasNodeData>[],
  tierId: OverviewTierId
): Node<AtlasNodeData>[] {
  return [...nodes].sort((a, b) => {
    if (tierId === "entry") {
      const aFolder = (a.data as unknown as ClusterNodeData).folder ?? a.id;
      const bFolder = (b.data as unknown as ClusterNodeData).folder ?? b.id;
      if (aFolder === "src" && bFolder !== "src") return -1;
      if (bFolder === "src" && aFolder !== "src") return 1;
    }
    const diff = nodeWeight(b) - nodeWeight(a);
    if (diff !== 0) return diff;
    return String(a.data.label ?? a.id).localeCompare(
      String(b.data.label ?? b.id)
    );
  });
}

function splitBalancedRows<T>(items: T[], maxCols: number): T[][] {
  if (items.length === 0) return [];
  if (items.length <= maxCols) return [items];

  const rowCount = Math.ceil(items.length / maxCols);
  const baseSize = Math.ceil(items.length / rowCount);
  const rows: T[][] = [];

  for (let i = 0; i < items.length; i += baseSize) {
    rows.push(items.slice(i, i + baseSize));
  }
  return rows;
}

/**
 * Arrange Level-0 domain overview nodes into 4 clean, centered architectural rows
 * with lightweight non-interactive tier headings so the entire system map fits at
 * ~75–95% readable zoom with zero overlap.
 */
export function layoutTieredOverviewNodes(
  nodes: Node<AtlasNodeData>[]
): Node<AtlasNodeData>[] {
  const contentNodes = nodes.filter((node) => node.type !== "tierHeader");
  if (contentNodes.length === 0) return [];

  const buckets = new Map<OverviewTierId, Node<AtlasNodeData>[]>();
  for (const meta of OVERVIEW_TIER_META) {
    buckets.set(meta.id, []);
  }

  for (const node of contentNodes) {
    const tier = classifyOverviewNodeTier(node);
    buckets.get(tier)!.push(node);
  }

  const maxRowSpan =
    OVERVIEW_MAX_COLS * CLUSTER_NODE_W + (OVERVIEW_MAX_COLS - 1) * COL_GAP;
  const headerLeft = CENTER_X - maxRowSpan / 2;

  const result: Node<AtlasNodeData>[] = [];
  let cursorY = 16;

  for (const meta of OVERVIEW_TIER_META) {
    const rawItems = buckets.get(meta.id) ?? [];
    if (rawItems.length === 0) continue;

    const sorted = sortTierNodes(rawItems, meta.id);
    const rows = splitBalancedRows(sorted, OVERVIEW_MAX_COLS);

    result.push({
      id: `tier-header::${meta.id}`,
      type: "tierHeader",
      position: { x: headerLeft, y: cursorY },
      selectable: false,
      draggable: false,
      focusable: false,
      data: {
        label: meta.title,
        tierId: meta.id,
        count: sorted.length,
        type: "utility",
        nodeId: `tier-header::${meta.id}`,
      } as unknown as AtlasNodeData,
    });

    cursorY += HEADER_HEIGHT + HEADER_TO_CARDS_GAP;

    rows.forEach((row, rowIndex) => {
      const dims = row.map(cardDimensions);
      const rowWidth =
        dims.reduce((sum, d) => sum + d.width, 0) +
        Math.max(0, row.length - 1) * COL_GAP;
      const rowHeight = Math.max(...dims.map((d) => d.height));
      let x = CENTER_X - rowWidth / 2;

      row.forEach((node, colIndex) => {
        const d = dims[colIndex]!;
        result.push({
          ...node,
          targetPosition: Position.Top,
          sourcePosition: Position.Bottom,
          position: { x: Math.round(x), y: Math.round(cursorY) },
        });
        x += d.width + COL_GAP;
      });

      cursorY += rowHeight + (rowIndex < rows.length - 1 ? ROW_GAP : 0);
    });

    cursorY += TIER_GAP;
  }

  return result;
}
