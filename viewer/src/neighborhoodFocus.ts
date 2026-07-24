import type { AtlasGraph } from "./types";

export const DEFAULT_NEIGHBORHOOD_HOPS = 2;

/** Default when the user has not explicitly toggled dim-distant-nodes. */
export function defaultNeighborhoodFocusEnabled(isLargeGraph: boolean): boolean {
  return isLargeGraph;
}

/** Auto-enable on node select only before the user has set a preference. */
export function shouldAutoEnableNeighborhoodFocus(
  isLargeGraph: boolean,
  userHasToggled: boolean,
  currentlyEnabled: boolean,
): boolean {
  return isLargeGraph && !userHasToggled && !currentlyEnabled;
}

/**
 * BFS over undirected adjacency: selected node plus nodes within `hops` edges.
 */
export function computeNeighborhoodIds(
  nodeId: string,
  edges: AtlasGraph["edges"],
  hops: number,
): Set<string> {
  const neighborhood = new Set<string>([nodeId]);
  let frontier = new Set<string>([nodeId]);

  for (let depth = 0; depth < hops; depth++) {
    const nextFrontier = new Set<string>();

    for (const edge of edges) {
      if (frontier.has(edge.from) && !neighborhood.has(edge.to)) {
        neighborhood.add(edge.to);
        nextFrontier.add(edge.to);
      }
      if (frontier.has(edge.to) && !neighborhood.has(edge.from)) {
        neighborhood.add(edge.from);
        nextFrontier.add(edge.from);
      }
    }

    frontier = nextFrontier;
    if (frontier.size === 0) break;
  }

  return neighborhood;
}

export function resolveHighlightIds(
  pathIds: string[],
  selectedId: string | null,
  edges: AtlasGraph["edges"],
  connectedIds: Set<string> | null,
  options: {
    neighborhoodFocus: boolean;
    neighborhoodHops: number;
  },
): Set<string> | null {
  if (pathIds.length > 0) {
    return new Set(pathIds);
  }

  if (!selectedId) {
    return connectedIds;
  }

  if (options.neighborhoodFocus) {
    return computeNeighborhoodIds(selectedId, edges, options.neighborhoodHops);
  }

  return connectedIds;
}
