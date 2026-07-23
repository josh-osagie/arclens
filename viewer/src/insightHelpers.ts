import type { GraphInsight } from "./types";

export type InsightSeverity = GraphInsight["severity"];

export type InsightSeverityCounts = Record<InsightSeverity, number>;

export function countInsightsBySeverity(insights: GraphInsight[]): InsightSeverityCounts {
  return insights.reduce(
    (counts, insight) => {
      counts[insight.severity] += 1;
      return counts;
    },
    { error: 0, warning: 0, info: 0, tip: 0 },
  );
}

export type InsightBadgeTone = "error" | "warning" | "muted" | "clean";

export type InsightBadgeSummary = {
  tone: InsightBadgeTone;
  label: string;
  alertCount: number;
  totalCount: number;
};

/** Returns null when there are no insights (badge should stay hidden). */
export function insightBadgeSummary(insights: GraphInsight[]): InsightBadgeSummary | null {
  if (insights.length === 0) return null;

  const counts = countInsightsBySeverity(insights);
  const alertCount = counts.error + counts.warning;

  if (counts.error > 0) {
    return {
      tone: "error",
      label: `⚠ ${alertCount}`,
      alertCount,
      totalCount: insights.length,
    };
  }

  if (counts.warning > 0) {
    return {
      tone: "warning",
      label: `⚠ ${alertCount}`,
      alertCount,
      totalCount: insights.length,
    };
  }

  return {
    tone: "clean",
    label: "✓",
    alertCount: 0,
    totalCount: insights.length,
  };
}
