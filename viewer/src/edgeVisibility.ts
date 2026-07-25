import type { Edge } from "@xyflow/react";
import {
  DEFAULT_EDGE_VISIBILITY,
  EDGE_TYPES,
  type EdgeVisibilityPrefs,
} from "./edgeVisibilityPrefs";
import type { GraphEdgeType } from "./types";

export function getFlowEdgeType(edge: Edge): GraphEdgeType | undefined {
  const dataType = edge.data?.edgeType;
  if (typeof dataType === "string" && isGraphEdgeType(dataType)) {
    return dataType;
  }

  const label = edge.label;
  if (typeof label === "string" && isGraphEdgeType(label)) {
    return label;
  }

  return undefined;
}

function isGraphEdgeType(value: string): value is GraphEdgeType {
  return EDGE_TYPES.includes(value as GraphEdgeType);
}

export function filterEdgesByVisibility(
  edges: Edge[],
  visibility: EdgeVisibilityPrefs = DEFAULT_EDGE_VISIBILITY,
): Edge[] {
  const anyVisible = EDGE_TYPES.some((type) => visibility[type]);
  if (!anyVisible) return [];

  return edges.filter((edge) => {
    const type = getFlowEdgeType(edge);
    if (!type) return true;
    return visibility[type];
  });
}

export function presentVisibleEdges(
  edges: Edge[],
  visibility: EdgeVisibilityPrefs,
  patch: (filtered: Edge[]) => Edge[],
): Edge[] {
  return patch(filterEdgesByVisibility(edges, visibility));
}
