import path from "node:path";
import type { ExportRecord } from "./extractors/exports";
import { nodeId } from "./extractors/find";
import type { Graph, GraphConnection, GraphEdge, GraphNode, GraphProp } from "./types";

function relFile(filePath: string): string {
  if (filePath === "external") return "external";
  return path.relative(process.cwd(), filePath) || filePath;
}

function toConnection(
  peerId: string,
  edgeType: GraphEdge["type"],
  nodeById: Map<string, GraphNode>,
): GraphConnection {
  const peer = nodeById.get(peerId);
  return {
    nodeId: peerId,
    name: peer?.name ?? peerId.split("::").pop() ?? peerId,
    edgeType,
    file: peer ? relFile(peer.file) : "unknown",
  };
}

export function enrichGraph(
  graph: Graph,
  exports: ExportRecord[],
  propsByNodeId: Map<string, GraphProp[]> = new Map(),
): Graph {
  const exportById = new Map(exports.map((exp) => [nodeId(exp), exp]));

  const baseNodes: GraphNode[] = graph.nodes.map((node) => {
    const exp = exportById.get(node.id);
    const props = propsByNodeId.get(node.id);
    return {
      ...node,
      exportKind: exp?.exportKind,
      kind: exp?.kind,
      ...(props && props.length > 0 ? { props } : {}),
      connections: { incoming: [], outgoing: [] },
      stats: { incoming: 0, outgoing: 0 },
    };
  });

  const nodeById = new Map(baseNodes.map((node) => [node.id, node]));

  for (const edge of graph.edges) {
    const fromNode = nodeById.get(edge.from);
    const toNode = nodeById.get(edge.to);
    if (!fromNode || !toNode) continue;

    fromNode.connections.outgoing.push(toConnection(edge.to, edge.type, nodeById));
    toNode.connections.incoming.push(toConnection(edge.from, edge.type, nodeById));
  }

  for (const node of baseNodes) {
    node.stats.incoming = node.connections.incoming.length;
    node.stats.outgoing = node.connections.outgoing.length;
  }

  return { nodes: baseNodes, edges: graph.edges };
}

export function findNodesByName(graph: Graph, name: string): GraphNode[] {
  const exact = graph.nodes.filter((node) => node.name === name);
  if (exact.length > 0) return exact;

  const lower = name.toLowerCase();
  return graph.nodes.filter((node) => node.name.toLowerCase() === lower);
}
