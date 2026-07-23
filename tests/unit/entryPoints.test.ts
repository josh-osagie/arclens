import { describe, expect, it } from "vitest";
import {
  dedupeEntryPointsByFile,
  filterEntryNodes,
  isAppEntryFile,
  isEntryNode,
} from "../../src/entryPoints";

describe("entryPoints", () => {
  describe("isAppEntryFile", () => {
    it("matches app bootstrap files", () => {
      expect(isAppEntryFile("src/main.tsx")).toBe(true);
      expect(isAppEntryFile("C:\\project\\src\\main.tsx")).toBe(true);
      expect(isAppEntryFile("src/index.tsx")).toBe(true);
      expect(isAppEntryFile("app/layout.tsx")).toBe(true);
      expect(isAppEntryFile("pages/_app.tsx")).toBe(true);
    });

    it("rejects component barrel index files", () => {
      expect(isAppEntryFile("src/components/badge/index.tsx")).toBe(false);
      expect(isAppEntryFile("src/ui/Button/index.tsx")).toBe(false);
    });
  });

  describe("filterEntryNodes", () => {
    const nodes = [
      { id: "main", name: "bootstrap", file: "src/main.tsx", type: "entry" },
      { id: "badge-a", name: "BadgeIcon", file: "src/components/badge/index.tsx", type: "component" },
      { id: "badge-b", name: "BadgeLabel", file: "src/components/badge/index.tsx", type: "component" },
      { id: "hub", name: "Hub", file: "src/components/Hub.tsx", type: "component" },
    ];

    it("ignores barrel exports even when meta lists them", () => {
      const entries = filterEntryNodes(nodes, ["badge-a", "badge-b", "main"]);
      expect(entries.map((node) => node.id)).toEqual(["main"]);
    });

    it("falls back to typed entry nodes when meta is empty", () => {
      const entries = filterEntryNodes(nodes);
      expect(entries.map((node) => node.id)).toEqual(["main"]);
    });
  });

  describe("isEntryNode", () => {
    it("treats typed entry nodes as entries", () => {
      expect(
        isEntryNode({ id: "x", name: "App", file: "src/App.tsx", type: "entry" }),
      ).toBe(true);
    });

    it("does not treat barrel components as entries", () => {
      expect(
        isEntryNode({
          id: "x",
          name: "BadgeIcon",
          file: "src/components/badge/index.tsx",
          type: "component",
        }),
      ).toBe(false);
    });
  });

  describe("dedupeEntryPointsByFile", () => {
    it("groups exports from the same file and limits results", () => {
      const nodes = [
        { id: "main", name: "bootstrap", file: "src/main.tsx", type: "entry" },
        { id: "badge-a", name: "BadgeIcon", file: "src/components/badge/index.tsx", type: "component" },
        { id: "badge-b", name: "BadgeLabel", file: "src/components/badge/index.tsx", type: "component" },
        { id: "pages", name: "RootLayout", file: "app/layout.tsx", type: "entry" },
      ];

      const deduped = dedupeEntryPointsByFile(filterEntryNodes(nodes), 5);
      expect(deduped).toHaveLength(2);
      expect(deduped[0]?.file).toBe("app/layout.tsx");
      expect(deduped[1]?.file).toBe("src/main.tsx");
      expect(deduped[1]?.exportCount).toBe(1);
    });
  });
});
