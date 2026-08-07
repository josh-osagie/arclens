import { describe, expect, it } from "vitest";
import {
  computeNeighborhoodIds,
  defaultNeighborhoodFocusEnabled,
  resolveHighlightIds,
  shouldAutoEnableNeighborhoodFocus,
} from "../../viewer/src/neighborhoodFocus";
import type { AtlasGraph } from "../../viewer/src/types";

const graph: AtlasGraph = {
  nodes: [
    { id: "a", name: "A", file: "src/A.tsx", type: "entry" },
    { id: "b", name: "B", file: "src/B.tsx", type: "component" },
    { id: "c", name: "C", file: "src/C.tsx", type: "component" },
    { id: "d", name: "D", file: "src/D.tsx", type: "component" },
    { id: "e", name: "E", file: "src/E.tsx", type: "component" },
  ],
  edges: [
    { from: "a", to: "b", type: "renders" },
    { from: "b", to: "c", type: "renders" },
    { from: "c", to: "d", type: "renders" },
    { from: "a", to: "e", type: "imports" },
  ],
};

describe("neighborhoodFocus", () => {
  it("includes only the selected node at 0 hops", () => {
    expect(computeNeighborhoodIds("c", graph.edges, 0)).toEqual(new Set(["c"]));
  });

  it("includes direct neighbors at 1 hop", () => {
    expect(computeNeighborhoodIds("c", graph.edges, 1)).toEqual(
      new Set(["b", "c", "d"])
    );
  });

  it("extends to two hops undirected", () => {
    expect(computeNeighborhoodIds("c", graph.edges, 2)).toEqual(
      new Set(["a", "b", "c", "d"])
    );
  });

  it("prefers boot path over neighborhood focus", () => {
    const connected = new Set(["c", "x"]);
    const result = resolveHighlightIds(
      ["a", "b", "c"],
      "c",
      graph.edges,
      connected,
      {
        neighborhoodFocus: true,
        neighborhoodHops: 2,
      }
    );
    expect(result).toEqual(new Set(["a", "b", "c"]));
  });

  it("uses neighborhood when focus is enabled and no path exists", () => {
    const result = resolveHighlightIds([], "c", graph.edges, null, {
      neighborhoodFocus: true,
      neighborhoodHops: 1,
    });
    expect(result).toEqual(new Set(["b", "c", "d"]));
  });

  it("falls back to connected ids when neighborhood focus is off", () => {
    const connected = new Set(["b", "c", "d"]);
    const result = resolveHighlightIds([], "c", graph.edges, connected, {
      neighborhoodFocus: false,
      neighborhoodHops: 2,
    });
    expect(result).toEqual(connected);
  });

  it("defaults dim-distant-nodes on for large graphs only", () => {
    expect(defaultNeighborhoodFocusEnabled(true)).toBe(true);
    expect(defaultNeighborhoodFocusEnabled(false)).toBe(false);
  });

  it("auto-enables neighborhood focus on large graph select before user toggles", () => {
    expect(shouldAutoEnableNeighborhoodFocus(true, false, false)).toBe(true);
    expect(shouldAutoEnableNeighborhoodFocus(true, false, true)).toBe(false);
    expect(shouldAutoEnableNeighborhoodFocus(false, false, false)).toBe(false);
    expect(shouldAutoEnableNeighborhoodFocus(true, true, false)).toBe(false);
  });
});
