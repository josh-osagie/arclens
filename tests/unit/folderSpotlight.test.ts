import { describe, expect, it } from "vitest";
import {
  computeFolderMemberIds,
  computeFolderSpotlightIds,
  shouldDimForSpotlight,
} from "../../viewer/src/folderSpotlight";
import type { AtlasGraphNode } from "../../viewer/src/types";

const nodes: AtlasGraphNode[] = [
  { id: "a", name: "A", file: "src/components/ui/A.tsx", type: "component" },
  { id: "b", name: "B", file: "src/components/ui/B.tsx", type: "component" },
  { id: "c", name: "C", file: "src/hooks/useC.ts", type: "hook" },
];

describe("folderSpotlight", () => {
  it("collects member ids by folderKey", () => {
    expect(computeFolderMemberIds("components/ui", nodes)).toEqual(
      new Set(["a", "b"])
    );
    expect(computeFolderMemberIds("src/hooks", nodes)).toEqual(new Set(["c"]));
  });

  it("spotlights visible members and cluster bubble", () => {
    const visible: AtlasGraphNode[] = [
      {
        id: "a",
        name: "A",
        file: "src/components/ui/A.tsx",
        type: "component",
      },
      {
        id: "cluster::components/ui",
        name: "ui",
        file: "components/ui",
        type: "utility",
        cluster: { folder: "components/ui", count: 1 },
      },
      { id: "c", name: "C", file: "src/hooks/useC.ts", type: "hook" },
    ];

    expect(computeFolderSpotlightIds("components/ui", nodes, visible)).toEqual(
      new Set(["a", "cluster::components/ui"])
    );
  });

  it("reports when dimming should be active", () => {
    expect(shouldDimForSpotlight(null)).toBe(false);
    expect(shouldDimForSpotlight("components/ui")).toBe(true);
  });
});
