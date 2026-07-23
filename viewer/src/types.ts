export type GraphEdgeType = "imports" | "renders" | "uses";

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
  cluster?: {
    folder: string;
    count: number;
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
