import { describe, expect, it } from "vitest";
import {
  applyClusterView,
  buildDomainDrilldownGraph,
  clusterNodeId,
  collapseAllClusterFoldersState,
  collapseClusterFolderState,
  filterExternalNodes,
  folderKey,
  folderFromClusterId,
  isClusterId,
  listExpandedFolders,
  mergeSearchPartialReveals,
  nextClusterReveal,
  revealNodeForSpotlight,
  computeSearchHighlightIds,
  findSearchMatchingNodeIds,
  wireClusterEdges,
  buildClusterNodeVisibilityMap,
  findDomainBridgeNodes,
  groupNodesByFolder,
  subclusterKeyWithinDomain,
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
    const clusterIds = clustered.nodes
      .filter((node) => node.cluster)
      .map((node) => node.id);

    expect(clusterIds).toContain(clusterNodeId("src/components"));
    expect(clustered.nodes.some((node) => node.id === "n1")).toBe(false);
    expect(clustered.nodes.some((node) => node.id === "n3")).toBe(false);
    expect(
      clustered.nodes.some((node) => node.id === clusterNodeId("src"))
    ).toBe(true);
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
    expect(
      expanded.nodes.some((node) => node.id === clusterNodeId("src/components"))
    ).toBe(true);
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
    const next = collapseClusterFolderState(
      "src/components",
      new Set(["src"]),
      partial
    );

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
    const visibility = buildClusterNodeVisibilityMap(
      graph,
      groups,
      new Set(),
      new Map()
    );
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
      visibleIds
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

  it("reveals search matches inside collapsed folders", () => {
    const searchGraph: AtlasGraph = {
      nodes: [
        {
          id: "router",
          name: "LendhaRouter",
          file: "src/routing/LendhaRouter.tsx",
          type: "component",
        },
        {
          id: "other",
          name: "Other",
          file: "src/routing/Other.tsx",
          type: "component",
        },
        { id: "main", name: "Main", file: "src/main.tsx", type: "entry" },
      ],
      edges: [{ from: "main", to: "router", type: "renders" }],
    };

    const reveals = mergeSearchPartialReveals(
      searchGraph,
      "lendharouter",
      new Map()
    );
    expect(reveals.get("src/routing")?.has("router")).toBe(true);

    const clustered = applyClusterView(searchGraph, true, new Set(), reveals);
    expect(clustered.nodes.some((node) => node.id === "router")).toBe(true);
  });

  it("highlights folder cluster when search match is still collapsed", () => {
    const searchGraph: AtlasGraph = {
      nodes: [
        {
          id: "router",
          name: "LendhaRouter",
          file: "src/routing/LendhaRouter.tsx",
          type: "component",
        },
        { id: "main", name: "Main", file: "src/main.tsx", type: "entry" },
      ],
      edges: [{ from: "main", to: "router", type: "renders" }],
    };
    const viewGraph = {
      meta: searchGraph.meta,
      nodes: searchGraph.nodes.filter(
        (node) => node.id === "router" || node.id === "main"
      ),
      edges: searchGraph.edges,
    };

    const highlights = computeSearchHighlightIds(
      searchGraph,
      viewGraph,
      "lendharouter",
      true,
      new Set()
    );

    expect(highlights?.has("router")).toBe(true);
    expect(highlights?.has(clusterNodeId("src/routing"))).toBe(true);
    expect(highlights?.has("main")).toBe(true);
  });

  it("groups feature and component subtrees into architectural domains", () => {
    expect(folderKey("/repo/src/features/auth/components/AuthCard.tsx")).toBe(
      "features/auth"
    );
    expect(folderKey("/repo/src/features/loans/utils/calc.ts")).toBe(
      "features/loans"
    );
    expect(folderKey("/repo/src/components/ui/button.tsx")).toBe(
      "components/ui"
    );
    expect(folderKey("/repo/src/main.tsx")).toBe("src");
  });

  it("filters external hook nodes while keeping internal edges", () => {
    const withExternal: AtlasGraph = {
      nodes: [
        { id: "a", name: "App", file: "src/App.tsx", type: "component" },
        { id: "b", name: "Card", file: "src/Card.tsx", type: "component" },
        { id: "external::useState", name: "useState", file: "external", type: "hook" },
      ],
      edges: [
        { from: "a", to: "b", type: "renders" },
        { from: "a", to: "external::useState", type: "uses" },
      ],
    };

    const filtered = filterExternalNodes(withExternal, false);
    expect(filtered.nodes.map((n) => n.id)).toEqual(["a", "b"]);
    expect(filtered.edges).toEqual([{ from: "a", to: "b", type: "renders" }]);
    expect(filterExternalNodes(withExternal, true).nodes).toHaveLength(3);
  });

  it("builds a semantic domain drilldown with 1-hop neighbor cluster stubs", () => {
    const multiDomain: AtlasGraph = {
      nodes: [
        { id: "auth1", name: "LoginForm", file: "/repo/src/features/auth/components/LoginForm.tsx", type: "component" },
        { id: "auth2", name: "useAuth", file: "/repo/src/features/auth/hooks/useAuth.ts", type: "hook" },
        { id: "btn", name: "Button", file: "/repo/src/components/ui/button.tsx", type: "component" },
        { id: "loan", name: "LoanPage", file: "/repo/src/features/loans/routes/LoanPage.tsx", type: "component" },
      ],
      edges: [
        { from: "auth1", to: "auth2", type: "uses" },
        { from: "auth1", to: "btn", type: "renders" },
        { from: "loan", to: "btn", type: "renders" },
      ],
    };

    const drilldown = buildDomainDrilldownGraph(multiDomain, "features/auth");
    const ids = drilldown.nodes.map((n) => n.id);
    expect(ids).toContain("auth1");
    expect(ids).toContain("auth2");
    expect(ids).toContain(clusterNodeId("components/ui"));
    expect(ids).not.toContain("loan");
    expect(ids).not.toContain(clusterNodeId("features/loans"));
  });

  it("sub-clusters support subfolders inside large domains and expands on demand", () => {
    expect(
      subclusterKeyWithinDomain(
        "/repo/src/features/loans/utils/calc.ts",
        "features/loans"
      )
    ).toBe("features/loans/utils");
    expect(
      subclusterKeyWithinDomain(
        "/repo/src/features/loans/components/LoanCard.tsx",
        "features/loans"
      )
    ).toBeNull();

    const nodes = Array.from({ length: 12 }, (_, idx) => ({
      id: `comp-${idx}`,
      name: `LoanComp${idx}`,
      file: `/repo/src/features/loans/components/LoanComp${idx}.tsx`,
      type: "component" as const,
    }));
    nodes.push(
      {
        id: "u1",
        name: "calcInterest",
        file: "/repo/src/features/loans/utils/calcInterest.ts",
        type: "utility",
      },
      {
        id: "u2",
        name: "formatAmount",
        file: "/repo/src/features/loans/utils/formatAmount.ts",
        type: "utility",
      },
      {
        id: "a1",
        name: "fetchLoans",
        file: "/repo/src/features/loans/api/fetchLoans.ts",
        type: "utility",
      },
      {
        id: "a2",
        name: "submitLoan",
        file: "/repo/src/features/loans/api/submitLoan.ts",
        type: "utility",
      }
    );

    const largeDomainGraph: AtlasGraph = {
      nodes,
      edges: [
        { from: "comp-0", to: "u1", type: "imports" },
        { from: "comp-0", to: "a1", type: "imports" },
      ],
    };

    const collapsed = buildDomainDrilldownGraph(
      largeDomainGraph,
      "features/loans"
    );
    const collapsedIds = collapsed.nodes.map((n) => n.id);
    expect(collapsedIds).toContain("comp-0");
    expect(collapsedIds).toContain(clusterNodeId("features/loans/utils"));
    expect(collapsedIds).toContain(clusterNodeId("features/loans/api"));
    expect(collapsedIds).not.toContain("u1");
    expect(collapsedIds).not.toContain("a1");

    const expanded = buildDomainDrilldownGraph(
      largeDomainGraph,
      "features/loans",
      new Set(["features/loans/utils"])
    );
    const expandedIds = expanded.nodes.map((n) => n.id);
    expect(expandedIds).toContain("u1");
    expect(expandedIds).toContain("u2");
    expect(expandedIds).toContain(clusterNodeId("features/loans/api"));
  });

  it("finds exact bridge symbols and required support subfolders on directed domain switch", () => {
    const bridgeGraph: AtlasGraph = {
      nodes: [
        {
          id: "app",
          name: "App",
          file: "/repo/src/app/App.tsx",
          type: "component",
        },
        {
          id: "toaster",
          name: "Toaster",
          file: "/repo/src/components/ui/toaster.tsx",
          type: "component",
        },
        {
          id: "dropdown",
          name: "DropdownMenu",
          file: "/repo/src/components/ui/dropdown-menu.tsx",
          type: "component",
        },
        {
          id: "loanApi",
          name: "fetchLoans",
          file: "/repo/src/features/loans/api/fetchLoans.ts",
          type: "utility",
        },
      ],
      edges: [
        { from: "app", to: "toaster", type: "renders" },
        { from: "app", to: "loanApi", type: "imports" },
      ],
    };

    const toUi = findDomainBridgeNodes(
      bridgeGraph,
      "src/app",
      "components/ui"
    );
    expect(toUi.targetNodeIds).toEqual(["toaster"]);
    expect(toUi.requiredSubfolders).toEqual([]);
    expect(toUi.originClusterId).toBe(clusterNodeId("src/app"));

    const toLoans = findDomainBridgeNodes(
      bridgeGraph,
      "src/app",
      "features/loans"
    );
    expect(toLoans.targetNodeIds).toEqual(["loanApi"]);
    expect(toLoans.requiredSubfolders).toEqual(["features/loans/api"]);
  });
});
