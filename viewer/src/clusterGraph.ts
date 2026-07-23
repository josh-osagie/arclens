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
  nodes: AtlasGraphNode[],
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

export function nextClusterReveal(
  folder: string,
  members: AtlasGraphNode[],
  visibleIds: Set<string>,
  graph: AtlasGraph,
  alreadyRevealed: Set<string>,
  batchSize = INCREMENTAL_CLUSTER_BATCH,
): Set<string> {
  const memberIds = new Set(members.map((member) => member.id));
  const next = new Set(alreadyRevealed);
  const picks: string[] = [];

  for (const edge of graph.edges) {
    if (picks.length >= batchSize) break;

    if (visibleIds.has(edge.from) && memberIds.has(edge.to) && !next.has(edge.to)) {
      picks.push(edge.to);
      next.add(edge.to);
    }
    if (picks.length >= batchSize) break;

    if (visibleIds.has(edge.to) && memberIds.has(edge.from) && !next.has(edge.from)) {
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
          (incoming.get(a.id) ?? a.stats?.incoming ?? 0),
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

/**
 * Collapse nodes into folder clusters unless the folder is expanded.
 * Partial reveals show a subset plus a "+N more" cluster on large graphs.
 */
export function applyClusterView(
  graph: AtlasGraph,
  clusterMode: boolean,
  fullyExpandedFolders: Set<string>,
  partialReveals: Map<string, Set<string>> = new Map(),
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
        name: revealedMembers.length > 0 ? `${baseName} +${hiddenCount}` : baseName,
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

  return {
    meta: graph.meta,
    nodes: displayNodes,
    edges: graph.edges.filter(
      (edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to),
    ),
  };
}

export function findEntryNodes(graph: AtlasGraph): AtlasGraphNode[] {
  return filterEntryNodes(graph.nodes, graph.meta?.entryNodeIds);
}

export function buildClusteredVisibleIds(
  graph: AtlasGraph,
  clusterMode: boolean,
  fullyExpandedFolders: Set<string>,
  partialReveals: Map<string, Set<string>> = new Map(),
): Set<string> {
  return new Set(
    applyClusterView(graph, clusterMode, fullyExpandedFolders, partialReveals).nodes.map(
      (node) => node.id,
    ),
  );
}
