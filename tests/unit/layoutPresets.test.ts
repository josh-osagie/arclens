import { afterEach, describe, expect, it, vi } from "vitest";
import {
  filterEdgesForDagreLayout,
  getDagreLayoutedNodes,
  getDagreLayoutedNodesAsync,
  layoutIncludesClusterNodes,
  layoutNodesByPreset,
  layoutNodesByPresetAsync,
  loadLayoutPreset,
  nextLayoutPreset,
  resetLayoutWorkerForTests,
  saveLayoutPreset,
  DEFAULT_LAYOUT_PRESET,
} from "../../viewer/src/layoutPresets";

type TestNode = Parameters<typeof layoutNodesByPreset>[0][number];
type TestEdge = Parameters<typeof layoutNodesByPreset>[1][number];

function flowNode(id: string, type: "atlas" | "cluster" = "atlas"): TestNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: {
      label: id,
      type: "component",
      nodeId: id,
    },
  } as TestNode;
}

describe("layoutPresets", () => {
  afterEach(() => {
    resetLayoutWorkerForTests();
  });

  it("cycles between dagre directions", () => {
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

    expect(loadLayoutPreset()).toBe(DEFAULT_LAYOUT_PRESET);
    saveLayoutPreset("dagre-lr");
    expect(loadLayoutPreset()).toBe("dagre-lr");
    saveLayoutPreset(DEFAULT_LAYOUT_PRESET);
    vi.unstubAllGlobals();
  });

  it("includes cluster nodes in dagre layout", () => {
    expect(layoutIncludesClusterNodes("dagre-tb")).toBe(true);
  });

  it("ranks entry nodes above dependencies (tree down)", () => {
    const nodes: TestNode[] = [flowNode("entry"), flowNode("child")];
    const edges: TestEdge[] = [{ id: "e1", source: "entry", target: "child" }];

    const laidOut = layoutNodesByPreset(nodes, edges, "dagre-tb", {
      entryIds: ["entry"],
    });

    const entry = laidOut.find((node) => node.id === "entry")!;
    const child = laidOut.find((node) => node.id === "child")!;

    expect(entry.position.y).toBeLessThan(child.position.y);
    expect(entry.targetPosition).toBe("top");
    expect(entry.sourcePosition).toBe("bottom");
  });

  it("lays out cluster bubbles in the ranked graph", () => {
    const nodes: TestNode[] = [
      flowNode("entry"),
      { ...flowNode("cluster::features/auth", "cluster"), type: "cluster" },
    ];
    const edges: TestEdge[] = [
      { id: "e1", source: "entry", target: "cluster::features/auth" },
    ];

    const laidOut = getDagreLayoutedNodes(nodes, edges, "TB", ["entry"]);
    const entry = laidOut.find((node) => node.id === "entry")!;
    const cluster = laidOut.find(
      (node) => node.id === "cluster::features/auth"
    )!;

    expect(entry.position.y).toBeLessThan(cluster.position.y);
  });

  it("places tree-right layout wider than tree-down", () => {
    const nodes: TestNode[] = [flowNode("a"), flowNode("b"), flowNode("c")];
    const edges: TestEdge[] = [
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "a", target: "c" },
    ];

    const down = layoutNodesByPreset(nodes, edges, "dagre-tb", {
      entryIds: ["a"],
    });
    const right = layoutNodesByPreset(nodes, edges, "dagre-lr", {
      entryIds: ["a"],
    });

    const downMaxX = Math.max(...down.map((node) => node.position.x));
    const rightMaxX = Math.max(...right.map((node) => node.position.x));
    expect(rightMaxX).toBeGreaterThan(downMaxX);
    expect(right[0]?.targetPosition).toBe("left");
    expect(right[0]?.sourcePosition).toBe("right");
  });

  it("prefers render edges for dagre layout", () => {
    const edges: TestEdge[] = [
      { id: "e1", source: "a", target: "b", data: { edgeType: "imports" } },
      { id: "e2", source: "a", target: "c", data: { edgeType: "renders" } },
    ];
    const filtered = filterEdgesForDagreLayout(edges);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("e2");
  });

  it("async layout falls back to sync when workers are unavailable", async () => {
    const nodes: TestNode[] = [flowNode("entry"), flowNode("child")];
    const edges: TestEdge[] = [{ id: "e1", source: "entry", target: "child" }];

    const sync = getDagreLayoutedNodes(nodes, edges, "TB", ["entry"]);
    const asyncResult = await getDagreLayoutedNodesAsync(nodes, edges, "TB", [
      "entry",
    ]);

    expect(asyncResult).toHaveLength(sync.length);
    for (const node of sync) {
      const match = asyncResult.find((item) => item.id === node.id)!;
      expect(match.position).toEqual(node.position);
      expect(match.sourcePosition).toBe(node.sourcePosition);
      expect(match.targetPosition).toBe(node.targetPosition);
    }
  });

  it("async preset layout matches sync preset layout", async () => {
    const nodes: TestNode[] = [flowNode("a"), flowNode("b")];
    const edges: TestEdge[] = [{ id: "e1", source: "a", target: "b" }];

    const sync = layoutNodesByPreset(nodes, edges, "dagre-lr", {
      entryIds: ["a"],
    });
    const asyncResult = await layoutNodesByPresetAsync(
      nodes,
      edges,
      "dagre-lr",
      {
        entryIds: ["a"],
      }
    );

    expect(asyncResult.map((node) => node.position)).toEqual(
      sync.map((node) => node.position)
    );
  });
});
