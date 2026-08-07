import { describe, expect, it } from "vitest";
import {
  countInsightsBySeverity,
  insightBadgeSummary,
} from "../../viewer/src/insightHelpers";
import type { GraphInsight } from "../../viewer/src/types";

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

    it("shows a clean check when only info and tips remain", () => {
      const summary = insightBadgeSummary([insight("info"), insight("tip")]);

      expect(summary).toEqual({
        tone: "clean",
        label: "✓",
        alertCount: 0,
        totalCount: 2,
      });
    });
  });
});
