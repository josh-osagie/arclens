import path from "node:path";
import { isNonProductionFile } from "./entryPoints";

/** Redux / Zustand-style modules — often "orphan" in import graphs but used at runtime. */
export function isLikelyStateExport(name: string, filePath: string): boolean {
  const base = path.basename(filePath, path.extname(filePath));

  if (/Slice$/i.test(name) || /Reducer$/i.test(name)) return true;
  if (/\.slice\.(ts|tsx|js|jsx)$/i.test(filePath)) return true;
  if (/Slice$/i.test(base)) return true;

  return false;
}

/** Test helpers, HOC wrappers, and render utilities — not app components. */
export function isTestOrHocUtility(name: string, filePath: string): boolean {
  if (isNonProductionFile(filePath)) return true;

  const normalized = filePath.replace(/\\/g, "/");
  if (/(^|\/)(hoc|test-utils|testing-utils|__tests__|__mocks__)(\/|$)/i.test(normalized)) {
    return true;
  }

  if (/^renderWith[A-Z]/.test(name)) return true;
  if (/^with[A-Z]/.test(name)) return true;

  return false;
}

/** Barrel files that only re-export symbols defined elsewhere. */
export function isBarrelFile(filePath: string): boolean {
  return path.basename(filePath, path.extname(filePath)) === "index";
}

export function isKebabCaseSymbol(name: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(name);
}
