export type GraphEdgeType = "imports" | "renders" | "uses";

export type GraphNodeType = "component" | "hook" | "utility" | "context";

export type GraphConnection = {
  nodeId: string;
  name: string;
  edgeType: GraphEdgeType;
  file: string;
};

export type GraphNode = {
  id: string;
  name: string;
  file: string;
  type: GraphNodeType;
  exportKind?: "default" | "named";
  kind?: string;
  connections: {
    incoming: GraphConnection[];
    outgoing: GraphConnection[];
  };
  stats: {
    incoming: number;
    outgoing: number;
  };
};

export type GraphEdge = {
  from: string;
  to: string;
  type: GraphEdgeType;
};

export type Graph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};
