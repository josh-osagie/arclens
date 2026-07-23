import { describe, expect, it } from "vitest";
import {
  applyClusterView,
  clusterNodeId,
  folderKey,
  folderFromClusterId,
  isClusterId,
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
  });

  it("expands a folder when requested", () => {
    const expanded = applyClusterView(graph, true, new Set(["src/components"]));
    expect(expanded.nodes.some((node) => node.id === "n1")).toBe(true);
    expect(expanded.nodes.some((node) => node.id === "n2")).toBe(true);
  });

  it("identifies cluster ids", () => {
    const id = clusterNodeId("src/components");
    expect(isClusterId(id)).toBe(true);
    expect(folderFromClusterId(id)).toBe("src/components");
  });
});
