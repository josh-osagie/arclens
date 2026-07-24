import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadPanelMinimized,
  panelMinimizedKey,
  savePanelMinimized,
} from "../../viewer/src/panelStorage";

describe("panelStorage minimized state", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to expanded", () => {
    expect(loadPanelMinimized("main")).toBe(false);
  });

  it("persists minimized flag per panel id", () => {
    savePanelMinimized("main", true);
    savePanelMinimized("details", false);

    expect(loadPanelMinimized("main")).toBe(true);
    expect(loadPanelMinimized("details")).toBe(false);
    expect(store[panelMinimizedKey("main")]).toBe("1");
    expect(store[panelMinimizedKey("details")]).toBeUndefined();
  });

  it("clears storage when restored", () => {
    savePanelMinimized("details", true);
    savePanelMinimized("details", false);

    expect(loadPanelMinimized("details")).toBe(false);
    expect(store[panelMinimizedKey("details")]).toBeUndefined();
  });
});
