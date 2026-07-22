import path from "node:path";
import pc from "picocolors";
import type { AnalysisResult } from "./analyzeProject";
import { findNodesByName } from "./enrichGraph";
import type { GraphConnection, GraphNode } from "./types";

export type FocusOptions = {
  color?: boolean;
};

function relFile(filePath: string): string {
  if (filePath === "external") return "external";
  return path.relative(process.cwd(), filePath) || filePath;
}

function groupConnections(connections: GraphConnection[]) {
  return {
    imports: connections.filter((c) => c.edgeType === "imports"),
    renders: connections.filter((c) => c.edgeType === "renders"),
    uses: connections.filter((c) => c.edgeType === "uses"),
  };
}

function formatConnectionList(
  connections: GraphConnection[],
  colors: typeof pc,
): string[] {
  if (connections.length === 0) {
    return [`  ${colors.dim("none")}`];
  }

  return connections.map(
    (conn) =>
      `  ${colors.cyan(conn.name)} ${colors.dim(`(${conn.edgeType}, ${conn.file})`)}`,
  );
}

function formatNodeFocus(node: GraphNode, colors: typeof pc): string[] {
  const incoming = groupConnections(node.connections.incoming);
  const outgoing = groupConnections(node.connections.outgoing);
  const lines: string[] = [];

  lines.push(colors.bold(`Focus: ${node.name}`));
  lines.push(`${colors.dim("Type:")}       ${node.type}`);
  lines.push(`${colors.dim("File:")}       ${relFile(node.file)}`);
  if (node.exportKind) {
    lines.push(`${colors.dim("Export:")}     ${node.exportKind}`);
  }
  if (node.kind) {
    lines.push(`${colors.dim("AST kind:")}   ${node.kind}`);
  }
  lines.push(
    `${colors.dim("Usage:")}      ${node.stats.incoming} incoming, ${node.stats.outgoing} outgoing`,
  );
  lines.push("");

  lines.push(colors.bold("Imported by"));
  lines.push(...formatConnectionList(incoming.imports, colors));
  lines.push("");

  lines.push(colors.bold("Rendered by"));
  lines.push(...formatConnectionList(incoming.renders, colors));
  lines.push("");

  lines.push(colors.bold("Hook-used by"));
  lines.push(...formatConnectionList(incoming.uses, colors));
  lines.push("");

  lines.push(colors.bold("Imports"));
  lines.push(...formatConnectionList(outgoing.imports, colors));
  lines.push("");

  lines.push(colors.bold("Renders"));
  lines.push(...formatConnectionList(outgoing.renders, colors));
  lines.push("");

  lines.push(colors.bold("Uses hooks"));
  lines.push(...formatConnectionList(outgoing.uses, colors));

  return lines;
}

export function formatFocusReport(
  result: AnalysisResult,
  focusName: string,
  options: FocusOptions = {},
): string {
  const colors = options.color === false ? new Proxy(pc, { get: () => (v: string) => v }) : pc;
  const matches = findNodesByName(result.graph, focusName);

  if (matches.length === 0) {
    const known = result.graph.nodes
      .map((node) => node.name)
      .sort()
      .join(", ");
    return [
      colors.red(`No node named "${focusName}" found.`),
      colors.dim("Known nodes:"),
      `  ${known || colors.dim("(none)")}`,
    ].join("\n");
  }

  const sections = matches.map((node, index) => {
    if (matches.length > 1 && index > 0) {
      return ["", colors.dim("─".repeat(40)), "", ...formatNodeFocus(node, colors)].join("\n");
    }
    return formatNodeFocus(node, colors).join("\n");
  });

  if (matches.length > 1) {
    sections.unshift(
      colors.yellow(
        `Found ${matches.length} nodes named "${focusName}". Showing each match:`,
      ),
      "",
    );
  }

  return sections.join("\n");
}

export function printFocusReport(
  result: AnalysisResult,
  focusName: string,
  options: FocusOptions = {},
): void {
  console.log(formatFocusReport(result, focusName, options));
  console.log("");
}
