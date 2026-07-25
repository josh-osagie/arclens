import { readLocalStorage, writeLocalStorage } from "./storageCompat";

export type ExportScope = "viewport" | "full";

const STORAGE_KEY = "arclens-export-scope";

export function loadExportScope(): ExportScope {
  try {
    const raw = readLocalStorage(STORAGE_KEY);
    if (raw === "full" || raw === "viewport") return raw;
  } catch {
    // ignore storage errors
  }
  return "viewport";
}

export function saveExportScope(scope: ExportScope): void {
  try {
    writeLocalStorage(STORAGE_KEY, scope);
  } catch {
    // ignore quota errors
  }
}
