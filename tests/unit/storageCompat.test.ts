import { describe, expect, it, vi } from "vitest";
import {
  readLocalStorage,
  toLegacyStorageKey,
  writeLocalStorage,
} from "../../viewer/src/storageCompat";

describe("storageCompat", () => {
  it("maps arclens keys to react-atlas legacy keys", () => {
    expect(toLegacyStorageKey("arclens-details-fields")).toBe(
      "react-atlas-details-fields",
    );
    expect(toLegacyStorageKey("arclens-panel:main")).toBe(
      "react-atlas-panel:main",
    );
  });

  it("reads primary key first", () => {
    const store = new Map<string, string>([["arclens-export-scope", "full"]]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });

    expect(readLocalStorage("arclens-export-scope")).toBe("full");
    vi.unstubAllGlobals();
  });

  it("falls back to react-atlas key when primary is missing", () => {
    const store = new Map<string, string>([
      ["react-atlas-layout-preset", "compact"],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });

    expect(readLocalStorage("arclens-layout-preset")).toBe("compact");
    vi.unstubAllGlobals();
  });

  it("writes only to arclens key", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });

    writeLocalStorage("arclens-sidebar-sections", '{"entries":false}');
    expect(store.has("arclens-sidebar-sections")).toBe(true);
    expect(store.has("react-atlas-sidebar-sections")).toBe(false);
    vi.unstubAllGlobals();
  });
});
