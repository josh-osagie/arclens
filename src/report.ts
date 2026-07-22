import path from "node:path";
import type { AnalysisResult, ImportEdge } from "./analyzeProject";
import type { Graph, GraphEdge, GraphNode } from "./types";

type NodeType = GraphNode["type"];

function countNodesByType(nodes: GraphNode[]): Record<NodeType, number> {
  return nodes.reduce(
    (counts, node) => {
      counts[node.type] += 1;
      return counts;
    },
    { component: 0, hook: 0, service: 0 },
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

function nodeNameFromId(id: string): string {
  const parts = id.split("::");
  return parts.length > 1 ? parts[parts.length - 1] : id;
}

function getTopConnections(edges: GraphEdge[], limit = 5) {
  const grouped = new Map<string, { from: string; to: string; types: Set<string> }>();

  for (const edge of edges) {
    const key = `${edge.from}→${edge.to}`;
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
  return names.length > 0 ? names.join(", ") : "—";
}

export function printReport(result: AnalysisResult, outputPath: string): void {
  const { graph, importEdges, targetDir, fileCount, tsConfigPath } = result;
  const nodeCounts = countNodesByType(graph.nodes);
  const edgeCounts = countEdgesByType(graph.edges);
  const externalLibs = getExternalLibs(importEdges);
  const topConnections = getTopConnections(graph.edges);
  const mostUsed = getMostUsedNodes(graph.edges);

  const relTarget = path.relative(process.cwd(), targetDir) || ".";
  const relOutput = path.relative(process.cwd(), outputPath) || outputPath;

  console.log("");
  console.log("React Atlas");
  console.log("===========");
  console.log(`Target:     ${relTarget}`);
  console.log(`Files:      ${fileCount} TypeScript sources`);
  console.log(
    `Tsconfig:   ${tsConfigPath ? path.relative(process.cwd(), tsConfigPath) : "not found (resolution may be limited)"}`,
  );
  console.log(`Output:     ${relOutput}`);
  console.log("");
  console.log("Nodes");
  console.log("-----");
  console.log(
    `  ${nodeCounts.component} component${nodeCounts.component === 1 ? "" : "s"}  (${formatNodeList(graph.nodes, "component")})`,
  );
  console.log(
    `  ${nodeCounts.hook} hook${nodeCounts.hook === 1 ? "" : "s"}       (${formatNodeList(graph.nodes, "hook")})`,
  );
  console.log(
    `  ${nodeCounts.service} service${nodeCounts.service === 1 ? "" : "s"}   (${formatNodeList(graph.nodes, "service")})`,
  );
  console.log("");
  console.log("Relationships");
  console.log("-------------");
  console.log(`  ${edgeCounts.imports} import${edgeCounts.imports === 1 ? "" : "s"}`);
  console.log(`  ${edgeCounts.renders} render${edgeCounts.renders === 1 ? "" : "s"}`);
  console.log(`  ${edgeCounts.uses} hook use${edgeCounts.uses === 1 ? "" : "s"}`);
  console.log("");
  console.log("External libraries");
  console.log("------------------");
  if (externalLibs.length === 0) {
    console.log("  —");
  } else {
    for (const lib of externalLibs) {
      console.log(`  ${lib}`);
    }
  }
  console.log("");
  console.log("Top connections");
  console.log("---------------");
  if (topConnections.length === 0) {
    console.log("  —");
  } else {
    for (const connection of topConnections) {
      console.log(
        `  ${connection.from} → ${connection.to}  [${[...connection.types].join(", ")}]`,
      );
    }
  }
  console.log("");
  console.log("Most referenced");
  console.log("---------------");
  if (mostUsed.length === 0) {
    console.log("  —");
  } else {
    for (const entry of mostUsed) {
      console.log(`  ${entry.name}  (${entry.count} incoming)`);
    }
  }
  console.log("");
  console.log("Note: static analysis only — code is parsed, never executed.");
  console.log("");
}
