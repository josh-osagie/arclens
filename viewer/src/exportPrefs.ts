export type ExportScope = "viewport" | "full";

const STORAGE_KEY = "react-atlas-export-scope";

export function loadExportScope(): ExportScope {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "full" || raw === "viewport") return raw;
  } catch {
    // ignore storage errors
  }
  return "viewport";
}

export function saveExportScope(scope: ExportScope): void {
  try {
    localStorage.setItem(STORAGE_KEY, scope);
  } catch {
    // ignore quota errors
  }
}
