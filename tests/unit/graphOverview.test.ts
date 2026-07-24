import { describe, expect, it } from "vitest";
import {
  computeEntryPoints,
  computeHubNodes,
  computeTopFolders,
} from "../../viewer/src/graphOverview";
import { clusterNodeId } from "../../viewer/src/clusterGraph";
import type { AtlasGraph } from "../../viewer/src/types";

const graph: AtlasGraph = {
  meta: { entryNodeIds: ["entry"] },
  nodes: [
    { id: "entry", name: "App", file: "src/main.tsx", type: "entry" },
    { id: "a1", name: "Alpha", file: "src/components/A.tsx", type: "component" },
    { id: "a2", name: "Beta", file: "src/components/B.tsx", type: "component" },
    { id: "u1", name: "Util", file: "src/utils/format.ts", type: "utility" },
    { id: "hub", name: "Hub", file: "src/components/Hub.tsx", type: "component" },
  ],
  edges: [
    { from: "entry", to: "hub", type: "renders" },
    { from: "hub", to: "a1", type: "renders" },
    { from: "hub", to: "a2", type: "renders" },
    { from: "hub", to: "u1", type: "imports" },
    { from: "a1", to: "u1", type: "imports" },
  ],
};

describe("graphOverview", () => {
  it("ranks folders by node count", () => {
    const folders = computeTopFolders(graph, 4);
    expect(folders[0]?.folder).toBe("src/components");
    expect(folders[0]?.count).toBe(3);
    expect(folders[0]?.clusterId).toBe(clusterNodeId("src/components"));
  });

  it("ranks hub nodes by total degree", () => {
    const hubs = computeHubNodes(graph, 3);
    expect(hubs[0]?.node.id).toBe("hub");
    expect(hubs[0]?.degree).toBe(4);
  });

  it("returns deduped entry points from meta or heuristics", () => {
    const entries = computeEntryPoints(graph);
    expect(entries.map((entry) => entry.node.id)).toEqual(["entry"]);
    expect(entries[0]?.exportCount).toBe(1);
  });

  it("excludes barrel re-exports from entry points", () => {
    const barrelGraph: AtlasGraph = {
      meta: {
        entryNodeIds: ["badge-a", "badge-b", "main"],
      },
      nodes: [
        { id: "main", name: "bootstrap", file: "src/main.tsx", type: "entry" },
        { id: "badge-a", name: "BadgeIcon", file: "src/components/badge/index.tsx", type: "component" },
        { id: "badge-b", name: "BadgeLabel", file: "src/components/badge/index.tsx", type: "component" },
      ],
      edges: [],
    };

    const entries = computeEntryPoints(barrelGraph);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.node.id).toBe("main");
    expect(entries[0]?.file).toBe("src/main.tsx");
  });

  it("excludes test files from entry points even when typed as entry", () => {
    const testGraph: AtlasGraph = {
      meta: {
        entryNodeIds: ["main", "signin-test"],
      },
      nodes: [
        { id: "main", name: "bootstrap", file: "src/main.tsx", type: "entry" },
        { id: "signin-test", name: "SigninTest", file: "src/Signin.test.tsx", type: "entry" },
      ],
      edges: [],
    };

    const entries = computeEntryPoints(testGraph);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.node.id).toBe("main");
  });

  it("falls back to graph roots for sample-sized graphs without bootstrap files", () => {
    const samplesGraph: AtlasGraph = {
      meta: { entryNodeIds: [] },
      nodes: [
        {
          id: "counter",
          name: "Counter",
          file: "samples/Counter.tsx",
          type: "component",
          stats: { incoming: 0, outgoing: 4 },
        },
        {
          id: "button",
          name: "Button",
          file: "samples/Button.tsx",
          type: "component",
          stats: { incoming: 3, outgoing: 0 },
        },
        {
          id: "orphan",
          name: "ThemeContext",
          file: "samples/ThemeContext.tsx",
          type: "context",
          stats: { incoming: 0, outgoing: 0 },
        },
      ],
      edges: [
        { from: "counter", to: "button", type: "renders" },
      ],
    };

    const entries = computeEntryPoints(samplesGraph);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.node.id).toBe("counter");
  });
});
