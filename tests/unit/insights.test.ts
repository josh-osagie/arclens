import { describe, expect, it } from "vitest";
import { analyzeSamples } from "../helpers";
import { buildInsights } from "../../src/insights";
import type { ExportRecord } from "../../src/extractors/exports";
import type { GraphEdge, GraphNode } from "../../src/types";
import { nodeId } from "../../src/extractors/find";

function graphNode(name: string, file: string, type: GraphNode["type"]): GraphNode {
  return {
    id: nodeId({ file, name, exportKind: "named", kind: "FunctionDeclaration", type }),
    name,
    file,
    type,
    connections: { incoming: [], outgoing: [] },
    stats: { incoming: 0, outgoing: 0 },
  };
}

describe("buildInsights gates", () => {
  it("does not warn component or hook naming for samples", () => {
    const result = analyzeSamples();
    const titles = buildInsights(result).map((insight) => insight.title);

    expect(titles.some((title) => title.includes("Component naming:"))).toBe(false);
    expect(titles.some((title) => title.includes("Hook naming:"))).toBe(false);
  });

  it("skips component naming when symbol is never rendered as JSX", () => {
    const file = "/src/components/ErrorHandler.tsx";
    const exports: ExportRecord[] = [
      {
        file,
        name: "generateFileError",
        exportKind: "named",
        kind: "FunctionDeclaration",
        type: "component",
      },
    ];
    const nodes = [graphNode("generateFileError", file, "component")];
    const edges: GraphEdge[] = [];

    const titles = buildInsights({
      ...analyzeSamples(),
      graph: { nodes, edges },
      exports,
      importEdges: [],
    }).map((insight) => insight.title);

    expect(titles.some((title) => title.includes("Component naming: generateFileError"))).toBe(
      false,
    );
  });
});
