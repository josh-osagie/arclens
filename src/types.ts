import type { Entitlements } from "./entitlements";

export type GraphEdgeType = "imports" | "renders" | "uses";

export type GraphProp = {
  name: string;
  type?: string;
  optional?: boolean;
  defaultValue?: string;
};

export type GraphNodeType =
  "component" | "hook" | "utility" | "context" | "entry" | "config" | "route";

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
  /** ISO timestamp of the last analyze run — used by the viewer to detect watch updates. */
  analyzedAt?: string;
  /** Pro-only info: tier (free/pro), Next router nodes, framework detected, etc. */
  pro?: {
    tier: "free" | "pro";
    /** Next.js / Remix route tree metadata for the sidebar panel */
    routes?: RouteNode[];
    framework?: "nextjs" | "remix" | "generic";
  };
};

export type RouteSegment = {
  /** e.g. "products/[id]" relative to app/ or pages/ root */
  path: string;
  /** e.g. "page" | "layout" | "route" | "loading" | "error" */
  kind?: string;
  /** Node id of the matching symbol when known */
  nodeId?: string;
  /** Source file path */
  file?: string;
  children?: RouteSegment[];
};

export type RouteNode = {
  id: string;
  /** "app" | "pages" */
  router: string;
  /** Top-level route segments (children form the tree) */
  segments: RouteSegment[];
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

/**
 * Open-core plugin contract.
 *
 * Public arclens ships no plugins. Commercial plugin packages (e.g. @arclens/pro)
 * export a default ArclensPlugin and public arclens calls these hooks when the
 * plugin is installed.
 */
export type GraphExtendContext = {
  graph: Graph;
  /** Target directory being analyzed (absolute, normalized) */
  targetDir: string;
  /** Scanned file list */
  scannedFiles: string[];
};

export type GraphExtendResult = {
  /** Extra nodes injected by the plugin (e.g. route nodes) */
  nodes?: GraphNode[];
  /** Extra edges */
  edges?: GraphEdge[];
  /** Meta overrides (routes, framework flag, extra insights merged) */
  meta?: Partial<GraphMeta>;
  /** Additional insights (convenience — merged into meta.insights) */
  insights?: GraphInsight[];
};

export type ArclensPlugin = {
  /** Display name, e.g. "@arclens/pro" */
  name: string;
  /** Plugin version (for troubleshooting) */
  version?: string;
  /** Override or raise plan entitlements (maxFiles, frameworkAdapters, etc.) */
  entitlements?: Partial<Entitlements> | ((base: Entitlements) => Entitlements);
  /**
   * Called after the core graph has been built + enriched + assessed.
   * Plugins return extra nodes, edges, insights, and meta (e.g. Next route tree).
   */
  extendGraph?: (ctx: GraphExtendContext) => GraphExtendResult | Promise<GraphExtendResult>;
};
