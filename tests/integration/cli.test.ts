import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const cli = path.join(root, "src", "cli.ts");
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");

function runCli(args: string[]): string {
  return execFileSync(process.execPath, [tsxCli, cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
}

describe("CLI (developer workflow)", () => {
  it("analyze ./samples prints architecture summary to terminal", () => {
    const output = runCli(["analyze", "./samples", "--insights", "--no-color"]);

    expect(output).toContain("React Atlas");
    expect(output).toContain("Nodes:");
    expect(output).toContain("Relationships");
    expect(output).toContain("External libraries");
    expect(output).toContain("Static analysis only");
  });

  it("writes graph.json by default", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "react-atlas-cli-"));
    const samples = path.join(root, "samples");
    const graphPath = path.join(dir, "graph.json");

    runCli(["analyze", samples, "-o", graphPath, "-q", "--no-color"]);

    expect(fs.existsSync(graphPath)).toBe(true);
    const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
    expect(graph.nodes.length).toBeGreaterThan(0);
  });

  it("writes .txt vs .json reports based on extension", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "react-atlas-cli-"));
    const samples = path.join(root, "samples");
    const txt = path.join(dir, "out.txt");
    const json = path.join(dir, "out.json");

    runCli(["analyze", samples, "--report-file", txt, "-q", "--no-color"]);
    runCli(["analyze", samples, "--report-file", json, "-q", "--no-color"]);

    expect(fs.readFileSync(txt, "utf8")).toContain("React Atlas");
    expect(fs.readFileSync(json, "utf8").trimStart().startsWith("{")).toBe(true);
  });

  it("exits non-zero for invalid path", () => {
    expect(() => runCli(["analyze", "./not-a-real-path"])).toThrow();
  });
});
