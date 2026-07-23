import type { Graph, GraphNode } from "./types";

type SlimGraphNode = Omit<GraphNode, "connections">;

/**
 * Viewer-facing graph: edges + slim nodes (no embedded connection lists).
 * Keeps stats so the UI can show usage without rebuilding from edges.
 */
export function slimGraphForExport(graph: Graph): Graph {
  const nodes: SlimGraphNode[] = graph.nodes.map(({ connections: _connections, ...node }) => node);

  return {
    meta: graph.meta,
    nodes,
    edges: graph.edges,
  };
}
