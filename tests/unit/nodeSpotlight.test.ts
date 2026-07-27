import { describe, expect, it } from "vitest";
import {
  computeNodeSpotlightIds,
  shouldDimForNodeSpotlight,
} from "../../viewer/src/nodeSpotlight";
import type { AtlasGraph, AtlasGraphNode } from "../../viewer/src/types";

const nodes: AtlasGraphNode[] = [
  { id: "a", name: "A", file: "src/components/ui/A.tsx", type: "component" },
  { id: "b", name: "B", file: "src/components/ui/B.tsx", type: "component" },
  { id: "c", name: "C", file: "src/hooks/useC.ts", type: "hook" },
];

const edges: AtlasGraph["edges"] = [
  { from: "a", to: "b", type: "renders" },
  { from: "c", to: "a", type: "imports" },
];

describe("nodeSpotlight", () => {
  it("spotlights the target and visible neighborhood", () => {
    const visible: AtlasGraphNode[] = [
      { id: "a", name: "A", file: "src/components/ui/A.tsx", type: "component" },
      { id: "b", name: "B", file: "src/components/ui/B.tsx", type: "component" },
      {
        id: "cluster::src/hooks",
        name: "hooks",
        file: "src/hooks",
        type: "utility",
        cluster: { folder: "src/hooks", count: 1 },
      },
    ];

    expect(computeNodeSpotlightIds("a", nodes, visible, edges)).toEqual(
      new Set(["a", "b"]),
    );
  });

  it("falls back to the folder cluster bubble when the node is collapsed", () => {
    const visible: AtlasGraphNode[] = [
      {
        id: "cluster::components/ui",
        name: "ui",
        file: "components/ui",
        type: "utility",
        cluster: { folder: "components/ui", count: 2 },
      },
    ];

    expect(computeNodeSpotlightIds("a", nodes, visible, edges)).toEqual(
      new Set(["cluster::components/ui"]),
    );
  });

  it("reports when dimming should be active", () => {
    expect(shouldDimForNodeSpotlight(null)).toBe(false);
    expect(shouldDimForNodeSpotlight("a")).toBe(true);
  });
});
