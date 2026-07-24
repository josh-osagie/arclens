import { describe, expect, it } from "vitest";
import {
  buildFlowGraph,
  relayoutFlowNodes,
} from "../../viewer/src/buildFlowGraph";
import type { AtlasGraph } from "../../viewer/src/types";

function graphExtent(nodes: { position: { x: number; y: number } }[]) {
  let maxX = 0;
  let maxY = 0;
  for (const node of nodes) {
    maxX = Math.max(maxX, node.position.x);
    maxY = Math.max(maxY, node.position.y);
  }
  return { maxX, maxY, area: maxX * maxY };
}

const sampleGraph: AtlasGraph = {
  meta: { isReactProject: true },
  nodes: [
    { id: "a", name: "App", file: "src/App.tsx", type: "component" },
    { id: "b", name: "Header", file: "src/Header.tsx", type: "component" },
    { id: "c", name: "Footer", file: "src/Footer.tsx", type: "component" },
    { id: "d", name: "useAuth", file: "src/useAuth.ts", type: "hook" },
  ],
  edges: [
    { from: "a", to: "b", type: "renders" },
    { from: "a", to: "c", type: "renders" },
    { from: "b", to: "d", type: "uses" },
  ],
};

describe("buildFlowGraph relayout", () => {
  it("assigns positions to every visible node", () => {
    const { nodes, edges } = buildFlowGraph(sampleGraph);
    const relaid = relayoutFlowNodes(nodes, edges);

    expect(relaid).toHaveLength(nodes.length);
    for (const node of relaid) {
      expect(typeof node.position.x).toBe("number");
      expect(typeof node.position.y).toBe("number");
    }
  });

  it("produces a tighter bounding box than the default layout", () => {
    const { nodes, edges } = buildFlowGraph(sampleGraph);
    const defaultExtent = graphExtent(nodes);
    const compactExtent = graphExtent(relayoutFlowNodes(nodes, edges));

    expect(compactExtent.maxX).toBeLessThanOrEqual(defaultExtent.maxX);
    expect(compactExtent.maxY).toBeLessThanOrEqual(defaultExtent.maxY);
    expect(compactExtent.area).toBeLessThan(defaultExtent.area);
  });

  it("returns stable positions for the same input", () => {
    const { nodes, edges } = buildFlowGraph(sampleGraph);
    const first = relayoutFlowNodes(nodes, edges);
    const second = relayoutFlowNodes(nodes, edges);

    for (let index = 0; index < first.length; index++) {
      expect(first[index]?.position).toEqual(second[index]?.position);
    }
  });

  it("repositions nodes that were manually spread apart", () => {
    const { nodes, edges } = buildFlowGraph(sampleGraph);
    const spread = nodes.map((node, index) => ({
      ...node,
      position: { x: index * 800, y: index * 600 },
    }));

    const relaid = relayoutFlowNodes(spread, edges);
    const compactExtent = graphExtent(relaid);
    const spreadExtent = graphExtent(spread);

    expect(compactExtent.area).toBeLessThan(spreadExtent.area);
  });
});
