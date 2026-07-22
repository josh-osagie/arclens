import path from "node:path";
import type { ExportRecord } from "./exports";

export function nodeId(exportRecord: ExportRecord): string {
  return `${exportRecord.file}::${exportRecord.name}`;
}

/** Stable id for hooks imported from react (not defined in the scanned project). */
export function externalNodeId(name: string): string {
  return `external::${name}`;
}

export function findExportInFile(
  exports: ExportRecord[],
  file: string,
  name: string,
): ExportRecord | undefined {
  return exports.find((exp) => exp.file === file && exp.name === name);
}

export function findDefaultExportInFile(
  exports: ExportRecord[],
  file: string,
): ExportRecord | undefined {
  return exports.find((exp) => exp.file === file && exp.exportKind === "default");
}

/** Primary export for a file — used as the "from" node for edges originating in that file. */
export function findPrimaryExportInFile(
  exports: ExportRecord[],
  file: string,
): ExportRecord | undefined {
  const inFile = exports.filter((exp) => exp.file === file);
  if (inFile.length === 0) return undefined;
  if (inFile.length === 1) return inFile[0];

  return (
    inFile.find((exp) => exp.exportKind === "named" && exp.type === "component") ??
    inFile.find((exp) => exp.type === "component") ??
    inFile.find((exp) => exp.exportKind === "named") ??
    inFile[0]
  );
}

export function findExportByName(exports: ExportRecord[], name: string): ExportRecord | undefined {
  return exports.find((exp) => exp.name === name);
}

/** @deprecated Use findPrimaryExportInFile */
export function findExportByFile(exports: ExportRecord[], file: string) {
  return findPrimaryExportInFile(exports, file);
}

export function createModuleExport(file: string): ExportRecord {
  return {
    file,
    name: path.basename(file, path.extname(file)),
    exportKind: "named",
    kind: "SourceFile",
    type: "utility",
  };
}

export function resolveFromExport(
  exports: ExportRecord[],
  file: string,
): ExportRecord {
  return findPrimaryExportInFile(exports, file) ?? createModuleExport(file);
}
