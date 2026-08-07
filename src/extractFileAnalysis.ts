import type { SourceFile, StandardizedFilePath } from "ts-morph";
import path from "node:path";
import { nodeId } from "./extractors/find";
import type { ExportRecord } from "./extractors/exports";
import {
  extractExportsDeclarations,
  extractHookUsage,
  extractImportEdges,
  extractJsxRenders,
} from "./extractors/exports";
import {
  detectHookRuleViolations,
  type HookRuleViolation,
} from "./extractors/hookRules";
import { extractComponentProps } from "./extractors/props";
import { classifyFileModule } from "./extractors/reactFunction";
import type { GraphNodeType, GraphProp } from "./types";

export type ImportEdge = ReturnType<typeof extractImportEdges>[number];
export type RenderEdge = ReturnType<typeof extractJsxRenders>[number];
export type UseEdge = ReturnType<typeof extractHookUsage>[number];

function normalizeFileRef(filePath: string): StandardizedFilePath {
  return path.normalize(filePath) as StandardizedFilePath;
}

export type FileAnalysisPayload = {
  filePath: string;
  importEdges: ImportEdge[];
  exports: ExportRecord[];
  renders: RenderEdge[];
  uses: UseEdge[];
  hookRuleViolations: HookRuleViolation[];
  propsByNodeId: Record<string, GraphProp[]>;
  moduleType: GraphNodeType;
};

export function sanitizeFileAnalysisPayload(
  payload: FileAnalysisPayload
): FileAnalysisPayload {
  return {
    ...payload,
    filePath: normalizeFileRef(payload.filePath),
    importEdges: payload.importEdges.map((edge) => ({
      ...edge,
      from: normalizeFileRef(edge.from),
      ...(edge.resolvedTo
        ? { resolvedTo: normalizeFileRef(edge.resolvedTo) }
        : {}),
    })),
    exports: payload.exports.map((exp) => ({
      ...exp,
      file: normalizeFileRef(exp.file),
    })),
    renders: payload.renders.map((render) => ({
      ...render,
      file: normalizeFileRef(render.file),
    })),
    uses: payload.uses.map((use) => ({
      ...use,
      file: normalizeFileRef(use.file),
    })),
    hookRuleViolations: payload.hookRuleViolations.map((violation) => ({
      ...violation,
      file: normalizeFileRef(violation.file),
    })),
    propsByNodeId: Object.fromEntries(
      Object.entries(payload.propsByNodeId).map(([id, props]) => {
        const sep = id.indexOf("::");
        if (sep === -1) return [id, props];
        const file = normalizeFileRef(id.slice(0, sep));
        const name = id.slice(sep + 2);
        return [`${file}::${name}`, props];
      })
    ),
    moduleType: payload.moduleType,
  };
}

export function extractFileAnalysis(
  sourceFile: SourceFile
): FileAnalysisPayload {
  const filePath = path.normalize(sourceFile.getFilePath());
  const exports = extractExportsDeclarations(sourceFile);
  const propsMap = extractComponentProps([sourceFile], exports);

  return sanitizeFileAnalysisPayload({
    filePath,
    importEdges: extractImportEdges(sourceFile),
    exports,
    renders: extractJsxRenders(sourceFile),
    uses: extractHookUsage(sourceFile),
    hookRuleViolations: detectHookRuleViolations([sourceFile]),
    propsByNodeId: Object.fromEntries(propsMap),
    moduleType: classifyFileModule(sourceFile),
  });
}

export type MergedFileAnalysis = {
  importEdges: ImportEdge[];
  exports: ExportRecord[];
  renders: RenderEdge[];
  uses: UseEdge[];
  hookRuleViolations: HookRuleViolation[];
  propsByNodeId: Map<string, GraphProp[]>;
  moduleTypeByFile: Map<string, GraphNodeType>;
  scannedFiles: string[];
};

export function mergeFilePayloads(
  payloads: FileAnalysisPayload[]
): MergedFileAnalysis {
  const importEdges: ImportEdge[] = [];
  const exports: ExportRecord[] = [];
  const renders: RenderEdge[] = [];
  const uses: UseEdge[] = [];
  const hookRuleViolations: HookRuleViolation[] = [];
  const propsByNodeId = new Map<string, GraphProp[]>();
  const moduleTypeByFile = new Map<string, GraphNodeType>();
  const scannedFiles: string[] = [];

  for (const payload of payloads) {
    scannedFiles.push(payload.filePath);
    importEdges.push(...payload.importEdges);
    exports.push(...payload.exports);
    renders.push(...payload.renders);
    uses.push(...payload.uses);
    hookRuleViolations.push(...payload.hookRuleViolations);

    for (const [id, props] of Object.entries(payload.propsByNodeId)) {
      propsByNodeId.set(id, props);
    }

    if (payload.moduleType !== "utility") {
      moduleTypeByFile.set(payload.filePath, payload.moduleType);
    }
  }

  return {
    importEdges,
    exports,
    renders,
    uses,
    hookRuleViolations,
    propsByNodeId,
    moduleTypeByFile,
    scannedFiles,
  };
}

export function payloadNodeIds(payload: FileAnalysisPayload): string[] {
  return payload.exports.map(nodeId);
}
