import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { analyzeProject } from "../../src/analyzeProject";
import { buildInsights, countInsightsBySeverity } from "../../src/insights";
import {
  buildJsonReport,
  formatReport,
  getReportFormat,
  writeReportFile,
} from "../../src/report";
import { analyzeFixture, analyzeSamples } from "../helpers";
import type { AnalysisResult } from "../../src/analyzeProject";

describe("insights", () => {
  it("counts severities for terminal summary", async () => {
    const result = await analyzeSamples();
    const insights = buildInsights(result);
    const counts = countInsightsBySeverity(insights);

    expect(counts.warning + counts.info + counts.tip).toBeGreaterThanOrEqual(1);
  });

  it("references @eslint-react for hook violations", async () => {
    const result = await analyzeFixture("hooks-violation");
    const hookInsight = buildInsights(result).find((i) =>
      i.title.includes("Rules of Hooks")
    );
    expect(hookInsight?.eslintRule).toBe("@eslint-react/rules-of-hooks");
  });
});

describe("report", () => {
  let result: AnalysisResult;

  beforeAll(async () => {
    result = await analyzeSamples();
  });

  it("includes product-facing terminal sections", async () => {
    const text = formatReport(result, { insights: true, color: false });

    expect(text).toContain("Project:");
    expect(text).toContain("samples");
    expect(text).toContain("Summary");
    expect(text).toContain("Nodes by type");
    expect(text).toContain("Relationships");
    expect(text).toContain("External libraries");
    expect(text).toContain("Top connections");
    expect(text).toContain("Most referenced");
    expect(text).toContain("Insights");
    expect(text).toContain("react");
  });

  it("shows usage counts in Most referenced section", async () => {
    const text = formatReport(result, { insights: true, color: false });
    expect(text).toMatch(/Most referenced[\s\S]*incoming/);
  });

  it("detects report format from file extension", async () => {
    expect(getReportFormat("out.txt")).toBe("text");
    expect(getReportFormat("out.json")).toBe("json");
  });

  it("writes structured JSON report", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arclens-test-"));
    const jsonPath = path.join(dir, "report.json");

    writeReportFile(result, jsonPath, {
      graphOutput: null,
      reportOutput: jsonPath,
    });
    const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    expect(parsed.summary.nodes).toBeGreaterThan(0);
    expect(parsed.relationships.imports).toBeDefined();
    expect(parsed.insights.items.length).toBeGreaterThan(0);
    expect(parsed.graph.nodes.length).toBeGreaterThan(0);
  });

  it("writes human-readable text report", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arclens-test-"));
    const txtPath = path.join(dir, "report.txt");

    writeReportFile(result, txtPath, {
      graphOutput: null,
      reportOutput: txtPath,
    });
    const text = fs.readFileSync(txtPath, "utf8");

    expect(text).toContain("Arclens");
    expect(text.startsWith("{")).toBe(false);
  });
});

describe("graph output shape (viewer contract)", () => {
  it("produces nodes and edges for graph.json", async () => {
    const { graph } = await analyzeProject(path.join(process.cwd(), "samples"));

    expect(graph.meta?.projectName).toBe("samples");

    for (const node of graph.nodes) {
      expect(node.id).toContain("::");
      expect([
        "component",
        "hook",
        "utility",
        "context",
        "entry",
        "config",
      ]).toContain(node.type);
    }

    for (const edge of graph.edges) {
      expect(["imports", "renders", "uses"]).toContain(edge.type);
      expect(edge.from).toBeTruthy();
      expect(edge.to).toBeTruthy();
    }
  });

  it("buildJsonReport embeds graph for machine-readable pipelines", async () => {
    const result = await analyzeSamples();
    const json = buildJsonReport(result, { verbose: true, insights: true });

    expect(json.nodesByType.component.count).toBeGreaterThan(0);
    expect(json.mostReferenced.length).toBeGreaterThan(0);
    expect(json.verbose?.scannedFiles.length).toBe(5);
  });
});
