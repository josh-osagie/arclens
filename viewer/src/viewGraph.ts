import type { AtlasGraph } from "./types";
import { nodeMatchesSearch } from "./clusterGraph";
import {
  FORCE_FULL_GRAPH,
  MAX_VISIBLE_NODES,
} from "./viewerConfig";

export type ViewGraphMode = "full" | "search" | "empty" | "overview";

export type ViewGraphSelection = {
  graph: AtlasGraph;
  mode: ViewGraphMode;
  matchCount: number;
};

export function selectVisibleGraph(
  graph: AtlasGraph,
  searchLower: string,
  isLarge: boolean,
): ViewGraphSelection {
  if (!isLarge || FORCE_FULL_GRAPH) {
    return { graph, mode: "full", matchCount: graph.nodes.length };
  }

  if (!searchLower) {
    return {
      graph,
      mode: "overview",
      matchCount: graph.nodes.length,
    };
  }

  const matchingIds = new Set<string>();
  for (const node of graph.nodes) {
    if (nodeMatchesSearch(node, searchLower)) {
      matchingIds.add(node.id);
    }
  }

  if (matchingIds.size === 0) {
    return {
      graph: { meta: graph.meta, nodes: [], edges: [] },
      mode: "empty",
      matchCount: 0,
    };
  }

  const visibleIds = new Set(matchingIds);
  for (const edge of graph.edges) {
    if (matchingIds.has(edge.from) || matchingIds.has(edge.to)) {
      visibleIds.add(edge.from);
      visibleIds.add(edge.to);
    }
  }

  let nodeIds = [...visibleIds];
  if (nodeIds.length > MAX_VISIBLE_NODES) {
    const matches = [...matchingIds];
    const rest = nodeIds.filter((id) => !matchingIds.has(id));
    nodeIds = [...matches, ...rest].slice(0, MAX_VISIBLE_NODES);
  }

  const idSet = new Set(nodeIds);
  return {
    graph: {
      meta: graph.meta,
      nodes: graph.nodes.filter((node) => idSet.has(node.id)),
      edges: graph.edges.filter(
        (edge) => idSet.has(edge.from) && idSet.has(edge.to),
      ),
    },
    mode: "search",
    matchCount: matchingIds.size,
  };
}
