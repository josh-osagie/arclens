import { describe, expect, it } from "vitest";
import { analyzeSamples } from "../helpers";
import { slimGraphForExport } from "../../src/slimGraph";

describe("slimGraphForExport", () => {
  it("removes connections from nodes but keeps edges and stats", async () => {
    const result = await analyzeSamples();
    const slim = slimGraphForExport(result.graph);

    expect(slim.meta?.projectName).toBe("samples");
    expect(slim.nodes.length).toBe(result.graph.nodes.length);
    expect(slim.edges.length).toBe(result.graph.edges.length);

    for (const node of slim.nodes) {
      expect(node).not.toHaveProperty("connections");
      expect(node.stats).toBeDefined();
      expect(node.layout).toBeDefined();
    }
  });

  it("shrinks serialized size versus enriched graph", async () => {
    const result = await analyzeSamples();
    const full = JSON.stringify(result.graph);
    const slim = JSON.stringify(slimGraphForExport(result.graph));

    expect(slim.length).toBeLessThan(full.length);
  });
});
