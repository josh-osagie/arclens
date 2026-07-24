import { clusterNodeId, folderKey } from "./clusterGraph";
import type { AtlasGraphNode } from "./types";

/** Graph node ids whose `folderKey(file)` matches the folder. */
export function computeFolderMemberIds(
  folder: string,
  nodes: AtlasGraphNode[],
): Set<string> {
  const ids = new Set<string>();
  for (const node of nodes) {
    if (node.file === "external") continue;
    if (folderKey(node.file) === folder) ids.add(node.id);
  }
  return ids;
}

/**
 * Flow-visible node ids to spotlight for a folder (members + cluster bubble when collapsed).
 */
export function computeFolderSpotlightIds(
  folder: string,
  allNodes: AtlasGraphNode[],
  visibleNodes: AtlasGraphNode[],
): Set<string> {
  const memberIds = computeFolderMemberIds(folder, allNodes);
  const spotlight = new Set<string>();

  for (const node of visibleNodes) {
    if (memberIds.has(node.id)) {
      spotlight.add(node.id);
      continue;
    }
    if (node.id === clusterNodeId(folder) || node.cluster?.folder === folder) {
      spotlight.add(node.id);
    }
  }

  return spotlight;
}

export function shouldDimForSpotlight(spotlightFolder: string | null): boolean {
  return spotlightFolder !== null;
}
