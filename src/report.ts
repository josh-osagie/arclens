import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import type { AnalysisResult, ImportEdge } from "./analyzeProject";
import {
  buildInsights,
  countInsightsBySeverity,
  exportsByKind,
  nodeNameFromId,
  type Insight,
} from "./insights";
import type { GraphEdge, GraphNode, Graph } from "./types";
import { FILE_COUNT_SLOW, FILE_COUNT_WARNING, formatDuration } from "./discoverFiles";

export type ReportOptions = {
  verbose?: boolean;
  insights?: boolean;
  quiet?: boolean;
  color?: boolean;
  graphOutput?: string | null;
  reportOutput?: string | null;
};

export type ReportFormat = "text" | "json";

export type JsonReport = {
  meta: {
    targetDir: string;
    projectName: string;
    fileCount: number;
    durationMs: number;
    tsConfigPath: string | null;
    graphOutput: string | null;
    reportOutput: string | null;
  };
  summary: {
    nodes: number;
    edges: number;
    exports: number;
  };
  nodesByType: Record<
    NodeType,
    {
      count: number;
      names: string[];
    }
  >;
  relationships: Record<GraphEdge["type"], number>;
  externalLibraries: string[];
  topConnections: Array<{
    from: string;
    to: string;
    types: string[];
  }>;
  mostReferenced: Array<{
    name: string;
    incoming: number;
  }>;
  insights: {
    counts: ReturnType<typeof countInsightsBySeverity>;
    items: Insight[];
  };
  verbose?: {
    exportKinds: Record<string, number>;
    scannedFiles: string[];
  };
  graph: Graph;
};

function relPath(filePath: string): string {
  return path.relative(process.cwd(), filePath) || filePath;
}

export function getReportFormat(reportFilePath: string): ReportFormat {
  return path.extname(reportFilePath).toLowerCase() === ".json" ? "json" : "text";
}

type NodeType = GraphNode["type"];

function createColors(enabled: boolean) {
  if (!enabled) {
    return new Proxy(pc, { get: () => (value: string) => value });
  }
  return pc;
}

function countNodesByType(nodes: GraphNode[]): Record<NodeType, number> {
  return nodes.reduce(
    (counts, node) => {
      counts[node.type] += 1;
      return counts;
    },
    { component: 0, hook: 0, utility: 0, context: 0, entry: 0, config: 0 },
  );
}

function countEdgesByType(edges: GraphEdge[]): Record<GraphEdge["type"], number> {
  return edges.reduce(
    (counts, edge) => {
      counts[edge.type] += 1;
      return counts;
    },
    { imports: 0, renders: 0, uses: 0 },
  );
}

function getExternalLibs(importEdges: ImportEdge[]): string[] {
  const libs = new Set<string>();

  for (const edge of importEdges) {
    const specifier = edge.to ?? "";
    const isRelative = specifier.startsWith(".") || specifier.startsWith("/");
    const isNodeBuiltin = specifier.startsWith("node:");

    if (isRelative || isNodeBuiltin || !specifier) continue;
    libs.add(specifier);
  }

  return [...libs].sort();
}

function getTopConnections(edges: GraphEdge[], limit = 5) {
  const grouped = new Map<string, { from: string; to: string; types: Set<string> }>();

  for (const edge of edges) {
    const key = `${edge.from}->${edge.to}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.types.add(edge.type);
      continue;
    }

    grouped.set(key, {
      from: nodeNameFromId(edge.from),
      to: nodeNameFromId(edge.to),
      types: new Set([edge.type]),
    });
  }

  return [...grouped.values()]
    .sort((a, b) => b.types.size - a.types.size)
    .slice(0, limit);
}

function getMostUsedNodes(edges: GraphEdge[], limit = 5) {
  const incoming = new Map<string, number>();

  for (const edge of edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }

  return [...incoming.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, count]) => ({ name: nodeNameFromId(id), count }));
}

function formatNodeList(nodes: GraphNode[], type: NodeType): string {
  const names = nodes.filter((n) => n.type === type).map((n) => n.name);
  return names.length > 0 ? names.join(", ") : "(none)";
}

function severityColor(
  colors: typeof pc,
  severity: Insight["severity"],
): (text: string) => string {
  switch (severity) {
    case "error":
      return colors.red;
    case "warning":
      return colors.yellow;
    case "info":
      return colors.cyan;
    default:
      return colors.dim;
  }
}

function formatInsight(insight: Insight, colors: typeof pc): string {
  const paint = severityColor(colors, insight.severity);
  const rule = insight.eslintRule
    ? colors.dim(` (see: ${insight.eslintRule})`)
    : "";
  const location = insight.file
    ? colors.dim(
        `  at ${insight.file}${insight.line !== undefined ? `:${insight.line}` : ""}`,
      )
    : null;

  return [
    `  ${paint(`[${insight.severity}]`)} ${insight.title}`,
    `    ${colors.dim(insight.detail)}${rule}`,
    ...(location ? [location] : []),
  ].join("\n");
}

export function formatReport(
  result: AnalysisResult,
  options: ReportOptions = {},
): string {
  const colors = createColors(options.color !== false);
  const lines: string[] = [];

  const { graph, importEdges, targetDir, fileCount, tsConfigPath, durationMs } =
    result;
  const nodeCounts = countNodesByType(graph.nodes);
  const edgeCounts = countEdgesByType(graph.edges);
  const externalLibs = getExternalLibs(importEdges);
  const topConnections = getTopConnections(graph.edges);
  const mostUsed = getMostUsedNodes(graph.edges);
  const kindCounts = exportsByKind(result.exports);
  const insights = options.insights ? buildInsights(result) : [];
  const insightCounts = countInsightsBySeverity(insights);

  const relTarget = path.relative(process.cwd(), targetDir) || ".";
  const projectName = graph.meta?.projectName ?? path.basename(targetDir);
  const totalNodes = graph.nodes.length;
  const totalEdges = graph.edges.length;
  const projectExports = graph.nodes.filter((node) => node.file !== "external").length;

  if (!options.quiet) {
    lines.push("");
    lines.push(`${colors.bold(colors.cyan("Arclens"))}`);
    lines.push(colors.dim("=".repeat(40)));
    lines.push(`${colors.dim("Project:")}   ${colors.white(projectName)}`);
    lines.push(`${colors.dim("Target:")}     ${colors.white(relTarget)}`);
    lines.push(
      `${colors.dim("Files:")}      ${colors.white(String(fileCount))} TypeScript sources`,
    );
    lines.push(
      `${colors.dim("Duration:")}   ${colors.white(formatDuration(durationMs))}`,
    );
    lines.push(
      `${colors.dim("Tsconfig:")}   ${colors.white(tsConfigPath ? path.relative(process.cwd(), tsConfigPath) : "not found")}`,
    );
    if (options.graphOutput) {
      lines.push(
        `${colors.dim("Graph:")}      ${colors.green(path.relative(process.cwd(), options.graphOutput) || options.graphOutput)}`,
      );
    }
    if (options.reportOutput) {
      lines.push(
        `${colors.dim("Report:")}    ${colors.green(path.relative(process.cwd(), options.reportOutput) || options.reportOutput)}`,
      );
    }
    if (!options.graphOutput && !options.reportOutput) {
      lines.push(`${colors.dim("Output:")}     ${colors.dim("(none)")}`);
    }
    lines.push("");
    lines.push(colors.bold("Summary"));
    lines.push(
      `${colors.dim("Nodes:")} ${totalNodes}  ${colors.dim("|")}  ${colors.dim("Edges:")} ${totalEdges}  ${colors.dim("|")}  ${colors.dim("Exports:")} ${projectExports}`,
    );

    if (!result.reactAssessment.isReactProject && result.reactAssessment.message) {
      lines.push("");
      lines.push(colors.yellow(result.reactAssessment.message));
    }

    lines.push("");
    lines.push(colors.bold("Nodes by type"));
    lines.push(
      `  ${colors.blue(String(nodeCounts.component))} ${colors.dim("component")}${nodeCounts.component === 1 ? "" : "s"}  (${formatNodeList(graph.nodes, "component")})`,
    );
    lines.push(
      `  ${colors.magenta(String(nodeCounts.hook))} ${colors.dim("hook")}${nodeCounts.hook === 1 ? "" : "s"}       (${formatNodeList(graph.nodes, "hook")})`,
    );
    lines.push(
      `  ${colors.green(String(nodeCounts.utility))} ${colors.dim("utilit")}${nodeCounts.utility === 1 ? "y   " : "ies "}    (${formatNodeList(graph.nodes, "utility")})`,
    );
    lines.push(
      `  ${colors.cyan(String(nodeCounts.entry))} ${colors.dim("entr")}${nodeCounts.entry === 1 ? "y   " : "ies "}      (${formatNodeList(graph.nodes, "entry")})`,
    );
    lines.push(
      `  ${colors.dim(String(nodeCounts.config))} ${colors.dim("config")}${nodeCounts.config === 1 ? "" : "s"}   (${formatNodeList(graph.nodes, "config")})`,
    );
    lines.push(
      `  ${colors.yellow(String(nodeCounts.context))} ${colors.dim("context")}${nodeCounts.context === 1 ? "" : "s"}  (${formatNodeList(graph.nodes, "context")})`,
    );
    lines.push("");
    lines.push(colors.bold("Relationships"));
    lines.push(
      `  ${colors.white(String(edgeCounts.imports))} ${colors.dim("imports")}`,
    );
    lines.push(
      `  ${colors.white(String(edgeCounts.renders))} ${colors.dim("renders")}`,
    );
    lines.push(
      `  ${colors.white(String(edgeCounts.uses))} ${colors.dim("hook uses")}`,
    );
    lines.push("");
    lines.push(colors.bold("External libraries"));
    if (externalLibs.length === 0) {
      lines.push(`  ${colors.dim("(none)")}`);
    } else {
      for (const lib of externalLibs) {
        lines.push(`  ${colors.yellow(lib)}`);
      }
    }
    lines.push("");
    lines.push(colors.bold("Top connections"));
    if (topConnections.length === 0) {
      lines.push(`  ${colors.dim("(none)")}`);
    } else {
      for (const connection of topConnections) {
        lines.push(
          `  ${colors.cyan(connection.from)} ${colors.dim("->")} ${colors.cyan(connection.to)}  ${colors.dim(`[${[...connection.types].join(", ")}]`)}`,
        );
      }
    }
    lines.push("");
    lines.push(colors.bold("Most referenced"));
    if (mostUsed.length === 0) {
      lines.push(`  ${colors.dim("(none)")}`);
    } else {
      for (const entry of mostUsed) {
        lines.push(
          `  ${colors.white(entry.name)}  ${colors.dim(`(${entry.count} incoming)`)}`,
        );
      }
    }

    if (fileCount >= FILE_COUNT_SLOW) {
      lines.push("");
      lines.push(
        colors.yellow(
          "Warning: Large scan - next time try a subfolder: pnpm arclens analyze ./src",
        ),
      );
    } else if (fileCount >= FILE_COUNT_WARNING) {
      lines.push("");
      lines.push(
        colors.dim("Tip: use --report-file out.txt or --report-file out.json to save results."),
      );
    }

    if (!options.insights && (insights.length > 0 || fileCount > 100)) {
      lines.push("");
      lines.push(
        colors.dim("Run with --insights for architecture suggestions and ESLint-style hints."),
      );
    }
  }

  if (options.insights && insights.length > 0) {
    lines.push("");
    lines.push(colors.bold("Insights"));
    lines.push(
      colors.dim(
        `  ${insightCounts.error} errors, ${insightCounts.warning} warnings, ${insightCounts.info} info, ${insightCounts.tip} tips`,
      ),
    );
    for (const insight of insights) {
      lines.push(formatInsight(insight, colors));
    }
  } else if (options.insights) {
    lines.push("");
    lines.push(colors.bold("Insights"));
    lines.push(`  ${colors.green("No issues detected.")}`);
  }

  if (options.verbose) {
    lines.push("");
    lines.push(colors.bold("Export kinds (verbose)"));
    for (const [kind, count] of Object.entries(kindCounts).sort()) {
      lines.push(`  ${colors.white(String(count))} ${colors.dim(kind)}`);
    }

    lines.push("");
    lines.push(colors.bold("Scanned files (verbose)"));
    for (const file of result.scannedFiles) {
      lines.push(`  ${colors.dim(path.relative(process.cwd(), file))}`);
    }
  }

  if (!options.quiet) {
    lines.push("");
    lines.push(colors.dim("Static analysis only - code is parsed, never executed."));
    lines.push("");
  }

  return lines.join("\n");
}

export function printReport(
  result: AnalysisResult,
  options: ReportOptions = {},
): void {
  const text = formatReport(result, options);

  if (options.quiet) {
    const written = options.reportOutput ?? options.graphOutput;
    if (written) {
      console.log(`Wrote ${path.relative(process.cwd(), written) || written}`);
    }
    return;
  }

  console.log(text);
}

export function buildJsonReport(
  result: AnalysisResult,
  options: ReportOptions = {},
): JsonReport {
  const { graph, importEdges, targetDir, fileCount, tsConfigPath, durationMs } =
    result;
  const nodeCounts = countNodesByType(graph.nodes);
  const edgeCounts = countEdgesByType(graph.edges);
  const insights = buildInsights(result);
  const insightCounts = countInsightsBySeverity(insights);
  const graphOutput = options.graphOutput
    ? relPath(options.graphOutput)
    : null;
  const reportOutput = options.reportOutput
    ? relPath(options.reportOutput)
    : null;

  const nodesByType = (
    ["component", "hook", "utility", "context", "entry", "config"] as const
  ).reduce(
    (acc, type) => {
      const names = graph.nodes.filter((node) => node.type === type).map((n) => n.name);
      acc[type] = { count: nodeCounts[type], names };
      return acc;
    },
    {} as JsonReport["nodesByType"],
  );

  const projectExports = graph.nodes.filter((node) => node.file !== "external").length;

  const report: JsonReport = {
    meta: {
      targetDir: relPath(targetDir),
      projectName: graph.meta?.projectName ?? path.basename(targetDir),
      fileCount,
      durationMs,
      tsConfigPath: tsConfigPath ? relPath(tsConfigPath) : null,
      graphOutput,
      reportOutput,
    },
    summary: {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      exports: projectExports,
    },
    nodesByType,
    relationships: edgeCounts,
    externalLibraries: getExternalLibs(importEdges),
    topConnections: getTopConnections(graph.edges).map((connection) => ({
      from: connection.from,
      to: connection.to,
      types: [...connection.types],
    })),
    mostReferenced: getMostUsedNodes(graph.edges).map((entry) => ({
      name: entry.name,
      incoming: entry.count,
    })),
    insights: {
      counts: insightCounts,
      items: insights,
    },
    graph,
  };

  if (options.verbose) {
    report.verbose = {
      exportKinds: exportsByKind(result.exports),
      scannedFiles: result.scannedFiles.map(relPath),
    };
  }

  return report;
}

export function writeReportFile(
  result: AnalysisResult,
  reportFilePath: string,
  options: ReportOptions,
): void {
  const fullOptions: ReportOptions = {
    ...options,
    verbose: true,
    insights: true,
    color: false,
    reportOutput: reportFilePath,
  };

  const format = getReportFormat(reportFilePath);

  if (format === "json") {
    fs.writeFileSync(
      reportFilePath,
      `${JSON.stringify(buildJsonReport(result, fullOptions), null, 2)}\n`,
    );
    return;
  }

  fs.writeFileSync(reportFilePath, formatReport(result, fullOptions));
}
