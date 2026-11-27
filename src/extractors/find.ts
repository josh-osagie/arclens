import path from "node:path";
import type { ExportRecord, ReExportRecord } from "./exports";

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
  name: string
): ExportRecord | undefined {
  return exports.find((exp) => exp.file === file && exp.name === name);
}

export function findDefaultExportInFile(
  exports: ExportRecord[],
  file: string
): ExportRecord | undefined {
  return exports.find(
    (exp) => exp.file === file && exp.exportKind === "default"
  );
}

/** Primary export for a file — used as the "from" node for edges originating in that file. */
export function findPrimaryExportInFile(
  exports: ExportRecord[],
  file: string
): ExportRecord | undefined {
  const inFile = exports.filter((exp) => exp.file === file);
  if (inFile.length === 0) return undefined;
  if (inFile.length === 1) return inFile[0];

  return (
    inFile.find(
      (exp) => exp.exportKind === "named" && exp.type === "component"
    ) ??
    inFile.find((exp) => exp.type === "component") ??
    inFile.find((exp) => exp.exportKind === "named") ??
    inFile[0]
  );
}

export function findExportByName(
  exports: ExportRecord[],
  name: string
): ExportRecord | undefined {
  return exports.find((exp) => exp.name === name);
}

/** Resolve an imported symbol from a target file, following barrel re-exports up to 5 hops. */
export function resolveImportedExport(
  exports: ExportRecord[],
  resolvedFile: string,
  symbolName: string,
  isDefault = false,
  reExports: ReExportRecord[] = []
): ExportRecord | undefined {
  if (isDefault) {
    const directDefault = findDefaultExportInFile(exports, resolvedFile);
    if (directDefault) return directDefault;
  }

  const direct = findExportInFile(exports, resolvedFile, symbolName);
  if (direct) return direct;

  if (reExports.length > 0) {
    let curFile = resolvedFile;
    let curName = isDefault ? "default" : symbolName;
    for (let depth = 0; depth < 5; depth++) {
      const hop =
        reExports.find((r) => r.file === curFile && r.exportName === curName) ??
        (isDefault
          ? reExports.find(
              (r) => r.file === curFile && r.exportName === symbolName
            )
          : undefined);
      if (!hop) break;

      const match =
        findExportInFile(exports, hop.targetFile, hop.targetName) ??
        (hop.exportName === "default"
          ? findDefaultExportInFile(exports, hop.targetFile)
          : undefined);
      if (match) return match;

      curFile = hop.targetFile;
      curName = hop.targetName;
    }
  }

  const dir = path.dirname(resolvedFile);
  const prefix = dir.endsWith(path.sep) ? dir : `${dir}${path.sep}`;
  const inSubtree = exports.find(
    (exp) => exp.name === symbolName && exp.file.startsWith(prefix)
  );
  if (inSubtree) return inSubtree;

  return findExportByName(exports, symbolName);
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
  file: string
): ExportRecord {
  return findPrimaryExportInFile(exports, file) ?? createModuleExport(file);
}
