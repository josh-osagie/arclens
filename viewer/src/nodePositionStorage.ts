import type { Node } from "@xyflow/react";
import type { AtlasNodeData } from "./buildFlowGraph";

export type NodePositions = Record<string, { x: number; y: number }>;

const STORAGE_PREFIX = "react-atlas-node-positions:";

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
    const raw = localStorage.getItem(nodePositionStorageKey(graphKey));
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
    localStorage.setItem(nodePositionStorageKey(graphKey), JSON.stringify(positions));
  } catch {
    // ignore quota errors
  }
}

export function nodePositionsFromNodes(nodes: Node<AtlasNodeData>[]): NodePositions {
  const positions: NodePositions = {};
  for (const node of nodes) {
    positions[node.id] = { x: node.position.x, y: node.position.y };
  }
  return positions;
}

export function mergeNodePositions(
  nextNodes: Node<AtlasNodeData>[],
  currentNodes: Node<AtlasNodeData>[],
  savedPositions: NodePositions | null = null,
): Node<AtlasNodeData>[] {
  const positions = new Map(currentNodes.map((node) => [node.id, node.position]));

  if (savedPositions) {
    for (const node of nextNodes) {
      if (!positions.has(node.id) && savedPositions[node.id]) {
        positions.set(node.id, savedPositions[node.id]);
      }
    }
  }

  return nextNodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
    draggable: true,
  }));
}
