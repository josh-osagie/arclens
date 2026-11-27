import {
  getViewportForBounds,
  type Node,
  type ReactFlowInstance,
  type Rect,
} from "@xyflow/react";
import type { AtlasNodeData } from "./buildFlowGraph";
import { nodeLayoutDimensions } from "./layoutPresets";

export const MIN_INITIAL_READABLE_ZOOM = 0.65;

export type SafeAreaFitOptions = {
  nodeIds?: string[];
  padding?: number;
  duration?: number;
  minZoom?: number;
  maxZoom?: number;
  /**
   * When true, never shrink initial framing below `MIN_INITIAL_READABLE_ZOOM`;
   * instead anchor horizontally centered at the top of the graph at readable zoom.
   */
  enforceReadableFloor?: boolean;
};

function measureCanvasSize(): { width: number; height: number } {
  const container =
    typeof document !== "undefined"
      ? document.querySelector(".react-flow")
      : null;
  const rect = container?.getBoundingClientRect();
  const width =
    rect && rect.width > 0
      ? rect.width
      : typeof window !== "undefined"
        ? window.innerWidth
        : 1120;
  const height =
    rect && rect.height > 0
      ? rect.height
      : typeof window !== "undefined"
        ? window.innerHeight - 44
        : 820;
  return { width, height };
}

function fallbackNodesBounds(nodes: Node<AtlasNodeData>[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    if (node.type === "tierHeader") {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + (node.measured?.width ?? 992));
      maxY = Math.max(maxY, node.position.y + (node.measured?.height ?? 20));
      continue;
    }
    const { width, height } = nodeLayoutDimensions(node);
    const w = node.measured?.width ?? width;
    const h = node.measured?.height ?? height;
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + w);
    maxY = Math.max(maxY, node.position.y + h);
  }

  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

/**
 * Fit the requested nodes (or all nodes) inside the docked `.react-flow` container.
 * Reserves bottom clearance so cards do not sit behind the bottom-right MiniMap or
 * bottom-left Zoom pill. When `enforceReadableFloor` is enabled and fitting all nodes
 * would shrink below `MIN_INITIAL_READABLE_ZOOM`, anchors cleanly at the top-center
 * of the graph at readable zoom (~68%).
 */
export async function fitViewportInSafeArea(
  rf: ReactFlowInstance<Node<AtlasNodeData>>,
  options: SafeAreaFitOptions = {}
): Promise<boolean> {
  const {
    nodeIds,
    padding = 0.06,
    duration = 220,
    minZoom = 0.15,
    enforceReadableFloor = false,
  } = options;
  const maxZoom = options.maxZoom ?? (enforceReadableFloor ? 0.94 : 1.05);

  const allNodes = rf.getNodes();
  const targetNodes =
    nodeIds && nodeIds.length > 0
      ? nodeIds
          .map((id) => rf.getNode(id))
          .filter((node): node is Node<AtlasNodeData> => Boolean(node))
      : allNodes;

  if (targetNodes.length === 0) {
    return rf.fitView({ padding, duration, maxZoom });
  }

  const { width: containerW, height: containerH } = measureCanvasSize();
  // Reserve clearance for bottom-right MiniMap (~150px) and bottom-left ZoomControls
  const bottomClearance = !nodeIds && containerH >= 560 ? 156 : 56;
  const usableW = Math.max(240, containerW - 24);
  const usableH = Math.max(220, containerH - bottomClearance);

  let bounds = fallbackNodesBounds(targetNodes);
  const measuredBounds = rf.getNodesBounds(targetNodes);
  if (measuredBounds.width > 0 && measuredBounds.height > 0) {
    bounds = {
      x: Math.min(bounds.x, measuredBounds.x),
      y: Math.min(bounds.y, measuredBounds.y),
      width: Math.max(bounds.width, measuredBounds.width),
      height: Math.max(bounds.height, measuredBounds.height),
    };
  }

  if (bounds.width <= 0 || bounds.height <= 0) {
    return rf.fitView({
      nodes: targetNodes.map((node) => ({ id: node.id })),
      padding,
      duration,
      maxZoom,
    });
  }

  const fitted = getViewportForBounds(
    bounds,
    usableW,
    usableH,
    minZoom,
    maxZoom,
    padding
  );

  if (enforceReadableFloor && fitted.zoom < MIN_INITIAL_READABLE_ZOOM) {
    const readableZoom = 0.68;
    const centerX = bounds.x + bounds.width / 2;
    const x = Math.round(containerW / 2 - centerX * readableZoom);
    const y = Math.round(28 - bounds.y * readableZoom);
    return rf.setViewport({ x, y, zoom: readableZoom }, { duration });
  }

  const offsetX = Math.round((containerW - usableW) / 2);
  return rf.setViewport(
    {
      x: Math.round(fitted.x + offsetX),
      y: Math.round(Math.max(12, fitted.y)),
      zoom: fitted.zoom,
    },
    { duration }
  );
}

/**
 * Smoothly pan to a single target node ONLY if it lies outside the comfortable
 * middle region of the canvas or current zoom is unreadable (< 0.6), using a
 * calm zoom (0.76–0.92) rather than jarring 135% whiplash.
 */
export async function ensureNodeComfortablyVisible(
  rf: ReactFlowInstance<Node<AtlasNodeData>>,
  nodeId: string,
  duration = 240
): Promise<void> {
  const node = rf.getNode(nodeId);
  if (!node) return;

  const { width: containerW, height: containerH } = measureCanvasSize();
  const vp = rf.getViewport();
  const dims = nodeLayoutDimensions(node);
  const w = node.measured?.width ?? dims.width;
  const h = node.measured?.height ?? dims.height;
  const nodeCenterX = node.position.x + w / 2;
  const nodeCenterY = node.position.y + h / 2;

  const screenX = nodeCenterX * vp.zoom + vp.x;
  const screenY = nodeCenterY * vp.zoom + vp.y;

  const inSafeBox =
    vp.zoom >= 0.6 &&
    vp.zoom <= 1.15 &&
    screenX >= containerW * 0.14 &&
    screenX <= containerW * 0.86 &&
    screenY >= containerH * 0.14 &&
    screenY <= containerH * 0.8;

  if (inSafeBox) return;

  const nextZoom = Math.min(0.92, Math.max(0.76, vp.zoom));
  const nextX = Math.round(containerW / 2 - nodeCenterX * nextZoom);
  const nextY = Math.round(containerH * 0.4 - nodeCenterY * nextZoom);

  await rf.setViewport({ x: nextX, y: nextY, zoom: nextZoom }, { duration });
}
