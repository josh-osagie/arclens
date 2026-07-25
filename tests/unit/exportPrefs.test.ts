import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadExportScope, saveExportScope } from "../../viewer/src/exportPrefs";

const STORAGE_KEY = "arclens-export-scope";

describe("exportPrefs", () => {
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

  it("defaults to viewport scope", () => {
    expect(loadExportScope()).toBe("viewport");
  });

  it("persists export scope preference", () => {
    saveExportScope("full");
    expect(store[STORAGE_KEY]).toBe("full");
    expect(loadExportScope()).toBe("full");

    saveExportScope("viewport");
    expect(loadExportScope()).toBe("viewport");
  });

  it("ignores invalid stored values", () => {
    store[STORAGE_KEY] = "invalid";
    expect(loadExportScope()).toBe("viewport");
  });

  it("tolerates storage failures", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => undefined,
    });

    expect(loadExportScope()).toBe("viewport");
  });
});
