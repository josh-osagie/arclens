/** Viewer performance and large-graph behavior tuning. */

/** Above this node count, compact mode and search-gated rendering apply. */
export const LARGE_GRAPH_THRESHOLD = 500;

/** Auto-enable domain folder clustering above this runtime node count. */
export const CLUSTER_OVERVIEW_THRESHOLD = 40;

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

/** Shortcuts panel: top folders and hub nodes shown. */
export const OVERVIEW_TOP_FOLDERS = 8;
export const OVERVIEW_HUB_NODES = 8;
