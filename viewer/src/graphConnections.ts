import type { AtlasGraph, AtlasGraphNode, GraphConnection, GraphEdgeType } from "./types";
import { relFile } from "./buildFlowGraph";

export function buildNodeById(graph: AtlasGraph): Map<string, AtlasGraphNode> {
  return new Map(graph.nodes.map((node) => [node.id, node]));
}

function toConnection(
  peerId: string,
  edgeType: GraphEdgeType,
  nodeById: Map<string, AtlasGraphNode>,
): GraphConnection {
  const peer = nodeById.get(peerId);
  return {
    nodeId: peerId,
    name: peer?.name ?? peerId.split("::").pop() ?? peerId,
    edgeType,
    file: peer ? relFile(peer.file) : "unknown",
  };
}

export function buildNodeConnections(
  nodeId: string,
  edges: AtlasGraph["edges"],
  nodeById: Map<string, AtlasGraphNode>,
): { incoming: GraphConnection[]; outgoing: GraphConnection[] } {
  const incoming: GraphConnection[] = [];
  const outgoing: GraphConnection[] = [];

  for (const edge of edges) {
    if (edge.to === nodeId) {
      incoming.push(toConnection(edge.from, edge.type, nodeById));
    }
    if (edge.from === nodeId) {
      outgoing.push(toConnection(edge.to, edge.type, nodeById));
    }
  }

  return { incoming, outgoing };
}

/** Resolve connections from edges when graph.json is slim (Plan B). */
export function enrichNodeForDetails(
  node: AtlasGraphNode,
  graph: AtlasGraph,
  nodeById: Map<string, AtlasGraphNode>,
): AtlasGraphNode {
  if (node.connections) {
    return node;
  }

  const connections = buildNodeConnections(node.id, graph.edges, nodeById);
  const stats = node.stats ?? {
    incoming: connections.incoming.length,
    outgoing: connections.outgoing.length,
  };

  return { ...node, connections, stats };
}

export function getConnectedNodeIdsFromEdges(
  nodeId: string,
  edges: AtlasGraph["edges"],
): Set<string> {
  const ids = new Set<string>([nodeId]);

  for (const edge of edges) {
    if (edge.from === nodeId) ids.add(edge.to);
    if (edge.to === nodeId) ids.add(edge.from);
  }

  return ids;
}

export function graphSignature(graph: AtlasGraph): string {
  const lastNode = graph.nodes.at(-1);
  const lastEdge = graph.edges.at(-1);
  return [
    graph.nodes.length,
    graph.edges.length,
    graph.meta?.analyzedAt ?? "",
    graph.meta?.targetDir ?? "",
    lastNode?.id ?? "",
    lastEdge ? `${lastEdge.from}|${lastEdge.to}|${lastEdge.type}` : "",
  ].join(":");
}
