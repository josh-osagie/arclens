import type { AtlasGraphNode, GraphInsight } from "./types";

export type InsightSeverity = GraphInsight["severity"];

export type InsightSeverityCounts = Record<InsightSeverity, number>;

export type InsightCategory =
  | "hooks"
  | "naming"
  | "unused"
  | "imports"
  | "other";

export const INSIGHT_CATEGORY_LABELS: Record<InsightCategory, string> = {
  hooks: "Rules of Hooks",
  naming: "Naming",
  unused: "Unused exports",
  imports: "Imports",
  other: "Project",
};

export function categorizeInsight(insight: GraphInsight): InsightCategory {
  if (insight.title.startsWith("Rules of Hooks:")) return "hooks";
  if (
    insight.title.startsWith("Component naming:") ||
    insight.title.startsWith("Hook naming:")
  ) {
    return "naming";
  }
  if (insight.title.startsWith("Orphan export:")) return "unused";
  if (
    insight.title.includes("imports but may not render") ||
    insight.title.includes("Type-only React import")
  ) {
    return "imports";
  }
  return "other";
}

function extractSymbolFromInsight(title: string): string | null {
  const colonMatch = title.match(
    /^(?:Orphan export|Component naming|Hook naming):\s+(.+)$/
  );
  if (colonMatch?.[1]) return colonMatch[1].trim();

  const importRenderMatch = title.match(
    /^([^\s]+)\s+imports but may not render\s+/
  );
  if (importRenderMatch?.[1]) return importRenderMatch[1].trim();

  return null;
}

function normalizePathSlashes(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

/** Resolve the graph node associated with an insight for click-to-focus navigation. */
export function findNodeForInsight(
  insight: GraphInsight,
  nodes: AtlasGraphNode[]
): AtlasGraphNode | null {
  const projectNodes = nodes.filter(
    (node) => !node.cluster && node.file !== "external"
  );
  if (projectNodes.length === 0) return null;

  const symbolName = extractSymbolFromInsight(insight.title);
  const insightFile = insight.file ? normalizePathSlashes(insight.file) : null;

  if (insightFile) {
    const fileMatches = projectNodes.filter((node) => {
      const nodeFile = normalizePathSlashes(node.file);
      return (
        nodeFile === insightFile ||
        nodeFile.endsWith(`/${insightFile}`) ||
        insightFile.endsWith(`/${nodeFile}`)
      );
    });

    if (fileMatches.length > 0) {
      if (symbolName) {
        const exact = fileMatches.find((node) => node.name === symbolName);
        if (exact) return exact;
      }
      return fileMatches[0] ?? null;
    }
  }

  if (symbolName) {
    return projectNodes.find((node) => node.name === symbolName) ?? null;
  }

  return null;
}

export function countInsightsBySeverity(
  insights: GraphInsight[]
): InsightSeverityCounts {
  return insights.reduce(
    (counts, insight) => {
      counts[insight.severity] += 1;
      return counts;
    },
    { error: 0, warning: 0, info: 0, tip: 0 }
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
export function insightBadgeSummary(
  insights: GraphInsight[]
): InsightBadgeSummary | null {
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
    tone: "muted",
    label: `ℹ ${insights.length}`,
    alertCount: 0,
    totalCount: insights.length,
  };
}
