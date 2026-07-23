import { describe, expect, it } from "vitest";
import {
  analyzeFixture,
  analyzeSamples,
  hasEdge,
  incomingCount,
  insightTitles,
  nodeByName,
  outgoingEdges,
} from "../helpers";

describe("analyzeProject integration", () => {
  describe("samples/ (dev workflow fixture)", () => {
    const result = analyzeSamples();

    it("scans all sample TypeScript files", () => {
      expect(result.fileCount).toBe(5);
      expect(result.scannedFiles.some((f) => f.endsWith("Counter.tsx"))).toBe(true);
      expect(result.scannedFiles.some((f) => f.endsWith("ThemeContext.tsx"))).toBe(true);
    });

    it("detects components, hooks, and utilities", () => {
      expect(nodeByName(result, "Button")?.type).toBe("component");
      expect(nodeByName(result, "Counter")?.type).toBe("component");
      expect(nodeByName(result, "useCounter")?.type).toBe("hook");
      expect(nodeByName(result, "fetchUser")?.type).toBe("utility");
    });

    it("builds import, render, and hook-use edges", () => {
      expect(hasEdge(result, "Counter", "Button", "imports")).toBe(true);
      expect(hasEdge(result, "Counter", "Button", "renders")).toBe(true);
      expect(outgoingEdges(result, "Counter", "uses").length).toBeGreaterThan(0);
    });

    it("tracks most-referenced nodes (Button is used twice in JSX)", () => {
      expect(incomingCount(result, "Button")).toBeGreaterThanOrEqual(2);
    });

    it("surfaces architecture insights developers care about", () => {
      const titles = insightTitles(result);
      expect(titles.some((t) => t.includes("Orphan export: fetchUser"))).toBe(true);
    });

    it("does not flag Counter as orphan", () => {
      const titles = insightTitles(result);
      expect(titles.some((t) => t.includes("Orphan export: Counter"))).toBe(false);
    });
  });

  describe("default-export-app fixture", () => {
    const result = analyzeFixture("default-export-app");

    it("classifies main.tsx as entry", () => {
      const main = nodeByName(result, "main");
      expect(main?.type).toBe("entry");
    });

    it("resolves export default function App to name App", () => {
      expect(nodeByName(result, "App")?.type).toBe("component");
      expect(result.exports.some((e) => e.name === "default")).toBe(false);
    });

    it("links default imports to the default export", () => {
      expect(hasEdge(result, "main", "App", "imports")).toBe(true);
    });

    it("does not warn about PascalCase default components", () => {
      const titles = insightTitles(result);
      expect(titles.some((t) => t.includes("Component naming: default"))).toBe(false);
      expect(titles.some((t) => t.includes("Orphan export: App"))).toBe(false);
    });
  });

  describe("dual-export fixture", () => {
    const result = analyzeFixture("dual-export");

    it("dedupes named and default Hero exports", () => {
      const heroExports = result.exports.filter((e) => e.name === "Hero");
      expect(heroExports).toHaveLength(1);
    });

    it("does not produce duplicate default/Hero insights", () => {
      const titles = insightTitles(result);
      expect(titles.filter((t) => t.includes("default")).length).toBe(0);
    });
  });

  describe("hooks-violation fixture", () => {
    const result = analyzeFixture("hooks-violation");

    it("detects conditional hook violations in isolated file", () => {
      expect(result.hookRuleViolations.length).toBeGreaterThan(0);
      expect(result.hookRuleViolations[0]?.hook).toBe("useEffect");
    });
  });

  describe("with-config fixture", () => {
    const result = analyzeFixture("with-config");

    it("excludes vite.config.ts from analysis", () => {
      expect(result.scannedFiles.some((f) => f.endsWith("vite.config.ts"))).toBe(false);
      expect(result.graph.nodes.some((node) => node.type === "config")).toBe(false);
    });

    it("does not emit insights for config files", () => {
      const titles = insightTitles(result);
      expect(titles.some((t) => t.includes("vite.config"))).toBe(false);
    });
  });

  describe("safety guards", () => {
    it("refuses when file count exceeds maxFiles", () => {
      expect(() => analyzeSamples({ maxFiles: 1 })).toThrow(/Refusing to analyze/);
    });
  });
});
