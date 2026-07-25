import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadSourcePreviewExpanded,
  saveSourcePreviewExpanded,
} from "../../viewer/src/detailsPanelPrefs";

const SOURCE_PREVIEW_KEY = "arclens-source-preview-expanded";

describe("detailsPanelPrefs — source preview", () => {
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

  it("loads expanded by default when storage is empty", () => {
    expect(loadSourcePreviewExpanded()).toBe(true);
  });

  it("persists collapsed state", () => {
    saveSourcePreviewExpanded(false);
    expect(store[SOURCE_PREVIEW_KEY]).toBe("false");
    expect(loadSourcePreviewExpanded()).toBe(false);
  });

  it("persists expanded state", () => {
    saveSourcePreviewExpanded(true);
    expect(loadSourcePreviewExpanded()).toBe(true);
  });
});
