import { describe, expect, it } from "vitest";
import {
  emptyGraphPresentation,
  isEmptyGraph,
  validateGraphData,
} from "../../viewer/src/graphValidation";

describe("graphValidation", () => {
  describe("validateGraphData", () => {
    it("rejects an empty object", () => {
      const result = validateGraphData({});
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issue).toBe("missing-nodes");
      expect(result.detail).toContain("empty object");
    });

    it("rejects missing nodes when other keys exist", () => {
      const result = validateGraphData({ meta: { isReactProject: true } });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issue).toBe("missing-nodes");
      expect(result.detail).toContain("missing");
    });

    it("rejects an empty nodes array", () => {
      const result = validateGraphData({ nodes: [], edges: [] });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issue).toBe("empty-nodes");
      expect(result.detail).toContain("0 nodes");
    });

    it("rejects non-array nodes", () => {
      const result = validateGraphData({ nodes: "bad" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issue).toBe("invalid-nodes");
    });

    it("rejects non-array edges", () => {
      const result = validateGraphData({
        nodes: [{ id: "a", name: "A", file: "a.tsx", type: "component" }],
        edges: "bad",
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issue).toBe("invalid-edges");
    });

    it("accepts a valid graph and defaults missing edges to []", () => {
      const node = { id: "a", name: "A", file: "a.tsx", type: "component" as const };
      const result = validateGraphData({ nodes: [node] });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.graph.nodes).toEqual([node]);
      expect(result.graph.edges).toEqual([]);
    });

    it("accepts a valid graph with edges", () => {
      const nodes = [
        { id: "a", name: "A", file: "a.tsx", type: "component" as const },
        { id: "b", name: "B", file: "b.tsx", type: "component" as const },
      ];
      const edges = [{ from: "a", to: "b", type: "imports" as const }];
      const result = validateGraphData({ nodes, edges });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.graph).toEqual({ nodes, edges });
    });
  });

  describe("isEmptyGraph", () => {
    it("returns true for empty and zero-node graphs", () => {
      expect(isEmptyGraph({})).toBe(true);
      expect(isEmptyGraph({ nodes: [] })).toBe(true);
    });

    it("returns false for a graph with nodes", () => {
      expect(
        isEmptyGraph({
          nodes: [{ id: "a", name: "A", file: "a.tsx", type: "component" }],
        }),
      ).toBe(false);
    });
  });

  describe("emptyGraphPresentation", () => {
    it("returns the standard empty-state copy", () => {
      const presentation = emptyGraphPresentation("Graph has 0 nodes.");
      expect(presentation.title).toBe("No graph data yet");
      expect(presentation.body).toContain("pnpm analyze");
      expect(presentation.detail).toBe("Graph has 0 nodes.");
    });
  });
});
