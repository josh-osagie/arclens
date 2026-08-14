import { describe, expect, it } from "vitest";
import { analyzeFixture, analyzeSamples, nodeByName } from "../helpers";

describe("enrichGraph", () => {
  it("adds connections and stats to every node", async () => {
    const result = await analyzeSamples();

    for (const node of result.graph.nodes) {
      expect(node.connections).toBeDefined();
      expect(node.connections.incoming).toBeInstanceOf(Array);
      expect(node.connections.outgoing).toBeInstanceOf(Array);
      expect(node.stats.incoming).toBe(node.connections.incoming.length);
      expect(node.stats.outgoing).toBe(node.connections.outgoing.length);
    }
  });

  it("records outgoing connections for Counter -> Button", async () => {
    const result = await analyzeSamples();
    const counter = nodeByName(result, "Counter");
    expect(counter).toBeDefined();

    const rendersButton = counter!.connections.outgoing.some(
      (conn) => conn.name === "Button" && conn.edgeType === "renders"
    );
    expect(rendersButton).toBe(true);
  });

  it("includes exportKind and kind on project nodes", async () => {
    const result = await analyzeSamples();
    const button = nodeByName(result, "Button");
    expect(button?.exportKind).toBe("named");
    expect(button?.kind).toBeTruthy();
  });
});

describe("context detection", () => {
  it("detects createContext exports in samples", async () => {
    const result = await analyzeSamples();
    expect(nodeByName(result, "ThemeContext")?.type).toBe("context");
  });

  it("detects createContext in fixture", async () => {
    const result = await analyzeFixture("with-context");
    expect(nodeByName(result, "AuthContext")?.type).toBe("context");
  });
});
