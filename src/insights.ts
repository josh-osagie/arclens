import path from "node:path";
import type { ExportRecord } from "./extractors/exports";
import type { ImportEdge } from "./extractFileAnalysis";
import {
  findDefaultExportInFile,
  findExportByName,
  findExportInFile,
  nodeId,
} from "./extractors/find";
import type { AnalysisResult } from "./analyzeProject";
import {
  isKebabCaseSymbol,
  isLikelyStateExport,
  isTestOrHocUtility,
} from "./exportHeuristics";
import type { GraphEdge, GraphNode } from "./types";
import { isConfigFile, isCustomHookName, isPascalCase } from "./extractors/reactFunction";

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

function buildImportReferenceCounts(
  importEdges: ImportEdge[],
  exports: ExportRecord[],
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const imp of importEdges) {
    if (!imp.resolvedTo || imp.resolvedTo.includes("node_modules")) continue;

    const resolvedTargets: ExportRecord[] = [];

    if (imp.defaultImport) {
      const match =
        findDefaultExportInFile(exports, imp.resolvedTo) ??
        findExportInFile(exports, imp.resolvedTo, imp.defaultImport);
      if (match) resolvedTargets.push(match);
    }

    for (const symbol of imp.namedImports) {
      const match =
        findExportInFile(exports, imp.resolvedTo, symbol) ??
        findExportByName(exports, symbol);
      if (match) resolvedTargets.push(match);
    }

    for (const target of resolvedTargets) {
      const id = nodeId(target);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return counts;
}

function isRenderedAsJsx(targetId: string, edges: GraphEdge[]): boolean {
  return edges.some((edge) => edge.type === "renders" && edge.to === targetId);
}

function shouldFlagComponentNaming(
  exp: ExportRecord,
  edges: GraphEdge[],
  exports: ExportRecord[],
): boolean {
  if (exp.type !== "component" || isConfigFile(exp.file)) return false;
  if (/^[A-Z]/.test(exp.name)) return false;
  if (isCustomHookName(exp.name)) return false;
  if (isTestOrHocUtility(exp.name, exp.file)) return false;
  if (isKebabCaseSymbol(exp.name)) return false;

  if (isRenderedAsJsx(nodeId(exp), edges)) return true;

  const pascalAlias = exp.name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  const aliasExport = exports.find((other) => other.name === pascalAlias);
  return aliasExport ? isRenderedAsJsx(nodeId(aliasExport), edges) : false;
}

function shouldFlagHookNaming(hook: ExportRecord): boolean {
  if (hook.type !== "hook") return false;
  if (/^use[A-Z]/.test(hook.name)) return false;
  if (isPascalCase(hook.name)) return false;
  return true;
}

function isReExportStub(
  node: GraphNode,
  edges: GraphEdge[],
  importRefs: Map<string, number>,
  exports: ExportRecord[],
): boolean {
  const canonical = exports.filter(
    (exp) => exp.name === node.name && exp.file !== node.file,
  );
  return canonical.some((exp) => {
    const id = nodeId(exp);
    return edges.some((edge) => edge.to === id) || (importRefs.get(id) ?? 0) > 0;
  });
}

function shouldFlagOrphanExport(
  node: GraphNode,
  edges: GraphEdge[],
  importRefs: Map<string, number>,
  exports: ExportRecord[],
): boolean {
  if (node.file === "external" || isConfigFile(node.file)) return false;
  if (node.type === "entry" || node.type === "config") return false;
  if (isLikelyStateExport(node.name, node.file)) return false;
  if (isTestOrHocUtility(node.name, node.file)) return false;

  const graphIncoming = edges.filter((edge) => edge.to === node.id).length;
  const importIncoming = importRefs.get(node.id) ?? 0;
  if (graphIncoming > 0 || importIncoming > 0) return false;

  const hasOutgoing = edges.some((edge) => edge.from === node.id);
  if (hasOutgoing) return false;

  if (isReExportStub(node, edges, importRefs, exports)) return false;

  return true;
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

/**
 * Import-without-render insight gate (Layers 1 + 3):
 * - Layer 1: export must be classified as `component` (not utility/hook/context).
 * - Layer 2: render edges only come from PascalCase JSX tags.
 * - Layer 3: camelCase bindings (column defs, hooks, config) are never JSX tags,
 *   so we skip them even when classification is wrong — but correct classification
 *   at analyze time is what keeps false positives out of other insights too.
 */
function shouldFlagImportWithoutRender(target: GraphNode, symbolName: string): boolean {
  if (target.type !== "component") return false;
  return isPascalCase(symbolName);
}

export function buildInsights(result: AnalysisResult): Insight[] {
  const insights: Insight[] = [];
  const { graph, exports, importEdges, fileCount, tsConfigPath, targetDir } =
    result;

  const importRefs = buildImportReferenceCounts(importEdges, exports);
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
    if (!shouldFlagOrphanExport(node, graph.edges, importRefs, exports)) continue;

    insights.push({
      severity: "info",
      title: `Orphan export: ${node.name}`,
      detail: `${node.type} is exported but nothing in the graph imports or uses it.`,
      file: relFile(node.file),
      eslintRule: "import/no-unused-modules",
    });
  }

  for (const node of graph.nodes) {
    if (node.type !== "component") continue;

    const imports = getOutgoingImportTargets(graph.edges, node.id);
    const renders = getOutgoingRenderTargets(graph.edges, node.id);

    for (const targetId of imports) {
      const target = nodeById.get(targetId);
      if (!target) continue;

      const targetName = nodeNameFromId(targetId);
      if (!shouldFlagImportWithoutRender(target, targetName)) continue;

      if (!renders.has(targetId)) {
        insights.push({
          severity: "info",
          title: `${nodeNameFromId(node.id)} imports but may not render ${targetName}`,
          detail: `PascalCase component ${targetName} imported but no JSX render detected (may be dynamic/conditional). camelCase imports such as column defs, config, and hooks are ignored.`,
          file: relFile(node.file),
        });
      }
    }
  }

  for (const exp of exports) {
    if (!shouldFlagComponentNaming(exp, graph.edges, exports)) continue;

    insights.push({
      severity: "warning",
      title: `Component naming: ${exp.name}`,
      detail:
        "React components should use PascalCase (e.g. Counter) so JSX can distinguish them from HTML elements.",
      file: relFile(exp.file),
      eslintRule: "@eslint-react/no-missing-component-display-name",
    });
  }

  for (const hook of exports) {
    if (!shouldFlagHookNaming(hook)) continue;

    insights.push({
      severity: "warning",
      title: `Hook naming: ${hook.name}`,
      detail:
        'Custom hooks should start with "use" so callers know Hook rules apply.',
      file: relFile(hook.file),
      eslintRule: "@eslint-react/rules-of-hooks",
    });
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
