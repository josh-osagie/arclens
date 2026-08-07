import { describe, expect, it } from "vitest";
import { edgeColors } from "../../viewer/src/design/tokens";
import { buildFlowGraph } from "../../viewer/src/buildFlowGraph";
import {
  filterEdgesByVisibility,
  getFlowEdgeTypes,
} from "../../viewer/src/edgeVisibility";
import {
  formatEdgeTypeLabel,
  mergeSameDirectionEdges,
  primaryEdgeType,
  sortEdgeTypes,
  strokeColorForEdgeTypes,
} from "../../viewer/src/mergeFlowEdges";
import type { AtlasGraph } from "../../viewer/src/types";

describe("mergeSameDirectionEdges", () => {
  it("merges multiple types on the same from/to pair", () => {
    expect(
      mergeSameDirectionEdges([
        { from: "a", to: "b", type: "imports" },
        { from: "a", to: "b", type: "renders" },
      ])
    ).toEqual([{ from: "a", to: "b", types: ["renders", "imports"] }]);
  });

  it("keeps reverse-direction edges separate", () => {
    expect(
      mergeSameDirectionEdges([
        { from: "a", to: "b", type: "imports" },
        { from: "b", to: "a", type: "imports" },
      ])
    ).toEqual([
      { from: "a", to: "b", types: ["imports"] },
      { from: "b", to: "a", types: ["imports"] },
    ]);
  });

  it("deduplicates repeated edge types", () => {
    expect(
      mergeSameDirectionEdges([
        { from: "a", to: "b", type: "uses" },
        { from: "a", to: "b", type: "uses" },
      ])
    ).toEqual([{ from: "a", to: "b", types: ["uses"] }]);
  });

  it("prefers renders stroke color over imports", () => {
    const types = sortEdgeTypes(["imports", "renders"]);
    expect(primaryEdgeType(types)).toBe("renders");
    expect(strokeColorForEdgeTypes(types)).toBe(edgeColors.renders);
    expect(formatEdgeTypeLabel(types)).toBe("renders · imports");
  });
});

describe("buildFlowGraph edge merging", () => {
  const dualEdgeGraph: AtlasGraph = {
    meta: { isReactProject: true },
    nodes: [
      { id: "a", name: "App", file: "src/App.tsx", type: "component" },
      { id: "b", name: "Header", file: "src/Header.tsx", type: "component" },
    ],
    edges: [
      { from: "a", to: "b", type: "imports" },
      { from: "a", to: "b", type: "renders" },
    ],
  };

  it("emits one React Flow edge with combined label and types", () => {
    const { edges } = buildFlowGraph(dualEdgeGraph);

    expect(edges).toHaveLength(1);
    expect(edges[0]!.data?.edgeTypes).toEqual(["renders", "imports"]);
    expect(edges[0]!.label).toBe("renders · imports");
    expect(edges[0]!.style?.stroke).toBe(edgeColors.renders);
  });

  it("shows merged edge when any type is visible and trims the label", () => {
    const { edges } = buildFlowGraph(dualEdgeGraph);
    const [merged] = edges;
    expect(getFlowEdgeTypes(merged!)).toEqual(["renders", "imports"]);

    const visible = filterEdgesByVisibility(edges, {
      imports: false,
      renders: true,
      uses: true,
    });

    expect(visible).toHaveLength(1);
    expect(visible[0]!.label).toBe("renders");
  });

  it("hides merged edge only when all its types are hidden", () => {
    const { edges } = buildFlowGraph(dualEdgeGraph);

    expect(
      filterEdgesByVisibility(edges, {
        imports: false,
        renders: false,
        uses: true,
      })
    ).toEqual([]);
  });
});
