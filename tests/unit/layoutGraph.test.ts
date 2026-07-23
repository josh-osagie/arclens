import { describe, expect, it } from "vitest";
import { analyzeSamples } from "../helpers";
import { attachLayoutToNodes, computeNodeLayouts } from "../../src/layoutGraph";

describe("layoutGraph", () => {
  it("assigns layout coordinates to every node", () => {
    const result = analyzeSamples();
    const laidOut = attachLayoutToNodes(result.graph.nodes, result.graph.edges);

    expect(laidOut.length).toBe(result.graph.nodes.length);
    for (const node of laidOut) {
      expect(node.layout).toBeDefined();
      expect(typeof node.layout?.x).toBe("number");
      expect(typeof node.layout?.y).toBe("number");
    }
  });

  it("returns stable positions for the same graph", () => {
    const result = analyzeSamples();
    const first = computeNodeLayouts(result.graph.nodes, result.graph.edges);
    const second = computeNodeLayouts(result.graph.nodes, result.graph.edges);

    for (const node of result.graph.nodes) {
      expect(first.get(node.id)).toEqual(second.get(node.id));
    }
  });
});
