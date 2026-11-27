import type { Graph, GraphEdge, GraphNode } from "./types";
import {
  ExportRecord,
  ReExportRecord,
  extractHookUsage,
  extractImportEdges,
  extractJsxRenders,
} from "./extractors/exports";
import {
  findExportByName,
  findExportInFile,
  findDefaultExportInFile,
  resolveImportedExport,
  externalNodeId,
  nodeId,
  resolveFromExport,
} from "./extractors/find";

function createBaseNode(
  id: string,
  name: string,
  file: string,
  type: GraphNode["type"],
  extra?: Pick<GraphNode, "exportKind" | "kind">
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
      createBaseNode(
        id,
        exportRecord.name,
        exportRecord.file,
        exportRecord.type,
        {
          exportKind: exportRecord.exportKind,
          kind: exportRecord.kind,
        }
      )
    );
  }
}

export function buildGraph(
  importEdges: ReturnType<typeof extractImportEdges>,
  exports: ExportRecord[],
  renders: ReturnType<typeof extractJsxRenders>,
  uses: ReturnType<typeof extractHookUsage>,
  reExports: ReExportRecord[] = []
): Graph {
  const nodes: GraphNode[] = exports.map((e) =>
    createBaseNode(nodeId(e), e.name, e.file, e.type, {
      exportKind: e.exportKind,
      kind: e.kind,
    })
  );

  const graphEdges: GraphEdge[] = [];
  const importsByFile = new Map<
    string,
    ReturnType<typeof extractImportEdges>
  >();

  for (const imp of importEdges) {
    if (imp.isTypeOnly) continue;
    if (!imp.resolvedTo || imp.resolvedTo.includes("node_modules")) {
      continue;
    }

    const fileImports = importsByFile.get(imp.from) ?? [];
    fileImports.push(imp);
    importsByFile.set(imp.from, fileImports);

    const fromExport = resolveFromExport(exports, imp.from);
    ensureNode(nodes, fromExport);

    if (imp.defaultImport) {
      const toExport = resolveImportedExport(
        exports,
        imp.resolvedTo,
        imp.defaultImport,
        true,
        reExports
      );

      if (toExport && nodeId(toExport) !== nodeId(fromExport)) {
        graphEdges.push({
          from: nodeId(fromExport),
          to: nodeId(toExport),
          type: "imports",
        });
      }
    }

    for (const symbol of imp.namedImports) {
      const toExport = resolveImportedExport(
        exports,
        imp.resolvedTo,
        symbol,
        false,
        reExports
      );

      if (toExport && nodeId(toExport) !== nodeId(fromExport)) {
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

  const resolveLocalHook = (
    callerFile: string,
    hookName: string
  ): ExportRecord | undefined => {
    const sameFile = findExportInFile(exports, callerFile, hookName);
    if (sameFile) return sameFile;

    const fileImports = importsByFile.get(callerFile) ?? [];
    for (const imp of fileImports) {
      if (!imp.resolvedTo) continue;
      if (imp.defaultImport === hookName) {
        const match = resolveImportedExport(
          exports,
          imp.resolvedTo,
          hookName,
          true,
          reExports
        );
        if (match) return match;
      }
      if (imp.namedImports.includes(hookName)) {
        const match = resolveImportedExport(
          exports,
          imp.resolvedTo,
          hookName,
          false,
          reExports
        );
        if (match) return match;
      }
    }

    return (
      exports.find((exp) => exp.name === hookName && exp.type === "hook") ??
      findExportByName(exports, hookName)
    );
  };

  for (const use of uses) {
    const fromExport = resolveFromExport(exports, use.file);
    ensureNode(nodes, fromExport);
    const fromId = nodeId(fromExport);

    const localHook = resolveLocalHook(use.file, use.uses);
    if (localHook) {
      const localHookId = nodeId(localHook);
      if (localHookId !== fromId) {
        graphEdges.push({
          from: fromId,
          to: localHookId,
          type: "uses",
        });
      }
      continue;
    }

    const hookId = externalNodeId(use.uses);

    if (!nodes.some((node) => node.id === hookId)) {
      nodes.push(createBaseNode(hookId, use.uses, "external", "hook"));
    }

    graphEdges.push({
      from: fromId,
      to: hookId,
      type: "uses",
    });
  }

  return { nodes, edges: graphEdges };
}
