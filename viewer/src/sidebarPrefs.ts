import { readLocalStorage, writeLocalStorage } from "./storageCompat";

export type SidebarSectionKey =
  | "entries"
  | "folders"
  | "hubs"
  | "graphControls"
  | "legend";

export type SidebarSectionPrefs = Record<SidebarSectionKey, boolean>;

/** `true` = section accordion expanded */
export const DEFAULT_SIDEBAR_SECTIONS: SidebarSectionPrefs = {
  entries: true,
  folders: true,
  hubs: false,
  graphControls: true,
  legend: false,
};

const STORAGE_KEY = "arclens-sidebar-sections";

export function loadSidebarSections(): SidebarSectionPrefs {
  try {
    const raw = readLocalStorage(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SIDEBAR_SECTIONS };
    const parsed = JSON.parse(raw) as Partial<SidebarSectionPrefs>;
    return { ...DEFAULT_SIDEBAR_SECTIONS, ...parsed };
  } catch {
    return { ...DEFAULT_SIDEBAR_SECTIONS };
  }
}

export function saveSidebarSections(prefs: SidebarSectionPrefs): void {
  try {
    writeLocalStorage(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota errors
  }
}

export function toggleSidebarSection(
  prefs: SidebarSectionPrefs,
  key: SidebarSectionKey,
): SidebarSectionPrefs {
  return { ...prefs, [key]: !prefs[key] };
}
