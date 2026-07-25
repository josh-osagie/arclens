import type { Edge } from "@xyflow/react";
import {
  formatEdgeTypeLabel,
  primaryEdgeType,
  strokeColorForEdgeTypes,
} from "./mergeFlowEdges";
import {
  DEFAULT_EDGE_VISIBILITY,
  EDGE_TYPES,
  type EdgeVisibilityPrefs,
} from "./edgeVisibilityPrefs";
import type { GraphEdgeType } from "./types";

function isGraphEdgeType(value: string): value is GraphEdgeType {
  return EDGE_TYPES.includes(value as GraphEdgeType);
}

export function getFlowEdgeType(edge: Edge): GraphEdgeType | undefined {
  const types = getFlowEdgeTypes(edge);
  if (types.length > 0) return primaryEdgeType(types);

  const label = edge.label;
  if (typeof label === "string" && isGraphEdgeType(label)) {
    return label;
  }

  return undefined;
}

export function getFlowEdgeTypes(edge: Edge): GraphEdgeType[] {
  const dataTypes = edge.data?.edgeTypes;
  if (Array.isArray(dataTypes)) {
    return dataTypes.filter(
      (type): type is GraphEdgeType =>
        typeof type === "string" && isGraphEdgeType(type),
    );
  }

  const dataType = edge.data?.edgeType;
  if (typeof dataType === "string" && isGraphEdgeType(dataType)) {
    return [dataType];
  }

  return [];
}

function withVisibleEdgeTypes(edge: Edge, visibleTypes: GraphEdgeType[]): Edge {
  if (visibleTypes.length === 0) return edge;

  const strokeType = primaryEdgeType(visibleTypes);
  const stroke = strokeColorForEdgeTypes(visibleTypes);
  const label =
    typeof edge.label === "string" ? formatEdgeTypeLabel(visibleTypes) : edge.label;

  return {
    ...edge,
    label,
    data: {
      ...edge.data,
      edgeTypes: visibleTypes,
      edgeType: strokeType,
    },
    style: {
      ...edge.style,
      stroke,
    },
    markerEnd:
      edge.markerEnd && typeof edge.markerEnd === "object"
        ? { ...edge.markerEnd, color: stroke }
        : edge.markerEnd,
  };
}

export function filterEdgesByVisibility(
  edges: Edge[],
  visibility: EdgeVisibilityPrefs = DEFAULT_EDGE_VISIBILITY,
): Edge[] {
  const anyVisible = EDGE_TYPES.some((type) => visibility[type]);
  if (!anyVisible) return [];

  return edges.flatMap((edge) => {
    const types = getFlowEdgeTypes(edge);
    if (types.length === 0) return [edge];

    const visibleTypes = types.filter((type) => visibility[type]);
    if (visibleTypes.length === 0) return [];

    return [withVisibleEdgeTypes(edge, visibleTypes)];
  });
}

export function presentVisibleEdges(
  edges: Edge[],
  visibility: EdgeVisibilityPrefs,
  patch: (filtered: Edge[]) => Edge[],
): Edge[] {
  return patch(filterEdgesByVisibility(edges, visibility));
}
