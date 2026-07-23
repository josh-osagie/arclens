export type SidebarSectionKey = "entries" | "folders" | "hubs";

export type SidebarSectionPrefs = Record<SidebarSectionKey, boolean>;

/** `true` = section accordion expanded */
export const DEFAULT_SIDEBAR_SECTIONS: SidebarSectionPrefs = {
  entries: true,
  folders: true,
  hubs: false,
};

const STORAGE_KEY = "react-atlas-sidebar-sections";

export function loadSidebarSections(): SidebarSectionPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SIDEBAR_SECTIONS };
    const parsed = JSON.parse(raw) as Partial<SidebarSectionPrefs>;
    return { ...DEFAULT_SIDEBAR_SECTIONS, ...parsed };
  } catch {
    return { ...DEFAULT_SIDEBAR_SECTIONS };
  }
}

export function saveSidebarSections(prefs: SidebarSectionPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
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
