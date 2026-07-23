export type GraphEdgeType = "imports" | "renders" | "uses";

export type GraphProp = {
  name: string;
  type?: string;
  optional?: boolean;
  defaultValue?: string;
};

export type GraphNodeType =
  | "component"
  | "hook"
  | "utility"
  | "context"
  | "entry"
  | "config";

export type GraphInsight = {
  severity: "error" | "warning" | "info" | "tip";
  title: string;
  detail: string;
  file?: string;
  line?: number;
  eslintRule?: string;
};

export type GraphMeta = {
  targetDir?: string;
  projectName?: string;
  isReactProject: boolean;
  notice?: string;
  signals?: string[];
  insights?: GraphInsight[];
  entryNodeIds?: string[];
};

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
  props?: GraphProp[];
  layout?: {
    x: number;
    y: number;
  };
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
  meta?: GraphMeta;
  nodes: GraphNode[];
  edges: GraphEdge[];
};
