import { beforeAll, describe, expect, it } from "vitest";
import { formatFocusReport } from "../../src/focus";
import { analyzeSamples } from "../helpers";
import type { AnalysisResult } from "../../src/analyzeProject";

describe("focus", () => {
  let result: AnalysisResult;

  beforeAll(async () => {
    result = await analyzeSamples();
  });

  it("shows incoming and outgoing connections for Button", async () => {
    const report = formatFocusReport(result, "Button", { color: false });

    expect(report).toContain("Focus: Button");
    expect(report).toContain("Rendered by");
    expect(report).toContain("Counter");
    expect(report).toContain("Imports");
    expect(report).toContain("Used by:");
  });

  it("lists known nodes when name is not found", async () => {
    const report = formatFocusReport(result, "NotARealComponent", {
      color: false,
    });

    expect(report).toContain('No node named "NotARealComponent" found');
    expect(report).toContain("Known nodes:");
    expect(report).toContain("Button");
  });
});
