import type { GraphEdgeType } from "./types";
import { readLocalStorage, writeLocalStorage } from "./storageCompat";

export type EdgeVisibilityPrefs = Record<GraphEdgeType, boolean>;

export const EDGE_TYPES: GraphEdgeType[] = ["imports", "renders", "uses"];

export const EDGE_VISIBILITY_LABELS: Record<GraphEdgeType, string> = {
  imports: "Imports",
  renders: "Renders",
  uses: "Uses",
};

export const DEFAULT_EDGE_VISIBILITY: EdgeVisibilityPrefs = {
  imports: true,
  renders: true,
  uses: true,
};

const STORAGE_KEY = "arclens-edge-visibility";

export function loadEdgeVisibility(): EdgeVisibilityPrefs {
  try {
    const raw = readLocalStorage(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_EDGE_VISIBILITY };
    const parsed = JSON.parse(raw) as Partial<EdgeVisibilityPrefs>;
    return {
      imports: parsed.imports ?? DEFAULT_EDGE_VISIBILITY.imports,
      renders: parsed.renders ?? DEFAULT_EDGE_VISIBILITY.renders,
      uses: parsed.uses ?? DEFAULT_EDGE_VISIBILITY.uses,
    };
  } catch {
    return { ...DEFAULT_EDGE_VISIBILITY };
  }
}

export function saveEdgeVisibility(prefs: EdgeVisibilityPrefs): void {
  try {
    writeLocalStorage(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota errors
  }
}

export function setEdgeTypeVisible(
  prefs: EdgeVisibilityPrefs,
  type: GraphEdgeType,
  visible: boolean
): EdgeVisibilityPrefs {
  return { ...prefs, [type]: visible };
}
