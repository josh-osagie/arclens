import { describe, expect, it } from "vitest";
import { selectVisibleGraph } from "../../viewer/src/viewGraph";
import type { AtlasGraph } from "../../viewer/src/types";

const graph: AtlasGraph = {
  nodes: [
    { id: "a", name: "App", file: "/src/App.tsx", type: "component" },
    { id: "b", name: "Button", file: "/src/Button.tsx", type: "component" },
    { id: "c", name: "Header", file: "/src/Header.tsx", type: "component" },
  ],
  edges: [
    { from: "a", to: "b", type: "renders" },
    { from: "a", to: "c", type: "renders" },
  ],
};

describe("selectVisibleGraph", () => {
  it("returns full graph for small projects", () => {
    const result = selectVisibleGraph(graph, "", false);
    expect(result.mode).toBe("full");
    expect(result.graph.nodes).toHaveLength(3);
  });

  it("returns empty graph for large projects without search", () => {
    const result = selectVisibleGraph(graph, "", true);
    expect(result.mode).toBe("empty");
    expect(result.graph.nodes).toHaveLength(0);
  });

  it("returns search subgraph with neighbors for large projects", () => {
    const result = selectVisibleGraph(graph, "button", true);
    expect(result.mode).toBe("search");
    expect(result.matchCount).toBe(1);
    expect(result.graph.nodes.map((node) => node.id).sort()).toEqual(["a", "b"]);
  });
});
