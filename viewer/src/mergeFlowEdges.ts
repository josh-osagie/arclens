import { edgeColors } from "./design/tokens";
import type { GraphEdgeType } from "./types";

export type MergedAtlasEdge = {
  from: string;
  to: string;
  types: GraphEdgeType[];
};

/** Higher index = lower visual priority for stroke color. */
const EDGE_TYPE_PRIORITY: GraphEdgeType[] = ["renders", "imports", "uses"];

export function sortEdgeTypes(types: GraphEdgeType[]): GraphEdgeType[] {
  return [...types].sort(
    (a, b) => EDGE_TYPE_PRIORITY.indexOf(a) - EDGE_TYPE_PRIORITY.indexOf(b),
  );
}

export function primaryEdgeType(types: GraphEdgeType[]): GraphEdgeType {
  return sortEdgeTypes(types)[0]!;
}

export function formatEdgeTypeLabel(types: GraphEdgeType[]): string {
  return sortEdgeTypes(types).join(" · ");
}

export function strokeColorForEdgeTypes(types: GraphEdgeType[]): string {
  return edgeColors[primaryEdgeType(types)];
}

export function mergeSameDirectionEdges(
  edges: Array<{ from: string; to: string; type: GraphEdgeType }>,
): MergedAtlasEdge[] {
  const groups = new Map<string, MergedAtlasEdge>();

  for (const edge of edges) {
    const key = `${edge.from}|${edge.to}`;
    const existing = groups.get(key);
    if (existing) {
      if (!existing.types.includes(edge.type)) {
        existing.types.push(edge.type);
      }
      continue;
    }
    groups.set(key, { from: edge.from, to: edge.to, types: [edge.type] });
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    types: sortEdgeTypes(group.types),
  }));
}
