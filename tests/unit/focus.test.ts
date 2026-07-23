import { describe, expect, it } from "vitest";
import { formatFocusReport } from "../../src/focus";
import { analyzeSamples } from "../helpers";

describe("focus", () => {
  const result = analyzeSamples();

  it("shows incoming and outgoing connections for Button", () => {
    const report = formatFocusReport(result, "Button", { color: false });

    expect(report).toContain("Focus: Button");
    expect(report).toContain("Rendered by");
    expect(report).toContain("Counter");
    expect(report).toContain("Imports");
    expect(report).toContain("Usage:");
  });

  it("lists known nodes when name is not found", () => {
    const report = formatFocusReport(result, "NotARealComponent", { color: false });

    expect(report).toContain('No node named "NotARealComponent" found');
    expect(report).toContain("Known nodes:");
    expect(report).toContain("Button");
  });
});
