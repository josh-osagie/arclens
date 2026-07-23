import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SIDEBAR_SECTIONS,
  loadSidebarSections,
  saveSidebarSections,
  toggleSidebarSection,
} from "../../viewer/src/sidebarPrefs";

const STORAGE_KEY = "react-atlas-sidebar-sections";

describe("sidebarPrefs", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads defaults when storage is empty", () => {
    expect(loadSidebarSections()).toEqual(DEFAULT_SIDEBAR_SECTIONS);
  });

  it("merges stored values over defaults", () => {
    saveSidebarSections({ ...DEFAULT_SIDEBAR_SECTIONS, hubs: true });
    expect(loadSidebarSections().hubs).toBe(true);
  });

  it("persists toggled section state", () => {
    const next = toggleSidebarSection(DEFAULT_SIDEBAR_SECTIONS, "entries");
    saveSidebarSections(next);

    const raw = store[STORAGE_KEY];
    expect(raw).toBeTruthy();
    expect(loadSidebarSections().entries).toBe(false);
  });
});
