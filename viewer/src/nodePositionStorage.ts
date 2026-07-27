import type { Node } from "@xyflow/react";
import type { AtlasNodeData } from "./buildFlowGraph";
import { isClusterId } from "./clusterGraph";
import { readLocalStorage, writeLocalStorage } from "./storageCompat";

export type NodePositions = Record<string, { x: number; y: number }>;

const STORAGE_PREFIX = "arclens-node-positions:";

export function nodePositionStorageKey(graphKey: string): string {
  return `${STORAGE_PREFIX}${graphKey}`;
}

function isValidPosition(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== "object") return false;
  const pos = value as { x?: unknown; y?: unknown };
  return typeof pos.x === "number" && typeof pos.y === "number";
}

export function loadNodePositions(graphKey: string): NodePositions | null {
  try {
    const raw = readLocalStorage(nodePositionStorageKey(graphKey));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;

    const positions: NodePositions = {};
    for (const [id, position] of Object.entries(parsed)) {
      if (isValidPosition(position)) {
        positions[id] = position;
      }
    }

    return Object.keys(positions).length > 0 ? positions : null;
  } catch {
    return null;
  }
}

export function saveNodePositions(graphKey: string, positions: NodePositions): void {
  try {
    writeLocalStorage(nodePositionStorageKey(graphKey), JSON.stringify(positions));
  } catch {
    // ignore quota errors
  }
}

export function nodePositionsFromNodes(nodes: Node<AtlasNodeData>[]): NodePositions {
  const positions: NodePositions = {};
  for (const node of nodes) {
    if (isClusterId(node.id)) continue;
    positions[node.id] = { x: node.position.x, y: node.position.y };
  }
  return positions;
}

export function mergeNodePositions(
  nextNodes: Node<AtlasNodeData>[],
  currentNodes: Node<AtlasNodeData>[],
  savedPositions: NodePositions | null = null,
  draggedNodeIds: ReadonlySet<string> = new Set(),
): Node<AtlasNodeData>[] {
  const currentById = new Map(currentNodes.map((node) => [node.id, node]));

  return nextNodes.map((node) => {
    if (draggedNodeIds.has(node.id)) {
      const current = currentById.get(node.id);
      if (current) {
        return { ...node, position: current.position, draggable: true };
      }
    }

    const saved = savedPositions?.[node.id];
    if (saved && !isClusterId(node.id)) {
      return { ...node, position: saved, draggable: true };
    }

    return { ...node, position: node.position, draggable: true };
  });
}
