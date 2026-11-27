import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { AtlasNodeData } from "../../viewer/src/buildFlowGraph";
import { CLUSTER_NODE_W } from "../../viewer/src/layoutPresets";
import {
  classifyOverviewFolderTier,
  layoutTieredOverviewNodes,
  OVERVIEW_CLUSTER_H,
  OVERVIEW_MAX_COLS,
} from "../../viewer/src/layoutTieredOverview";

function clusterNode(folder: string, count: number): Node<AtlasNodeData> {
  const label = folder.split("/").pop() ?? folder;
  return {
    id: `cluster::${folder}`,
    type: "cluster",
    position: { x: 0, y: 0 },
    data: {
      label,
      folder,
      count,
      type: "utility",
      nodeId: `cluster::${folder}`,
    } as unknown as AtlasNodeData,
  };
}

describe("layoutTieredOverview", () => {
  it("classifies project folders into the 4 architectural tiers", () => {
    expect(classifyOverviewFolderTier("src")).toBe("entry");
    expect(classifyOverviewFolderTier("src/routing")).toBe("entry");
    expect(classifyOverviewFolderTier("features/loans")).toBe("feature");
    expect(classifyOverviewFolderTier("pages/dashboard")).toBe("feature");
    expect(classifyOverviewFolderTier("components/ui")).toBe("ui");
    expect(classifyOverviewFolderTier("src/assets")).toBe("ui");
    expect(classifyOverviewFolderTier("src/hooks")).toBe("core");
    expect(classifyOverviewFolderTier("src/utils")).toBe("core");
  });

  it("arranges 20 domains into 4 ordered tiers with <= 5 cards per row and zero overlap", () => {
    const domains = [
      clusterNode("src", 4),
      clusterNode("src/routing", 3),
      clusterNode("features/loans", 57),
      clusterNode("features/auth", 24),
      clusterNode("features/profile", 19),
      clusterNode("features/dashboard", 18),
      clusterNode("features/wallet", 15),
      clusterNode("features/kyc", 14),
      clusterNode("features/notifications", 9),
      clusterNode("features/settings", 8),
      clusterNode("components/ui", 73),
      clusterNode("components/shared", 16),
      clusterNode("components/layout", 11),
      clusterNode("src/assets", 6),
      clusterNode("src/hooks", 14),
      clusterNode("src/lib", 12),
      clusterNode("src/utils", 10),
      clusterNode("src/config", 5),
      clusterNode("src/constants", 4),
      clusterNode("src/services", 7),
    ];

    const laidOut = layoutTieredOverviewNodes(domains);
    const headers = laidOut.filter((n) => n.type === "tierHeader");
    const cards = laidOut.filter((n) => n.type === "cluster");

    expect(headers.map((h) => h.id)).toEqual([
      "tier-header::entry",
      "tier-header::feature",
      "tier-header::ui",
      "tier-header::core",
    ]);
    expect(cards).toHaveLength(20);

    // Verify top-to-bottom tier ordering
    for (let i = 1; i < headers.length; i++) {
      expect(headers[i]!.position.y).toBeGreaterThan(
        headers[i - 1]!.position.y
      );
    }

    // Verify max cards per horizontal row <= OVERVIEW_MAX_COLS
    const byRowY = new Map<number, Node<AtlasNodeData>[]>();
    for (const card of cards) {
      const list = byRowY.get(card.position.y) ?? [];
      list.push(card);
      byRowY.set(card.position.y, list);
    }
    for (const [, rowCards] of byRowY) {
      expect(rowCards.length).toBeLessThanOrEqual(OVERVIEW_MAX_COLS);
    }

    // Verify zero AABB overlap among all cards
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i]!;
        const b = cards[j]!;
        const overlapX =
          a.position.x < b.position.x + CLUSTER_NODE_W &&
          a.position.x + CLUSTER_NODE_W > b.position.x;
        const overlapY =
          a.position.y < b.position.y + OVERVIEW_CLUSTER_H &&
          a.position.y + OVERVIEW_CLUSTER_H > b.position.y;
        expect(overlapX && overlapY).toBe(false);
      }
    }
  });
});
