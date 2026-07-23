export type GraphEdgeType = "imports" | "renders" | "uses";

export type GraphNodeType =
  | "component"
  | "hook"
  | "utility"
  | "context"
  | "entry"
  | "config";

export type GraphMeta = {
  targetDir?: string;
  isReactProject: boolean;
  notice?: string;
  signals?: string[];
};

export type GraphConnection = {
  nodeId: string;
  name: string;
  edgeType: GraphEdgeType;
  file: string;
};

export type AtlasGraphNode = {
  id: string;
  name: string;
  file: string;
  type: GraphNodeType;
  exportKind?: "default" | "named";
  kind?: string;
  layout?: {
    x: number;
    y: number;
  };
  connections?: {
    incoming: GraphConnection[];
    outgoing: GraphConnection[];
  };
  stats?: {
    incoming: number;
    outgoing: number;
  };
};

export type AtlasGraph = {
  meta?: GraphMeta;
  nodes: AtlasGraphNode[];
  edges: Array<{
    from: string;
    to: string;
    type: GraphEdgeType;
  }>;
};
