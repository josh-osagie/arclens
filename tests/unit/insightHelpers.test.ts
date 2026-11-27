import { describe, expect, it } from "vitest";
import {
  categorizeInsight,
  countInsightsBySeverity,
  findNodeForInsight,
  insightBadgeSummary,
} from "../../viewer/src/insightHelpers";
import type { AtlasGraphNode, GraphInsight } from "../../viewer/src/types";

const insight = (
  severity: GraphInsight["severity"],
  title = "Test"
): GraphInsight => ({
  severity,
  title,
  detail: "detail",
});

describe("insightHelpers", () => {
  describe("countInsightsBySeverity", () => {
    it("counts each severity bucket", () => {
      const counts = countInsightsBySeverity([
        insight("error", "e1"),
        insight("error", "e2"),
        insight("warning", "w1"),
        insight("info", "i1"),
        insight("tip", "t1"),
      ]);

      expect(counts).toEqual({ error: 2, warning: 1, info: 1, tip: 1 });
    });

    it("returns zeros for an empty list", () => {
      expect(countInsightsBySeverity([])).toEqual({
        error: 0,
        warning: 0,
        info: 0,
        tip: 0,
      });
    });
  });

  describe("insightBadgeSummary", () => {
    it("returns null when there are no insights", () => {
      expect(insightBadgeSummary([])).toBeNull();
    });

    it("prioritizes error tone and sums alerts", () => {
      const summary = insightBadgeSummary([
        insight("error"),
        insight("warning"),
        insight("info"),
      ]);

      expect(summary).toEqual({
        tone: "error",
        label: "⚠ 2",
        alertCount: 2,
        totalCount: 3,
      });
    });

    it("uses warning tone when only warnings are present", () => {
      const summary = insightBadgeSummary([
        insight("warning"),
        insight("warning"),
      ]);

      expect(summary).toEqual({
        tone: "warning",
        label: "⚠ 2",
        alertCount: 2,
        totalCount: 2,
      });
    });

    it("uses muted info count when only info and tips remain", () => {
      const summary = insightBadgeSummary([insight("info"), insight("tip")]);

      expect(summary).toEqual({
        tone: "muted",
        label: "ℹ 2",
        alertCount: 0,
        totalCount: 2,
      });
    });
  });

  describe("categorizeInsight & findNodeForInsight", () => {
    it("categorizes insights into expected buckets", () => {
      expect(categorizeInsight(insight("error", "Rules of Hooks: useState called conditionally"))).toBe("hooks");
      expect(categorizeInsight(insight("warning", "Component naming: card"))).toBe("naming");
      expect(categorizeInsight(insight("info", "Orphan export: LegacyHelper"))).toBe("unused");
      expect(categorizeInsight(insight("info", "App imports but may not render Modal"))).toBe("imports");
      expect(categorizeInsight(insight("tip", "Medium-sized codebase"))).toBe("other");
    });

    it("resolves the graph node matching an insight symbol and file", () => {
      const nodes: AtlasGraphNode[] = [
        {
          id: "C:/repo/src/utils/legacy.ts::LegacyHelper",
          name: "LegacyHelper",
          file: "C:/repo/src/utils/legacy.ts",
          type: "utility",
        },
        {
          id: "C:/repo/src/other.ts::LegacyHelper",
          name: "LegacyHelper",
          file: "C:/repo/src/other.ts",
          type: "utility",
        },
      ];

      const matched = findNodeForInsight(
        {
          severity: "info",
          title: "Orphan export: LegacyHelper",
          detail: "unused",
          file: "src/utils/legacy.ts",
        },
        nodes
      );

      expect(matched?.id).toBe("C:/repo/src/utils/legacy.ts::LegacyHelper");
    });
  });
});
