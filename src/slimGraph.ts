import { findEntryNodeIds as resolveEntryNodeIds } from "./entryPoints";
import { attachLayoutToNodes } from "./layoutGraph";
import type { Graph, GraphMeta, GraphNode } from "./types";
import type { Insight } from "./insights";

type SlimGraphNode = Omit<GraphNode, "connections">;

export type GraphExportOptions = {
  insights?: Insight[];
  entryNodeIds?: string[];
};

export function findEntryNodeIds(graph: Graph): string[] {
  return resolveEntryNodeIds(graph.nodes, graph.meta?.entryNodeIds, graph.edges);
}

/**
 * Viewer-facing graph: slim nodes, pre-computed layout, optional insights in meta.
 */
export function slimGraphForExport(
  graph: Graph,
  options: GraphExportOptions = {},
): Graph {
  const laidOut = attachLayoutToNodes(graph.nodes, graph.edges);
  const nodes: SlimGraphNode[] = laidOut.map(
    ({ connections: _connections, ...node }) => node,
  );

  const meta: GraphMeta = {
    ...graph.meta,
    isReactProject: graph.meta?.isReactProject ?? true,
    entryNodeIds: options.entryNodeIds ?? findEntryNodeIds(graph),
    ...(options.insights ? { insights: options.insights } : {}),
  };

  return {
    meta,
    nodes,
    edges: graph.edges,
  };
}
