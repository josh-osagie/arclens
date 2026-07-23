import type { AtlasGraph } from "./types";

export type GraphLoadIssue =
  | "not-object"
  | "missing-nodes"
  | "invalid-nodes"
  | "empty-nodes"
  | "invalid-edges";

export type GraphValidationResult =
  | { ok: true; graph: AtlasGraph }
  | { ok: false; issue: GraphLoadIssue; detail: string };

export type EmptyGraphPresentation = {
  title: string;
  body: string;
  detail: string;
};

const EMPTY_GRAPH_BODY =
  "Run `pnpm analyze ./your-project` to generate graph.json, or load a valid graph file.";

/** True when parsed JSON has no renderable nodes (including `{}` and `{ nodes: [] }`). */
export function isEmptyGraph(data: unknown): boolean {
  return !validateGraphData(data).ok;
}

export function emptyGraphPresentation(detail: string): EmptyGraphPresentation {
  return {
    title: "No graph data yet",
    body: EMPTY_GRAPH_BODY,
    detail,
  };
}

export function validateGraphData(data: unknown): GraphValidationResult {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      ok: false,
      issue: "not-object",
      detail: "Graph file is empty or not a JSON object.",
    };
  }

  const record = data as Record<string, unknown>;

  if (!("nodes" in record)) {
    const detail =
      Object.keys(record).length === 0
        ? "Loaded an empty object `{}` (0 nodes)."
        : "Graph is missing a `nodes` array.";
    return { ok: false, issue: "missing-nodes", detail };
  }

  if (!Array.isArray(record.nodes)) {
    return {
      ok: false,
      issue: "invalid-nodes",
      detail: "Graph `nodes` must be an array.",
    };
  }

  if (record.nodes.length === 0) {
    return {
      ok: false,
      issue: "empty-nodes",
      detail: "Graph has 0 nodes.",
    };
  }

  if ("edges" in record && record.edges !== undefined && !Array.isArray(record.edges)) {
    return {
      ok: false,
      issue: "invalid-edges",
      detail: "Graph `edges` must be an array when present.",
    };
  }

  const graph: AtlasGraph = {
    meta: record.meta as AtlasGraph["meta"] | undefined,
    nodes: record.nodes as AtlasGraph["nodes"],
    edges: (Array.isArray(record.edges) ? record.edges : []) as AtlasGraph["edges"],
  };

  return { ok: true, graph };
}
