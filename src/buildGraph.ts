import type { Graph, GraphEdge, GraphNode } from "./types";
import {
  ExportRecord,
  extractHookUsage,
  extractImportEdges,
  extractJsxRenders,
} from "./extractors/exports";
import { findExportByFile, findExportByName, nodeId } from "./extractors/find";

export function buildGraph(
  importEdges: ReturnType<typeof extractImportEdges>,
  exports: ExportRecord[],
  renders: ReturnType<typeof extractJsxRenders>,
  uses: ReturnType<typeof extractHookUsage>,
): Graph {
  const nodes: GraphNode[] = exports.map((e) => ({
    id: `${e.file}::${e.name}`,
    name: e.name,
    file: e.file,
    type: e.type,
  }));

  const graphEdges: GraphEdge[] = [];

  for (const imp of importEdges) {
    const fromNode = findExportByFile(exports, imp.from);
    if (
      !fromNode ||
      !imp.resolvedTo ||
      imp.resolvedTo.includes("node_modules")
    ) {
      continue;
    }

    const symbols = [
      ...(imp.defaultImport ? [imp.defaultImport] : []),
      ...imp.namedImports,
    ];

    for (const symbol of symbols) {
      const toNode = findExportByName(exports, symbol);
      if (toNode) {
        graphEdges.push({
          from: nodeId(fromNode),
          to: nodeId(toNode),
          type: "imports",
        });
      }
    }
  }

  for (const render of renders) {
    const fromNode = findExportByFile(exports, render.file);
    const toNode = findExportByName(exports, render.renders);
    if (!fromNode || !toNode) continue;

    graphEdges.push({
      from: nodeId(fromNode),
      to: nodeId(toNode),
      type: "renders",
    });
  }

  for (const use of uses) {
    const fromNode = findExportByFile(exports, use.file);
    if (!fromNode) continue;

    if (!nodes.some((node) => node.id === use.uses)) {
      nodes.push({
        id: use.uses,
        name: use.uses,
        file: "external",
        type: "hook",
      });
    }

    graphEdges.push({
      from: nodeId(fromNode),
      to: use.uses,
      type: "uses",
    });
  }

  return { nodes, edges: graphEdges };
}
