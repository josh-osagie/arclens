import type { AtlasGraph, AtlasGraphNode } from "./types";

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

/**
 * Collapse nodes into folder clusters unless the folder is expanded.
 */
export function applyClusterView(
  graph: AtlasGraph,
  clusterMode: boolean,
  expandedFolders: Set<string>,
): AtlasGraph {
  if (!clusterMode) return graph;

  const groups = groupNodesByFolder(graph.nodes);
  const visibleIds = new Set<string>();
  const displayNodes: AtlasGraphNode[] = [];

  for (const [folder, members] of groups) {
    if (expandedFolders.has(folder)) {
      for (const member of members) {
        visibleIds.add(member.id);
        displayNodes.push(member);
      }
      continue;
    }

    const clusterId = clusterNodeId(folder);
    visibleIds.add(clusterId);
    displayNodes.push({
      id: clusterId,
      name: folder.split("/").pop() ?? folder,
      file: folder,
      type: "utility",
      cluster: { folder, count: members.length },
      stats: { incoming: 0, outgoing: 0 },
    });
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
  const ids = new Set(graph.meta?.entryNodeIds ?? []);
  const fromMeta = graph.nodes.filter((node) => ids.has(node.id));
  if (fromMeta.length > 0) return fromMeta;

  return graph.nodes.filter(
    (node) =>
      node.type === "entry" ||
      /[/\\]main\.tsx$/i.test(node.file) ||
      /[/\\]index\.tsx$/i.test(node.file),
  );
}
