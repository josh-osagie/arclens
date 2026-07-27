import { describe, expect, it } from "vitest";
import {
  applyClusterView,
  clusterNodeId,
  collapseAllClusterFoldersState,
  collapseClusterFolderState,
  folderKey,
  folderFromClusterId,
  isClusterId,
  listExpandedFolders,
  revealNodeForSpotlight,
  wireClusterEdges,
  buildClusterNodeVisibilityMap,
  groupNodesByFolder,
} from "../../viewer/src/clusterGraph";
import type { AtlasGraph } from "../../viewer/src/types";

const graph: AtlasGraph = {
  nodes: [
    { id: "n1", name: "A", file: "src/components/A.tsx", type: "component" },
    { id: "n2", name: "B", file: "src/components/B.tsx", type: "component" },
    { id: "n3", name: "Main", file: "src/main.tsx", type: "entry" },
  ],
  edges: [{ from: "n3", to: "n1", type: "renders" }],
};

describe("clusterGraph", () => {
  it("derives folder keys from file paths", () => {
    expect(folderKey("src/components/A.tsx")).toBe("src/components");
  });

  it("collapses folder members into cluster nodes", () => {
    const clustered = applyClusterView(graph, true, new Set());
    const clusterIds = clustered.nodes.filter((node) => node.cluster).map((node) => node.id);

    expect(clusterIds).toContain(clusterNodeId("src/components"));
    expect(clustered.nodes.some((node) => node.id === "n1")).toBe(false);
    expect(clustered.nodes.some((node) => node.id === "n3")).toBe(false);
    expect(clustered.nodes.some((node) => node.id === clusterNodeId("src"))).toBe(true);
    expect(clustered.edges).toEqual([
      {
        from: clusterNodeId("src"),
        to: clusterNodeId("src/components"),
        type: "renders",
      },
    ]);
  });

  it("expands a folder when fully expanded", () => {
    const expanded = applyClusterView(graph, true, new Set(["src/components"]));
    expect(expanded.nodes.some((node) => node.id === "n1")).toBe(true);
    expect(expanded.nodes.some((node) => node.id === "n2")).toBe(true);
  });

  it("reveals folder members incrementally", () => {
    const partial = new Map([["src/components", new Set(["n1"])]]);
    const expanded = applyClusterView(graph, true, new Set(), partial);

    expect(expanded.nodes.some((node) => node.id === "n1")).toBe(true);
    expect(expanded.nodes.some((node) => node.id === "n2")).toBe(false);
    expect(expanded.nodes.some((node) => node.id === clusterNodeId("src/components"))).toBe(
      true,
    );
  });

  it("identifies cluster ids", () => {
    const id = clusterNodeId("src/components");
    expect(isClusterId(id)).toBe(true);
    expect(folderFromClusterId(id)).toBe("src/components");
  });

  it("lists expanded folders from full and partial state", () => {
    const partial = new Map([["src/components", new Set(["n1"])]]);
    expect(listExpandedFolders(new Set(["src"]), partial)).toEqual([
      "src",
      "src/components",
    ]);
  });

  it("collapses a folder from expansion state", () => {
    const partial = new Map([["src/components", new Set(["n1"])]]);
    const next = collapseClusterFolderState("src/components", new Set(["src"]), partial);

    expect(next.fullyExpandedFolders.has("src/components")).toBe(false);
    expect(next.fullyExpandedFolders.has("src")).toBe(true);
    expect(next.partialReveals.has("src/components")).toBe(false);
  });

  it("collapses all expanded folders", () => {
    const next = collapseAllClusterFoldersState();

    expect(next.fullyExpandedFolders.size).toBe(0);
    expect(next.partialReveals.size).toBe(0);
  });

  it("reveals a spotlight target and its in-folder neighbors", () => {
    const target = graph.nodes[0]!;
    const next = revealNodeForSpotlight(target, graph, new Map());

    expect(next.get("src/components")).toEqual(new Set(["n1"]));
  });

  it("reveals directly connected nodes in other folders for spotlight", () => {
    const entry = graph.nodes[2]!;
    const next = revealNodeForSpotlight(entry, graph, new Map());

    expect(next.get("src")).toEqual(new Set(["n3"]));
    expect(next.get("src/components")).toEqual(new Set(["n1"]));
  });

  it("dedupes wired cluster edges by endpoint pair and type", () => {
    const groups = groupNodesByFolder(graph.nodes);
    const visibility = buildClusterNodeVisibilityMap(graph, groups, new Set(), new Map());
    const visibleIds = new Set([
      clusterNodeId("src"),
      clusterNodeId("src/components"),
    ]);

    const wired = wireClusterEdges(
      [
        { from: "n3", to: "n1", type: "renders" },
        { from: "n3", to: "n2", type: "renders" },
      ],
      visibility,
      visibleIds,
    );

    expect(wired).toEqual([
      {
        from: clusterNodeId("src"),
        to: clusterNodeId("src/components"),
        type: "renders",
      },
    ]);
  });

  it("wires edges from revealed nodes to a same-folder cluster bubble", () => {
    const partial = new Map([["src/components", new Set(["n1"])]]);
    const clustered = applyClusterView(graph, true, new Set(), partial);

    expect(clustered.edges).toEqual([
      { from: clusterNodeId("src"), to: "n1", type: "renders" },
    ]);
  });
});
