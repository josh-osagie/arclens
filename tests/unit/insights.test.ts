import { describe, expect, it } from "vitest";
import { analyzeSamples } from "../helpers";
import {
  buildInsights,
  hookRuleViolationsToInsights,
} from "../../src/insights";
import type { ExportRecord } from "../../src/extractors/exports";
import type { GraphEdge, GraphNode } from "../../src/types";
import { nodeId } from "../../src/extractors/find";

function graphNode(
  name: string,
  file: string,
  type: GraphNode["type"]
): GraphNode {
  return {
    id: nodeId({
      file,
      name,
      exportKind: "named",
      kind: "FunctionDeclaration",
      type,
    }),
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

    expect(titles.some((title) => title.includes("Component naming:"))).toBe(
      false
    );
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

    expect(
      titles.some((title) =>
        title.includes("Component naming: generateFileError")
      )
    ).toBe(false);
  });
});

describe("hookRuleViolationsToInsights", () => {
  it("groups duplicate hook violations in the same file", () => {
    const file = "/src/features/LoanApply.tsx";
    const insights = hookRuleViolationsToInsights([
      {
        hook: "useFormik",
        file,
        line: 42,
        context: "after an early return",
        eslintRule: "@eslint-react/rules-of-hooks",
      },
      {
        hook: "useFormik",
        file,
        line: 78,
        context: "after an early return",
        eslintRule: "@eslint-react/rules-of-hooks",
      },
    ]);

    expect(insights).toHaveLength(1);
    expect(insights[0]?.title).toBe(
      "Rules of Hooks: 2× useFormik called after an early return"
    );
    expect(insights[0]?.detail).toContain("At lines 42, 78.");
  });

  it("keeps separate insights for different hooks or contexts", () => {
    const file = "/src/Comp.tsx";
    const insights = hookRuleViolationsToInsights([
      {
        hook: "useFormik",
        file,
        line: 10,
        context: "after an early return",
        eslintRule: "@eslint-react/rules-of-hooks",
      },
      {
        hook: "useState",
        file,
        line: 20,
        context: "after an early return",
        eslintRule: "@eslint-react/rules-of-hooks",
      },
    ]);

    expect(insights).toHaveLength(2);
    expect(insights.every((insight) => !insight.title.includes("×"))).toBe(
      true
    );
  });
});
