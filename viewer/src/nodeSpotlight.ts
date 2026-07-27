import { clusterNodeId, folderKey } from "./clusterGraph";
import { computeNeighborhoodIds, DEFAULT_NEIGHBORHOOD_HOPS } from "./neighborhoodFocus";
import type { AtlasGraph, AtlasGraphNode } from "./types";

/** Graph node ids to spotlight around a node (neighborhood within the visible canvas). */
export function computeNodeSpotlightIds(
  nodeId: string,
  allNodes: AtlasGraphNode[],
  visibleNodes: AtlasGraphNode[],
  edges: AtlasGraph["edges"],
  hops = DEFAULT_NEIGHBORHOOD_HOPS,
): Set<string> {
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const neighborhood = computeNeighborhoodIds(nodeId, edges, hops);
  const spotlight = new Set<string>();

  for (const id of neighborhood) {
    if (visibleIds.has(id)) spotlight.add(id);
  }

  if (spotlight.size > 0) {
    return spotlight;
  }

  const target = allNodes.find((node) => node.id === nodeId);
  if (!target || target.file === "external") {
    return spotlight;
  }

  const folder = folderKey(target.file);
  for (const node of visibleNodes) {
    if (node.id === clusterNodeId(folder) || node.cluster?.folder === folder) {
      spotlight.add(node.id);
    }
  }

  return spotlight;
}

export function shouldDimForNodeSpotlight(spotlightNodeId: string | null): boolean {
  return spotlightNodeId !== null;
}
