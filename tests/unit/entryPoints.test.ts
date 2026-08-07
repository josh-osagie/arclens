import { describe, expect, it } from "vitest";
import {
  dedupeEntryPointsByFile,
  entryFileConfidence,
  filterEntryNodes,
  findFallbackEntryNodes,
  isAppEntryFile,
  isEntryNode,
  isNonProductionFile,
} from "../../src/entryPoints";

describe("entryPoints", () => {
  describe("isNonProductionFile", () => {
    it("flags test, spec, story, and mock paths", () => {
      expect(isNonProductionFile("src/Signin.test.tsx")).toBe(true);
      expect(isNonProductionFile("src/CustomerOnboardingWizard.spec.tsx")).toBe(
        true
      );
      expect(isNonProductionFile("src/Button.stories.tsx")).toBe(true);
      expect(isNonProductionFile("src/__tests__/App.test.tsx")).toBe(true);
      expect(isNonProductionFile("src/__mocks__/react-router.tsx")).toBe(true);
      expect(isNonProductionFile("src/setupTests.ts")).toBe(true);
      expect(isNonProductionFile("vitest.setup.ts")).toBe(true);
    });

    it("allows production source files", () => {
      expect(isNonProductionFile("src/main.tsx")).toBe(false);
      expect(isNonProductionFile("src/App.tsx")).toBe(false);
    });
  });

  describe("isAppEntryFile", () => {
    it("matches app bootstrap files", () => {
      expect(isAppEntryFile("src/main.tsx")).toBe(true);
      expect(isAppEntryFile("C:\\project\\src\\main.tsx")).toBe(true);
      expect(isAppEntryFile("src/index.tsx")).toBe(true);
      expect(isAppEntryFile("app/layout.tsx")).toBe(true);
      expect(isAppEntryFile("app/page.tsx")).toBe(true);
      expect(isAppEntryFile("pages/_app.tsx")).toBe(true);
    });

    it("rejects component barrel index files", () => {
      expect(isAppEntryFile("src/components/badge/index.tsx")).toBe(false);
      expect(isAppEntryFile("src/ui/Button/index.tsx")).toBe(false);
    });

    it("rejects test files even when named main", () => {
      expect(isAppEntryFile("src/main.test.tsx")).toBe(false);
    });
  });

  describe("entryFileConfidence", () => {
    it("ranks main.tsx and Next root layouts as high", () => {
      expect(entryFileConfidence("src/main.tsx")).toBe("high");
      expect(entryFileConfidence("app/layout.tsx")).toBe("high");
      expect(entryFileConfidence("pages/_app.tsx")).toBe("high");
    });

    it("ranks pages/_document as medium", () => {
      expect(entryFileConfidence("pages/_document.tsx")).toBe("medium");
    });
  });

  describe("filterEntryNodes", () => {
    const nodes = [
      { id: "main", name: "bootstrap", file: "src/main.tsx", type: "entry" },
      {
        id: "badge-a",
        name: "BadgeIcon",
        file: "src/components/badge/index.tsx",
        type: "component",
      },
      {
        id: "badge-b",
        name: "BadgeLabel",
        file: "src/components/badge/index.tsx",
        type: "component",
      },
      {
        id: "test",
        name: "SigninTest",
        file: "src/Signin.test.tsx",
        type: "entry",
      },
      {
        id: "hub",
        name: "Hub",
        file: "src/components/Hub.tsx",
        type: "component",
      },
    ];

    it("ignores barrel exports even when meta lists them", () => {
      const entries = filterEntryNodes(nodes, ["badge-a", "badge-b", "main"]);
      expect(entries.map((node) => node.id)).toEqual(["main"]);
    });

    it("excludes test files even when typed as entry", () => {
      const entries = filterEntryNodes(nodes, ["test", "main"]);
      expect(entries.map((node) => node.id)).toEqual(["main"]);
    });

    it("falls back to typed entry nodes when meta is empty", () => {
      const entries = filterEntryNodes(nodes);
      expect(entries.map((node) => node.id)).toEqual(["main"]);
    });

    it("falls back to graph roots when no bootstrap entry exists", () => {
      const sampleNodes = [
        {
          id: "counter",
          name: "Counter",
          file: "samples/Counter.tsx",
          type: "component",
          stats: { incoming: 0, outgoing: 4 },
        },
        {
          id: "button",
          name: "Button",
          file: "samples/Button.tsx",
          type: "component",
          stats: { incoming: 3, outgoing: 0 },
        },
        {
          id: "orphan",
          name: "ThemeContext",
          file: "samples/ThemeContext.tsx",
          type: "context",
          stats: { incoming: 0, outgoing: 0 },
        },
        {
          id: "hook",
          name: "useCounter",
          file: "samples/useCounter.ts",
          type: "hook",
          stats: { incoming: 0, outgoing: 1 },
        },
      ];

      const entries = filterEntryNodes(sampleNodes, []);
      expect(entries.map((node) => node.id)).toEqual(["counter", "hook"]);
    });
  });

  describe("findFallbackEntryNodes", () => {
    it("prefers components over hooks among graph roots", () => {
      const nodes = [
        {
          id: "hook",
          name: "useCounter",
          file: "src/useCounter.ts",
          type: "hook",
        },
        {
          id: "app",
          name: "Counter",
          file: "src/Counter.tsx",
          type: "component",
        },
      ];
      const edges = [
        { from: "app", to: "hook", type: "imports" },
        { from: "app", to: "external", type: "uses" },
      ];

      const roots = findFallbackEntryNodes(nodes, edges);
      expect(roots.map((node) => node.id)).toEqual(["app"]);
    });
  });

  describe("isEntryNode", () => {
    it("treats typed entry nodes as entries", () => {
      expect(
        isEntryNode({
          id: "x",
          name: "App",
          file: "src/App.tsx",
          type: "entry",
        })
      ).toBe(true);
    });

    it("does not treat barrel components as entries", () => {
      expect(
        isEntryNode({
          id: "x",
          name: "BadgeIcon",
          file: "src/components/badge/index.tsx",
          type: "component",
        })
      ).toBe(false);
    });

    it("does not treat test files as entries", () => {
      expect(
        isEntryNode({
          id: "x",
          name: "SigninTest",
          file: "src/Signin.test.tsx",
          type: "entry",
        })
      ).toBe(false);
    });
  });

  describe("dedupeEntryPointsByFile", () => {
    it("groups exports from the same file and ranks by confidence", () => {
      const nodes = [
        { id: "main", name: "bootstrap", file: "src/main.tsx", type: "entry" },
        {
          id: "badge-a",
          name: "BadgeIcon",
          file: "src/components/badge/index.tsx",
          type: "component",
        },
        {
          id: "badge-b",
          name: "BadgeLabel",
          file: "src/components/badge/index.tsx",
          type: "component",
        },
        {
          id: "pages",
          name: "RootLayout",
          file: "app/layout.tsx",
          type: "entry",
        },
      ];

      const deduped = dedupeEntryPointsByFile(filterEntryNodes(nodes), 5);
      expect(deduped).toHaveLength(1);
      expect(deduped[0]?.file).toBe("src/main.tsx");
      expect(deduped[0]?.confidence).toBe("high");
      expect(deduped[0]?.exportCount).toBe(1);
    });

    it("shows multiple high-confidence entries when no clear main.tsx", () => {
      const nodes = [
        {
          id: "layout",
          name: "RootLayout",
          file: "app/layout.tsx",
          type: "entry",
        },
        { id: "page", name: "HomePage", file: "app/page.tsx", type: "entry" },
      ];

      const deduped = dedupeEntryPointsByFile(filterEntryNodes(nodes), 5);
      expect(deduped).toHaveLength(2);
      expect(deduped[0]?.confidence).toBe("high");
      expect(deduped[1]?.confidence).toBe("high");
    });
  });
});
