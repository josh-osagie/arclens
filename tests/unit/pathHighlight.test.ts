import { describe, expect, it } from "vitest";
import {
  findPathFromEntries,
  mergeHighlightIds,
  pathEdgeKeys,
} from "../../viewer/src/pathHighlight";
import type { AtlasGraph } from "../../viewer/src/types";

const graph: AtlasGraph = {
  nodes: [
    { id: "a", name: "App", file: "src/App.tsx", type: "entry" },
    { id: "b", name: "Layout", file: "src/Layout.tsx", type: "component" },
    { id: "c", name: "Button", file: "src/Button.tsx", type: "component" },
  ],
  edges: [
    { from: "a", to: "b", type: "renders" },
    { from: "b", to: "c", type: "renders" },
  ],
};

describe("pathHighlight", () => {
  it("traces backward from target to entry", () => {
    expect(findPathFromEntries(graph, "c", ["a"])).toEqual(["a", "b", "c"]);
  });

  it("returns empty when no path exists", () => {
    expect(findPathFromEntries(graph, "c", ["x"])).toEqual([]);
  });

  it("collects edge keys along a path", () => {
    const keys = pathEdgeKeys(["a", "b", "c"], graph);
    expect(keys.has("a|b|renders")).toBe(true);
    expect(keys.has("b|c|renders")).toBe(true);
  });

  it("prefers path ids over connected ids for highlight", () => {
    const connected = new Set(["c", "x"]);
    expect(mergeHighlightIds(["a", "b", "c"], connected, "c")).toEqual(
      new Set(["a", "b", "c"]),
    );
  });
});
