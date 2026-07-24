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
    const relaid = relayoutFlowNodes(nodes, edges, { mode: "compact" });

    expect(relaid).toHaveLength(nodes.length);
    for (const node of relaid) {
      expect(typeof node.position.x).toBe("number");
      expect(typeof node.position.y).toBe("number");
    }
  });

  it("produces a tighter bounding box than the default layout", () => {
    const { nodes, edges } = buildFlowGraph(sampleGraph);
    const defaultExtent = graphExtent(nodes);
    const compactExtent = graphExtent(
      relayoutFlowNodes(nodes, edges, { mode: "compact" }),
    );

    expect(compactExtent.maxX).toBeLessThanOrEqual(defaultExtent.maxX);
    expect(compactExtent.maxY).toBeLessThanOrEqual(defaultExtent.maxY);
    expect(compactExtent.area).toBeLessThan(defaultExtent.area);
  });

  it("returns stable positions for the same input", () => {
    const { nodes, edges } = buildFlowGraph(sampleGraph);
    const first = relayoutFlowNodes(nodes, edges, { mode: "compact" });
    const second = relayoutFlowNodes(nodes, edges, { mode: "compact" });

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

    const relaid = relayoutFlowNodes(spread, edges, { mode: "compact" });
    const compactExtent = graphExtent(relaid);
    const spreadExtent = graphExtent(spread);

    expect(compactExtent.area).toBeLessThan(spreadExtent.area);
  });
});

describe("layoutPresets", () => {
  it("cycles through layout presets", () => {
    expect(nextLayoutPreset("tree-down")).toBe("tree-right");
    expect(nextLayoutPreset("compact")).toBe("tree-down");
  });

  it("persists layout preset in localStorage", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    });

    saveLayoutPreset("by-type");
    expect(loadLayoutPreset()).toBe("by-type");
    saveLayoutPreset(DEFAULT_LAYOUT_PRESET);
    vi.unstubAllGlobals();
  });

  it("layers nodes by depth from entry nodes", () => {
    const { nodes, edges } = buildFlowGraph(sampleGraph);
    const layoutTargets = nodes.filter((node) => node.type !== "cluster");
    const layered = layoutNodesByPreset(layoutTargets, edges, "layers-from-entry", {
      entryIds: ["a"],
    });

    const byId = new Map(layered.map((node) => [node.id, node.position]));
    expect(byId.get("a")!.y).toBeLessThan(byId.get("b")!.y);
    expect(byId.get("b")!.y).toBeLessThan(byId.get("d")!.y);
  });

  it("places tree-right layout wider than tree-down", () => {
    const { nodes, edges } = buildFlowGraph(sampleGraph);
    const layoutTargets = nodes.filter((node) => node.type !== "cluster");
    const down = layoutNodesByPreset(layoutTargets, edges, "tree-down");
    const right = layoutNodesByPreset(layoutTargets, edges, "tree-right");

    expect(graphExtent(right).maxX).toBeGreaterThan(graphExtent(down).maxX);
  });

  it("groups nodes by folder with horizontal separation", () => {
    const { nodes, edges } = buildFlowGraph(sampleGraph);
    const layoutTargets = nodes.filter((node) => node.type !== "cluster");
    const byFolder = layoutNodesByPreset(layoutTargets, edges, "by-folder", {
      graph: sampleGraph,
    });

    const positions = new Map(byFolder.map((node) => [node.id, node.position]));
    expect(positions.get("a")!.x).not.toBe(positions.get("d")!.x);
  });

  it("groups nodes by type into separate columns", () => {
    const { nodes, edges } = buildFlowGraph(sampleGraph);
    const layoutTargets = nodes.filter((node) => node.type !== "cluster");
    const byType = layoutNodesByPreset(layoutTargets, edges, "by-type");

    const hook = byType.find((node) => node.id === "d")!.position;
    const component = byType.find((node) => node.id === "a")!.position;
    expect(hook.x).toBeGreaterThan(component.x);
  });
});
