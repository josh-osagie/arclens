import { dedupeEntryPointsByFile, type EntryOverview } from "../../src/entryPoints";
import { clusterNodeId, findEntryNodes, groupNodesByFolder } from "./clusterGraph";
import type { AtlasGraph, AtlasGraphNode } from "./types";

export type { EntryOverview };

export type FolderOverview = {
  folder: string;
  count: number;
  clusterId: string;
};

export type HubOverview = {
  node: AtlasGraphNode;
  degree: number;
};

export function computeTopFolders(
  graph: AtlasGraph,
  limit = 8,
): FolderOverview[] {
  const groups = groupNodesByFolder(graph.nodes);

  return [...groups.entries()]
    .map(([folder, members]) => ({
      folder,
      count: members.length,
      clusterId: clusterNodeId(folder),
    }))
    .sort((a, b) => b.count - a.count || a.folder.localeCompare(b.folder))
    .slice(0, limit);
}

export function computeHubNodes(
  graph: AtlasGraph,
  limit = 8,
): HubOverview[] {
  const degree = new Map<string, number>();

  for (const edge of graph.edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  return [...degree.entries()]
    .map(([id, hubDegree]) => {
      const node = nodeById.get(id);
      return node ? { node, degree: hubDegree } : null;
    })
    .filter((item): item is HubOverview => item !== null)
    .sort(
      (a, b) =>
        b.degree - a.degree ||
        a.node.name.localeCompare(b.node.name) ||
        a.node.id.localeCompare(b.node.id),
    )
    .slice(0, limit);
}

export function computeEntryPoints(
  graph: AtlasGraph,
  limit = 5,
): EntryOverview<AtlasGraphNode>[] {
  return dedupeEntryPointsByFile(findEntryNodes(graph), limit);
}
