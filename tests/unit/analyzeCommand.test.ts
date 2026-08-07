import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runAnalyze } from "../../src/analyzeCommand";

const root = process.cwd();
const samples = path.join(root, "samples");

describe("runAnalyze", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints the terminal report before attempting to write graph.json", () => {
    const originalWrite = fs.writeFileSync.bind(fs);
    const logs: string[] = [];
    const errors: string[] = [];

    vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args.join(" "));
    });
    vi.spyOn(fs, "writeFileSync").mockImplementation(
      (filePath, content, options) => {
        if (String(filePath).endsWith(`${path.sep}graph.json`)) {
          throw new Error("EPERM: operation not permitted");
        }
        return originalWrite(filePath, content, options as fs.WriteFileOptions);
      }
    );

    const status = runAnalyze(samples, {
      maxFiles: "3000",
      insights: true,
      quiet: false,
      color: false,
    });

    expect(status).toBe(1);
    expect(logs.join("\n")).toContain("Arclens");
    expect(logs.join("\n")).toContain("Summary");
    expect(errors.join("\n")).toMatch(/Could not write .*graph\.json/);
  });

  it("returns success when graph.json is written to a writable directory", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arclens-analyze-cmd-"));
    const graphPath = path.join(dir, "graph.json");
    const previousCwd = process.cwd();

    try {
      process.chdir(dir);
      const status = runAnalyze(samples, {
        maxFiles: "3000",
        output: graphPath,
        quiet: true,
        color: false,
      });

      expect(status).toBe(0);
      expect(fs.existsSync(graphPath)).toBe(true);
    } finally {
      process.chdir(previousCwd);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
