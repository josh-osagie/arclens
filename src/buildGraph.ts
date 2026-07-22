import type { Graph, GraphEdge, GraphNode } from "./types";
import {
  ExportRecord,
  extractHookUsage,
  extractImportEdges,
  extractJsxRenders,
} from "./extractors/exports";
import {
  findExportByName,
  findExportInFile,
  findDefaultExportInFile,
  externalNodeId,
  nodeId,
  resolveFromExport,
} from "./extractors/find";

function createBaseNode(
  id: string,
  name: string,
  file: string,
  type: GraphNode["type"],
  extra?: Pick<GraphNode, "exportKind" | "kind">,
): GraphNode {
  return {
    id,
    name,
    file,
    type,
    ...extra,
    connections: { incoming: [], outgoing: [] },
    stats: { incoming: 0, outgoing: 0 },
  };
}

function ensureNode(nodes: GraphNode[], exportRecord: ExportRecord): void {
  const id = nodeId(exportRecord);
  if (!nodes.some((node) => node.id === id)) {
    nodes.push(
      createBaseNode(id, exportRecord.name, exportRecord.file, exportRecord.type, {
        exportKind: exportRecord.exportKind,
        kind: exportRecord.kind,
      }),
    );
  }
}

export function buildGraph(
  importEdges: ReturnType<typeof extractImportEdges>,
  exports: ExportRecord[],
  renders: ReturnType<typeof extractJsxRenders>,
  uses: ReturnType<typeof extractHookUsage>,
): Graph {
  const nodes: GraphNode[] = exports.map((e) =>
    createBaseNode(nodeId(e), e.name, e.file, e.type, {
      exportKind: e.exportKind,
      kind: e.kind,
    }),
  );

  const graphEdges: GraphEdge[] = [];

  for (const imp of importEdges) {
    if (!imp.resolvedTo || imp.resolvedTo.includes("node_modules")) {
      continue;
    }

    const fromExport = resolveFromExport(exports, imp.from);
    ensureNode(nodes, fromExport);

    if (imp.defaultImport) {
      const toExport =
        findDefaultExportInFile(exports, imp.resolvedTo) ??
        findExportInFile(exports, imp.resolvedTo, imp.defaultImport);

      if (toExport) {
        graphEdges.push({
          from: nodeId(fromExport),
          to: nodeId(toExport),
          type: "imports",
        });
      }
    }

    for (const symbol of imp.namedImports) {
      const toExport =
        findExportInFile(exports, imp.resolvedTo, symbol) ??
        findExportByName(exports, symbol);

      if (toExport) {
        graphEdges.push({
          from: nodeId(fromExport),
          to: nodeId(toExport),
          type: "imports",
        });
      }
    }
  }

  for (const render of renders) {
    const fromExport = resolveFromExport(exports, render.file);
    ensureNode(nodes, fromExport);

    const toExport = findExportByName(exports, render.renders);
    if (!toExport) continue;

    graphEdges.push({
      from: nodeId(fromExport),
      to: nodeId(toExport),
      type: "renders",
    });
  }

  for (const use of uses) {
    const fromExport = resolveFromExport(exports, use.file);
    ensureNode(nodes, fromExport);

    const hookId = externalNodeId(use.uses);

    if (!nodes.some((node) => node.id === hookId)) {
      nodes.push(createBaseNode(hookId, use.uses, "external", "hook"));
    }

    graphEdges.push({
      from: nodeId(fromExport),
      to: hookId,
      type: "uses",
    });
  }

  return { nodes, edges: graphEdges };
}
