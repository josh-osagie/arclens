export type GraphNode = {
  id: string;
  name: string;
  file: string;
  type: "component" | "hook" | "service";
};

export type GraphEdge = {
  from: string;
  to: string;
  type: "imports" | "renders" | "uses";
};

export type Graph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};
