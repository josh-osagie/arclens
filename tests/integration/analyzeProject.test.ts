import { describe, expect, it, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  analyzeFixture,
  analyzeSamples,
  hasEdge,
  incomingCount,
  insightTitles,
  nodeByName,
  outgoingEdges,
} from "../helpers";
import { UnsupportedProjectError } from "../../src/discoverFiles";
import { analyzeProject } from "../../src/analyzeProject";
import type { AnalysisResult } from "../../src/analyzeProject";

describe("analyzeProject integration", () => {
  describe("samples/ (dev workflow fixture)", () => {
    let result: AnalysisResult;

    beforeAll(async () => {
      result = await analyzeSamples();
    });

    it("scans all sample TypeScript files", async () => {
      expect(result.fileCount).toBe(5);
      expect(result.scannedFiles.some((f) => f.endsWith("Counter.tsx"))).toBe(
        true
      );
      expect(
        result.scannedFiles.some((f) => f.endsWith("ThemeContext.tsx"))
      ).toBe(true);
    });

    it("detects components, hooks, and utilities", async () => {
      expect(nodeByName(result, "Button")?.type).toBe("component");
      expect(nodeByName(result, "Counter")?.type).toBe("component");
      expect(nodeByName(result, "useCounter")?.type).toBe("hook");
      expect(nodeByName(result, "fetchUser")?.type).toBe("utility");
    });

    it("builds import, render, and hook-use edges", async () => {
      expect(hasEdge(result, "Counter", "Button", "imports")).toBe(true);
      expect(hasEdge(result, "Counter", "Button", "renders")).toBe(true);
      expect(outgoingEdges(result, "Counter", "uses").length).toBeGreaterThan(
        0
      );
    });

    it("tracks most-referenced nodes (Button is used twice in JSX)", async () => {
      expect(incomingCount(result, "Button")).toBeGreaterThanOrEqual(2);
    });

    it("surfaces architecture insights developers care about", async () => {
      const titles = insightTitles(result);
      expect(titles.some((t) => t.includes("Orphan export: fetchUser"))).toBe(
        true
      );
    });

    it("does not flag Counter as orphan", async () => {
      const titles = insightTitles(result);
      expect(titles.some((t) => t.includes("Orphan export: Counter"))).toBe(
        false
      );
    });
  });

  describe("default-export-app fixture", () => {
    let result: AnalysisResult;

    beforeAll(async () => {
      result = await analyzeFixture("default-export-app");
    });

    it("classifies main.tsx as entry", async () => {
      const main = nodeByName(result, "main");
      expect(main?.type).toBe("entry");
    });

    it("resolves export default function App to name App", async () => {
      expect(nodeByName(result, "App")?.type).toBe("component");
      expect(result.exports.some((e) => e.name === "default")).toBe(false);
    });

    it("links default imports to the default export", async () => {
      expect(hasEdge(result, "main", "App", "imports")).toBe(true);
    });

    it("does not warn about PascalCase default components", async () => {
      const titles = insightTitles(result);
      expect(titles.some((t) => t.includes("Component naming: default"))).toBe(
        false
      );
      expect(titles.some((t) => t.includes("Orphan export: App"))).toBe(false);
    });
  });

  describe("dual-export fixture", () => {
    let result: AnalysisResult;

    beforeAll(async () => {
      result = await analyzeFixture("dual-export");
    });

    it("dedupes named and default Hero exports", async () => {
      const heroExports = result.exports.filter((e) => e.name === "Hero");
      expect(heroExports).toHaveLength(1);
    });

    it("does not produce duplicate default/Hero insights", async () => {
      const titles = insightTitles(result);
      expect(titles.filter((t) => t.includes("default")).length).toBe(0);
    });
  });

  describe("hooks-violation fixture", () => {
    let result: AnalysisResult;

    beforeAll(async () => {
      result = await analyzeFixture("hooks-violation");
    });

    it("detects conditional hook violations in isolated file", async () => {
      expect(result.hookRuleViolations.length).toBeGreaterThan(0);
      expect(result.hookRuleViolations[0]?.hook).toBe("useEffect");
    });
  });

  describe("with-config fixture", () => {
    let result: AnalysisResult;

    beforeAll(async () => {
      result = await analyzeFixture("with-config");
    });

    it("excludes vite.config.ts from analysis", async () => {
      expect(
        result.scannedFiles.some((f) => f.endsWith("vite.config.ts"))
      ).toBe(false);
      expect(result.graph.nodes.some((node) => node.type === "config")).toBe(
        false
      );
    });

    it("does not emit insights for config files", async () => {
      const titles = insightTitles(result);
      expect(titles.some((t) => t.includes("vite.config"))).toBe(false);
    });
  });

  describe("entry-points fixture", () => {
    let result: AnalysisResult;

    beforeAll(async () => {
      result = await analyzeFixture("entry-points");
    });

    it("classifies only main.tsx as entry, not test files or barrels", async () => {
      const entryNodes = result.graph.nodes.filter(
        (node) => node.type === "entry"
      );
      expect(entryNodes.some((node) => node.file.endsWith("main.tsx"))).toBe(
        true
      );
      expect(entryNodes.some((node) => node.file.endsWith(".test.tsx"))).toBe(
        false
      );
      expect(
        entryNodes.some((node) => node.file.includes("Button/index.tsx"))
      ).toBe(false);
    });
  });

  describe("safety guards", () => {
    it("refuses when file count exceeds maxFiles", async () => {
      await expect(analyzeSamples({ maxFiles: 1 })).rejects.toThrow(
        /Refusing to analyze/
      );
    });

    it("throws UnsupportedProjectError for HTML-only folders", async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arclens-html-only-"));
      fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html>\n");

      await expect(analyzeProject(dir, { cache: false })).rejects.toThrow(
        UnsupportedProjectError
      );
      try {
        await analyzeProject(dir, { cache: false });
      } catch (error) {
        expect(error).toBeInstanceOf(UnsupportedProjectError);
        expect((error as UnsupportedProjectError).message).toMatch(/HTML file/);
        expect((error as UnsupportedProjectError).message).toMatch(
          /not supported yet/
        );
      }
    });
  });
});
