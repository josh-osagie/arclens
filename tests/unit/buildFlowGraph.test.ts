import { describe, expect, it, vi } from "vitest";
import {
  buildFlowGraph,
  relayoutFlowNodes,
} from "../../viewer/src/buildFlowGraph";
import {
  DEFAULT_LAYOUT_PRESET,
  layoutNodesByPreset,
  loadLayoutPreset,
  nextLayoutPreset,
  saveLayoutPreset,
} from "../../viewer/src/layoutPresets";
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
  meta: { isReactProject: true, entryNodeIds: ["a"] },
  nodes: [
    { id: "a", name: "App", file: "src/App.tsx", type: "component" },
    { id: "b", name: "Header", file: "src/Header.tsx", type: "component" },
    { id: "c", name: "Footer", file: "src/Footer.tsx", type: "component" },
    { id: "d", name: "useAuth", file: "src/useAuth.ts", type: "hook" },
  ],
  edges: [
    { from: "a", to: "b", type: "renders" },
    { from: "a", to: "c", type: "renders" },
    { from: "b", to: "d", type: "renders" },
  ],
};

describe("buildFlowGraph relayout", () => {
  it("assigns positions to every visible node", () => {
    const { nodes, edges } = buildFlowGraph(sampleGraph);
    const relaid = relayoutFlowNodes(nodes, edges, { mode: "dagre-tb", entryIds: ["a"] });

    expect(relaid).toHaveLength(nodes.length);
    for (const node of relaid) {
      expect(typeof node.position.x).toBe("number");
      expect(typeof node.position.y).toBe("number");
    }
  });

  it("uses smoothstep edges", () => {
    const { edges } = buildFlowGraph(sampleGraph);
    expect(edges[0]?.type).toBe("smoothstep");
  });

  it("lays out cluster nodes when they lack embedded graph.json layout", () => {
    const graphWithLayout: AtlasGraph = {
      meta: { isReactProject: true, entryNodeIds: ["a"] },
      nodes: [
        {
          id: "a",
          name: "App",
          file: "src/App.tsx",
          type: "component",
          layout: { x: 200, y: 100 },
        },
        {
          id: "cluster::src/components",
          name: "+3",
          file: "src/components",
          type: "utility",
          cluster: { folder: "src/components", count: 3 },
        },
        {
          id: "cluster::src/utils",
          name: "+2",
          file: "src/utils",
          type: "utility",
          cluster: { folder: "src/utils", count: 2 },
        },
      ],
      edges: [{ from: "a", to: "cluster::src/components", type: "renders" }],
    };

    const { nodes } = buildFlowGraph(graphWithLayout);
    const clusterPositions = nodes
      .filter((node) => node.id.startsWith("cluster::"))
      .map((node) => node.position);

    expect(clusterPositions).toHaveLength(2);
    expect(clusterPositions.every((position) => position.x !== 0 || position.y !== 0)).toBe(true);
    expect(new Set(clusterPositions.map((position) => `${position.x},${position.y}`)).size).toBe(2);
  });

  it("returns stable positions for the same input", () => {
    const { nodes, edges } = buildFlowGraph(sampleGraph);
    const first = relayoutFlowNodes(nodes, edges, { mode: "dagre-tb", entryIds: ["a"] });
    const second = relayoutFlowNodes(nodes, edges, { mode: "dagre-tb", entryIds: ["a"] });

    for (let index = 0; index < first.length; index++) {
      expect(first[index]?.position).toEqual(second[index]?.position);
    }
  });

  it("repositions nodes that were manually spread apart", () => {
    const { nodes, edges } = buildFlowGraph(sampleGraph);
    const spread = nodes.map((node, index) => ({
      ...node,
      position: { x: index * 800, y: index *  600 },
    }));

    const relaid = relayoutFlowNodes(spread, edges, { mode: "dagre-tb", entryIds: ["a"] });
    const relaidExtent = graphExtent(relaid);
    const spreadExtent = graphExtent(spread);

    expect(relaidExtent.area).toBeLessThan(spreadExtent.area);
  });
});

describe("layoutPresets", () => {
  it("cycles through layout presets", () => {
    expect(nextLayoutPreset("dagre-tb")).toBe("dagre-lr");
    expect(nextLayoutPreset("dagre-lr")).toBe("dagre-tb");
  });

  it("persists layout preset in localStorage", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    });

    saveLayoutPreset("dagre-lr");
    expect(loadLayoutPreset()).toBe("dagre-lr");
    saveLayoutPreset(DEFAULT_LAYOUT_PRESET);
    vi.unstubAllGlobals();
  });

  it("ranks nodes by depth from entry nodes", () => {
    const { nodes, edges } = buildFlowGraph(sampleGraph);
    const layered = layoutNodesByPreset(nodes, edges, "dagre-tb", {
      entryIds: ["a"],
    });

    const byId = new Map(layered.map((node) => [node.id, node.position]));
    expect(byId.get("a")!.y).toBeLessThan(byId.get("b")!.y);
    expect(byId.get("b")!.y).toBeLessThan(byId.get("d")!.y);
  });

  it("places tree-right layout wider than tree-down", () => {
    const { nodes, edges } = buildFlowGraph(sampleGraph);
    const down = layoutNodesByPreset(nodes, edges, "dagre-tb", { entryIds: ["a"] });
    const right = layoutNodesByPreset(nodes, edges, "dagre-lr", { entryIds: ["a"] });

    expect(graphExtent(right).maxX).toBeGreaterThan(graphExtent(down).maxX);
  });
});
