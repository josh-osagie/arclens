import type { ExportRecord } from "./exports";

export function findExportByFile(exports: ExportRecord[], file: string) {
  return exports.find((e) => e.file === file);
}

export function findExportByName(exports: ExportRecord[], name: string) {
  return exports.find((e) => e.name === name);
}

export function nodeId(exportRecord: ExportRecord) {
  return `${exportRecord.file}::${exportRecord.name}`;
}
