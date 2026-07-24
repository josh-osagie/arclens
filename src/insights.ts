import path from "node:path";
import type { ExportRecord } from "./extractors/exports";
import type { AnalysisResult } from "./analyzeProject";
import type { GraphEdge, GraphNode } from "./types";
import { isConfigFile } from "./extractors/reactFunction";

export type InsightSeverity = "error" | "warning" | "info" | "tip";

export type Insight = {
  severity: InsightSeverity;
  title: string;
  detail: string;
  file?: string;
  line?: number;
  eslintRule?: string;
};

function relFile(filePath: string): string {
  return path.relative(process.cwd(), filePath) || filePath;
}

function nodeNameFromId(id: string): string {
  const parts = id.split("::");
  return parts.length > 1 ? parts[parts.length - 1] : id;
}

function getIncomingEdgeCount(edges: GraphEdge[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const edge of edges) {
    counts.set(edge.to, (counts.get(edge.to) ?? 0) + 1);
  }

  return counts;
}

function getOutgoingImportTargets(
  edges: GraphEdge[],
  fromId: string,
): Set<string> {
  const targets = new Set<string>();

  for (const edge of edges) {
    if (edge.from === fromId && edge.type === "imports") {
      targets.add(edge.to);
    }
  }

  return targets;
}

function getOutgoingRenderTargets(
  edges: GraphEdge[],
  fromId: string,
): Set<string> {
  const targets = new Set<string>();

  for (const edge of edges) {
    if (edge.from === fromId && edge.type === "renders") {
      targets.add(edge.to);
    }
  }

  return targets;
}

export function buildInsights(result: AnalysisResult): Insight[] {
  const insights: Insight[] = [];
  const { graph, exports, importEdges, fileCount, tsConfigPath, targetDir } =
    result;

  const incoming = getIncomingEdgeCount(graph.edges);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  if (!tsConfigPath) {
    insights.push({
      severity: "warning",
      title: "No tsconfig.json found",
      detail:
        "Module resolution may be incomplete. Add a tsconfig near your source root.",
      file: relFile(targetDir),
    });
  }

  if (fileCount >= 800) {
    insights.push({
      severity: "tip",
      title: "Large codebase detected",
      detail: `Scanned ${fileCount} files. Prefer analyzing a subfolder (e.g. ./src) instead of the repo root.`,
      file: relFile(targetDir),
    });
  } else if (fileCount >= 300) {
    insights.push({
      severity: "tip",
      title: "Medium-sized codebase",
      detail:
        "Consider `--report-file report.txt` for a saved copy and `--max-files` as a safety guard.",
      file: relFile(targetDir),
    });
  }

  for (const node of graph.nodes) {
    if (node.file === "external" || isConfigFile(node.file)) continue;

    const incomingCount = incoming.get(node.id) ?? 0;
    if (incomingCount === 0) {
      const hasOutgoing = graph.edges.some((edge) => edge.from === node.id);
      if (hasOutgoing) continue;

      insights.push({
        severity: "info",
        title: `Orphan export: ${node.name}`,
        detail: `${node.type} is exported but nothing in the graph imports or uses it.`,
        file: relFile(node.file),
        eslintRule: "import/no-unused-modules",
      });
    }
  }

  for (const node of graph.nodes) {
    if (node.type !== "component") continue;

    const imports = getOutgoingImportTargets(graph.edges, node.id);
    const renders = getOutgoingRenderTargets(graph.edges, node.id);

    for (const targetId of imports) {
      const target = nodeById.get(targetId);
      if (target?.type !== "component") continue;
      if (!renders.has(targetId)) {
        insights.push({
          severity: "info",
          title: `${nodeNameFromId(node.id)} imports but may not render ${nodeNameFromId(targetId)}`,
          detail:
            "Component is imported but no JSX render edge was detected. Could be dynamic, conditional, or re-exported.",
          file: relFile(node.file),
        });
      }
    }
  }

  for (const exp of exports.filter((e) => e.type === "component" && !isConfigFile(e.file))) {
    if (!/^[A-Z]/.test(exp.name)) {
      insights.push({
        severity: "warning",
        title: `Component naming: ${exp.name}`,
        detail:
          "React components should use PascalCase (e.g. Counter) so JSX can distinguish them from HTML elements.",
        file: relFile(exp.file),
        eslintRule: "@eslint-react/no-missing-component-display-name",
      });
    }
  }

  for (const hook of exports.filter((e) => e.type === "hook")) {
    if (!/^use[A-Z]/.test(hook.name)) {
      insights.push({
        severity: "warning",
        title: `Hook naming: ${hook.name}`,
        detail:
          'Custom hooks should start with "use" so callers know Hook rules apply.',
        file: relFile(hook.file),
        eslintRule: "@eslint-react/rules-of-hooks",
      });
    }
  }

  for (const edge of importEdges) {
    if (
      edge.to === "react" &&
      edge.isTypeOnly &&
      !edge.defaultImport &&
      edge.namedImports.length === 0
    ) {
      insights.push({
        severity: "tip",
        title: "Type-only React import",
        detail: "No runtime React import needed for types - good for bundle size.",
        file: relFile(edge.from),
        line: edge.line,
        eslintRule: "@typescript-eslint/consistent-type-imports",
      });
    }
  }

  for (const violation of result.hookRuleViolations) {
    insights.push({
      severity: "error",
      title: `Rules of Hooks: ${violation.hook} called ${violation.context}`,
      detail:
        "Hooks must run in the same order on every render - never inside conditions, loops, nested functions, or after early returns.",
      file: relFile(violation.file),
      line: violation.line,
      eslintRule: violation.eslintRule,
    });
  }

  if (targetDir.endsWith("node_modules")) {
    insights.push({
      severity: "error",
      title: "Analyzing node_modules",
      detail: "Never analyze dependency folders. Point at your app source instead.",
      file: relFile(targetDir),
    });
  }

  return insights;
}

export function countInsightsBySeverity(
  insights: Insight[],
): Record<InsightSeverity, number> {
  return insights.reduce(
    (counts, insight) => {
      counts[insight.severity] += 1;
      return counts;
    },
    { error: 0, warning: 0, info: 0, tip: 0 },
  );
}

export function exportsByKind(exports: ExportRecord[]): Record<string, number> {
  return exports.reduce<Record<string, number>>((counts, item) => {
    const kind = item.kind ?? "Unknown";
    counts[kind] = (counts[kind] ?? 0) + 1;
    return counts;
  }, {});
}

export { nodeNameFromId };
