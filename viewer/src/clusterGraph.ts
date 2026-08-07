import { filterEntryNodes } from "../../src/entryPoints";
import type { AtlasGraph, AtlasGraphNode } from "./types";
import { INCREMENTAL_CLUSTER_BATCH } from "./viewerConfig";

export const CLUSTER_ID_PREFIX = "cluster::";

export function folderKey(file: string): string {
  if (file === "external") return "external";
  const parts = file.replace(/\\/g, "/").split("/");
  parts.pop();
  if (parts.length === 0) return "root";
  const samplesIdx = parts.lastIndexOf("samples");
  if (samplesIdx >= 0) {
    return parts.slice(samplesIdx).join("/") || "samples";
  }
  if (parts.length >= 2) {
    return parts.slice(-2).join("/");
  }
  return parts.join("/");
}

export function groupNodesByFolder(
  nodes: AtlasGraphNode[]
): Map<string, AtlasGraphNode[]> {
  const groups = new Map<string, AtlasGraphNode[]>();

  for (const node of nodes) {
    if (node.file === "external") continue;
    const key = folderKey(node.file);
    const list = groups.get(key) ?? [];
    list.push(node);
    groups.set(key, list);
  }

  return groups;
}

export function clusterNodeId(folder: string): string {
  return `${CLUSTER_ID_PREFIX}${folder}`;
}

export function isClusterId(id: string): boolean {
  return id.startsWith(CLUSTER_ID_PREFIX);
}

export function folderFromClusterId(id: string): string {
  return id.slice(CLUSTER_ID_PREFIX.length);
}

export function nodeMatchesSearch(
  node: AtlasGraphNode,
  searchLower: string
): boolean {
  if (!searchLower) return false;
  return (
    node.name.toLowerCase().includes(searchLower) ||
    node.file.toLowerCase().includes(searchLower)
  );
}

export function findSearchMatchingNodeIds(
  graph: AtlasGraph,
  searchLower: string
): Set<string> {
  const ids = new Set<string>();
  if (!searchLower) return ids;
  for (const node of graph.nodes) {
    if (nodeMatchesSearch(node, searchLower)) {
      ids.add(node.id);
    }
  }
  return ids;
}

export function nextClusterReveal(
  folder: string,
  members: AtlasGraphNode[],
  visibleIds: Set<string>,
  graph: AtlasGraph,
  alreadyRevealed: Set<string>,
  batchSize = INCREMENTAL_CLUSTER_BATCH
): Set<string> {
  const memberIds = new Set(members.map((member) => member.id));
  const next = new Set(alreadyRevealed);
  const picks: string[] = [];

  for (const edge of graph.edges) {
    if (picks.length >= batchSize) break;

    if (
      visibleIds.has(edge.from) &&
      memberIds.has(edge.to) &&
      !next.has(edge.to)
    ) {
      picks.push(edge.to);
      next.add(edge.to);
    }
    if (picks.length >= batchSize) break;

    if (
      visibleIds.has(edge.to) &&
      memberIds.has(edge.from) &&
      !next.has(edge.from)
    ) {
      picks.push(edge.from);
      next.add(edge.from);
    }
  }

  if (picks.length < batchSize) {
    const incoming = new Map<string, number>();
    for (const edge of graph.edges) {
      if (memberIds.has(edge.to)) {
        incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
      }
    }

    const ranked = members
      .filter((member) => !next.has(member.id))
      .sort(
        (a, b) =>
          (incoming.get(b.id) ?? b.stats?.incoming ?? 0) -
          (incoming.get(a.id) ?? a.stats?.incoming ?? 0)
      );

    for (const member of ranked) {
      if (picks.length >= batchSize) break;
      next.add(member.id);
      picks.push(member.id);
    }
  }

  void folder;
  return next;
}

/** Map each graph node id to the id shown on the clustered canvas. */
export function buildClusterNodeVisibilityMap(
  graph: AtlasGraph,
  groups: Map<string, AtlasGraphNode[]>,
  fullyExpandedFolders: Set<string>,
  partialReveals: Map<string, Set<string>>
): Map<string, string> {
  const nodeIdToVisibleId = new Map<string, string>();

  for (const [folder, members] of groups) {
    if (fullyExpandedFolders.has(folder)) {
      for (const member of members) {
        nodeIdToVisibleId.set(member.id, member.id);
      }
      continue;
    }

    const revealed = partialReveals.get(folder) ?? new Set<string>();
    const hiddenCount =
      members.length -
      members.filter((member) => revealed.has(member.id)).length;
    const clusterId = hiddenCount > 0 ? clusterNodeId(folder) : null;

    for (const member of members) {
      if (revealed.has(member.id)) {
        nodeIdToVisibleId.set(member.id, member.id);
      } else if (clusterId) {
        nodeIdToVisibleId.set(member.id, clusterId);
      }
    }
  }

  for (const node of graph.nodes) {
    if (node.file === "external") {
      nodeIdToVisibleId.set(node.id, node.id);
    }
  }

  return nodeIdToVisibleId;
}

/** Rewire edges to folder cluster nodes when an endpoint is collapsed. */
export function wireClusterEdges(
  edges: AtlasGraph["edges"],
  nodeIdToVisibleId: Map<string, string>,
  visibleIds: Set<string>
): AtlasGraph["edges"] {
  const wired: AtlasGraph["edges"] = [];
  const seen = new Set<string>();

  for (const edge of edges) {
    const from = nodeIdToVisibleId.get(edge.from);
    const to = nodeIdToVisibleId.get(edge.to);
    if (!from || !to || from === to) continue;
    if (!visibleIds.has(from) || !visibleIds.has(to)) continue;

    const key = `${from}|${to}|${edge.type}`;
    if (seen.has(key)) continue;
    seen.add(key);

    wired.push({ from, to, type: edge.type });
  }

  return wired;
}

/**
 * Collapse nodes into folder clusters unless the folder is expanded.
 * Partial reveals show a subset plus a "+N more" cluster on large graphs.
 */
export function applyClusterView(
  graph: AtlasGraph,
  clusterMode: boolean,
  fullyExpandedFolders: Set<string>,
  partialReveals: Map<string, Set<string>> = new Map()
): AtlasGraph {
  if (!clusterMode) return graph;

  const groups = groupNodesByFolder(graph.nodes);
  const visibleIds = new Set<string>();
  const displayNodes: AtlasGraphNode[] = [];

  for (const [folder, members] of groups) {
    if (fullyExpandedFolders.has(folder)) {
      for (const member of members) {
        visibleIds.add(member.id);
        displayNodes.push(member);
      }
      continue;
    }

    const revealed = partialReveals.get(folder) ?? new Set<string>();
    const revealedMembers = members.filter((member) => revealed.has(member.id));

    for (const member of revealedMembers) {
      visibleIds.add(member.id);
      displayNodes.push(member);
    }

    const hiddenCount = members.length - revealedMembers.length;
    if (hiddenCount > 0) {
      const clusterId = clusterNodeId(folder);
      visibleIds.add(clusterId);
      const baseName = folder.split("/").pop() ?? folder;
      displayNodes.push({
        id: clusterId,
        name:
          revealedMembers.length > 0 ? `${baseName} +${hiddenCount}` : baseName,
        file: folder,
        type: "utility",
        cluster: { folder, count: hiddenCount },
        stats: { incoming: 0, outgoing: 0 },
      });
    }
  }

  for (const node of graph.nodes) {
    if (node.file === "external") {
      visibleIds.add(node.id);
      displayNodes.push(node);
    }
  }

  const nodeIdToVisibleId = buildClusterNodeVisibilityMap(
    graph,
    groups,
    fullyExpandedFolders,
    partialReveals
  );

  return {
    meta: graph.meta,
    nodes: displayNodes,
    edges: wireClusterEdges(graph.edges, nodeIdToVisibleId, visibleIds),
  };
}

export function findEntryNodes(graph: AtlasGraph): AtlasGraphNode[] {
  return filterEntryNodes(graph.nodes, graph.meta?.entryNodeIds, graph.edges);
}

export function buildClusteredVisibleIds(
  graph: AtlasGraph,
  clusterMode: boolean,
  fullyExpandedFolders: Set<string>,
  partialReveals: Map<string, Set<string>> = new Map()
): Set<string> {
  return new Set(
    applyClusterView(
      graph,
      clusterMode,
      fullyExpandedFolders,
      partialReveals
    ).nodes.map((node) => node.id)
  );
}

/** Folders that are fully expanded or have partial reveals. */
export function listExpandedFolders(
  fullyExpandedFolders: Set<string>,
  partialReveals: Map<string, Set<string>>
): string[] {
  const folders = new Set(fullyExpandedFolders);
  for (const [folder, revealed] of partialReveals) {
    if (revealed.size > 0) folders.add(folder);
  }
  return [...folders].sort();
}

export function collapseClusterFolderState(
  folder: string,
  fullyExpandedFolders: Set<string>,
  partialReveals: Map<string, Set<string>>
): {
  fullyExpandedFolders: Set<string>;
  partialReveals: Map<string, Set<string>>;
} {
  const nextFully = new Set(fullyExpandedFolders);
  nextFully.delete(folder);

  const nextPartial = new Map(partialReveals);
  nextPartial.delete(folder);

  return { fullyExpandedFolders: nextFully, partialReveals: nextPartial };
}

export function collapseAllClusterFoldersState(): {
  fullyExpandedFolders: Set<string>;
  partialReveals: Map<string, Set<string>>;
} {
  return { fullyExpandedFolders: new Set(), partialReveals: new Map() };
}

/** Ensure a target node (and its in-folder neighbors) appear when a folder is clustered. */
export function revealNodeForSpotlight(
  node: AtlasGraphNode,
  graph: AtlasGraph,
  partialReveals: Map<string, Set<string>>
): Map<string, Set<string>> {
  if (node.file === "external") return partialReveals;

  const folder = folderKey(node.file);
  const members = groupNodesByFolder(graph.nodes).get(folder) ?? [];
  const memberIds = new Set(members.map((member) => member.id));
  const next = new Map(partialReveals);
  const revealed = new Set(next.get(folder) ?? []);

  revealed.add(node.id);

  for (const edge of graph.edges) {
    if (edge.from === node.id && memberIds.has(edge.to)) revealed.add(edge.to);
    if (edge.to === node.id && memberIds.has(edge.from))
      revealed.add(edge.from);
  }

  next.set(folder, revealed);

  for (const edge of graph.edges) {
    const otherId =
      edge.from === node.id ? edge.to : edge.to === node.id ? edge.from : null;
    if (!otherId) continue;

    const other = graph.nodes.find((candidate) => candidate.id === otherId);
    if (!other || other.file === "external") continue;

    const otherFolder = folderKey(other.file);
    if (otherFolder === folder) continue;

    const otherRevealed = new Set(next.get(otherFolder) ?? []);
    otherRevealed.add(otherId);
    next.set(otherFolder, otherRevealed);
  }

  return next;
}

/** Reveal search matches inside collapsed folder clusters (large-graph search mode). */
export function mergeSearchPartialReveals(
  graph: AtlasGraph,
  searchLower: string,
  partialReveals: Map<string, Set<string>>
): Map<string, Set<string>> {
  if (!searchLower) return partialReveals;

  let next = new Map(partialReveals);
  for (const node of graph.nodes) {
    if (!nodeMatchesSearch(node, searchLower)) continue;
    next = revealNodeForSpotlight(node, graph, next);
  }
  return next;
}

/** Highlight matches, neighbors, and folder clusters that contain hidden matches. */
export function computeSearchHighlightIds(
  fullGraph: AtlasGraph,
  viewGraph: AtlasGraph,
  searchLower: string,
  clusterMode: boolean,
  fullyExpandedFolders: Set<string>
): Set<string> | null {
  if (!searchLower) return null;

  const matching = findSearchMatchingNodeIds(fullGraph, searchLower);
  if (matching.size === 0) return null;

  const ids = new Set<string>(matching);

  for (const edge of viewGraph.edges) {
    if (matching.has(edge.from) || matching.has(edge.to)) {
      ids.add(edge.from);
      ids.add(edge.to);
    }
  }

  if (clusterMode) {
    for (const node of fullGraph.nodes) {
      if (!matching.has(node.id) || node.file === "external") continue;
      const folder = folderKey(node.file);
      if (!fullyExpandedFolders.has(folder)) {
        ids.add(clusterNodeId(folder));
      }
    }
  }

  return ids;
}
