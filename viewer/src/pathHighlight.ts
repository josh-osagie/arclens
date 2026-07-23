import type { AtlasGraph } from "./types";

export function findPathFromEntries(
  graph: AtlasGraph,
  targetId: string,
  entryIds: string[],
): string[] {
  if (entryIds.length === 0 || entryIds.includes(targetId)) {
    return entryIds.includes(targetId) ? [targetId] : [];
  }

  const entrySet = new Set(entryIds);
  const prev = new Map<string, string>();
  const queue = [targetId];
  const visited = new Set([targetId]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (entrySet.has(current)) {
      const path = [current];
      let walk = current;
      while (prev.has(walk)) {
        walk = prev.get(walk)!;
        path.push(walk);
      }
      return path;
    }

    for (const edge of graph.edges) {
      if (edge.to !== current || visited.has(edge.from)) continue;
      visited.add(edge.from);
      prev.set(edge.from, current);
      queue.push(edge.from);
    }
  }

  return [];
}

export function pathEdgeKeys(path: string[], graph: AtlasGraph): Set<string> {
  const keys = new Set<string>();
  if (path.length < 2) return keys;

  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];
    for (const edge of graph.edges) {
      if (edge.from === from && edge.to === to) {
        keys.add(`${edge.from}|${edge.to}|${edge.type}`);
      }
    }
  }

  return keys;
}

export function mergeHighlightIds(
  pathIds: string[],
  connectedIds: Set<string> | null,
  selectedId: string | null,
): Set<string> | null {
  if (pathIds.length > 0) {
    return new Set(pathIds);
  }
  if (selectedId && connectedIds) {
    return connectedIds;
  }
  return connectedIds;
}
