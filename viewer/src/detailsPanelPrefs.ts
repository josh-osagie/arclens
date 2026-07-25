import { readLocalStorage, writeLocalStorage } from "./storageCompat";

export type DetailsFieldKey =
  | "export"
  | "astKind"
  | "usedBy"
  | "dependsOn"
  | "props"
  | "importedBy"
  | "renderedBy"
  | "calledFrom"
  | "imports"
  | "renders"
  | "callsHooks";

export type DetailsFieldPrefs = Record<DetailsFieldKey, boolean>;

export const DETAILS_FIELD_LABELS: Record<DetailsFieldKey, string> = {
  export: "Export",
  astKind: "AST kind",
  usedBy: "Used by",
  dependsOn: "Depends on",
  props: "Props",
  importedBy: "Imported by",
  renderedBy: "Rendered by",
  calledFrom: "Called from",
  imports: "Imports",
  renders: "Renders",
  callsHooks: "Calls hooks",
};

export const DEFAULT_DETAILS_FIELDS: DetailsFieldPrefs = {
  export: true,
  astKind: false,
  usedBy: true,
  dependsOn: true,
  props: true,
  importedBy: true,
  renderedBy: true,
  calledFrom: true,
  imports: true,
  renders: true,
  callsHooks: true,
};

const STORAGE_KEY = "arclens-details-fields";

export function loadDetailsFields(): DetailsFieldPrefs {
  try {
    const raw = readLocalStorage(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DETAILS_FIELDS };
    const parsed = JSON.parse(raw) as Partial<DetailsFieldPrefs>;
    return { ...DEFAULT_DETAILS_FIELDS, ...parsed };
  } catch {
    return { ...DEFAULT_DETAILS_FIELDS };
  }
}

export function saveDetailsFields(prefs: DetailsFieldPrefs): void {
  try {
    writeLocalStorage(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota errors
  }
}

const SOURCE_PREVIEW_KEY = "arclens-source-preview-expanded";

/** `true` = source preview section expanded */
export function loadSourcePreviewExpanded(): boolean {
  try {
    const raw = readLocalStorage(SOURCE_PREVIEW_KEY);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

export function saveSourcePreviewExpanded(expanded: boolean): void {
  try {
    writeLocalStorage(SOURCE_PREVIEW_KEY, String(expanded));
  } catch {
    // ignore quota errors
  }
}
