/** Viewer performance and large-graph behavior tuning. */

/** Above this node count, compact mode and search-gated rendering apply. */
export const LARGE_GRAPH_THRESHOLD = 500;

/** Use dagre layout up to this many nodes; grid layout beyond that. */
export const DAGRE_LAYOUT_THRESHOLD = 150;

/** Max nodes shown in a search subgraph on large graphs. */
export const MAX_VISIBLE_NODES = 200;

/** Enable React Flow viewport culling above this visible node count. */
export const VIRTUALIZE_THRESHOLD = 100;

/** Poll graph.json for updates (ms). */
export const GRAPH_POLL_MS = 2000;

/** Slower poll interval for large graphs (watch mode still needs updates). */
export const GRAPH_POLL_MS_LARGE = 4000;

/**
 * Test override: render the full graph even above LARGE_GRAPH_THRESHOLD.
 * Set false for normal search-gated large graph behavior.
 */
export const FORCE_FULL_GRAPH = false;

/** Default folder clustering only for large graphs. */
export const CLUSTER_BY_DEFAULT = true;

/** Shortcuts panel: top folders and hub nodes shown. */
export const OVERVIEW_TOP_FOLDERS = 8;
export const OVERVIEW_HUB_NODES = 8;

/** Nodes revealed per cluster click on large graphs. */
export const INCREMENTAL_CLUSTER_BATCH = 24;
