import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const cli = path.join(root, "src", "cli.ts");
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");

function runCli(
  args: string[],
  options: { expectFailure?: boolean } = {}
): { output: string; status: number } {
  try {
    const output = execFileSync(process.execPath, [tsxCli, cli, ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "0" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { output, status: 0 };
  } catch (error) {
    if (!options.expectFailure) throw error;
    const execError = error as {
      status?: number;
      stdout?: string;
      stderr?: string;
    };
    return {
      output: `${execError.stdout ?? ""}${execError.stderr ?? ""}`,
      status: execError.status ?? 1,
    };
  }
}

describe("CLI (developer workflow)", () => {
  it("analyze ./samples prints architecture summary to terminal", () => {
    const { output } = runCli([
      "analyze",
      "./samples",
      "--insights",
      "--no-color",
    ]);

    expect(output).toContain("Arclens");
    expect(output).toContain("Project:");
    expect(output).toContain("samples");
    expect(output).toContain("Nodes:");
    expect(output).toContain("Relationships");
    expect(output).toContain("External libraries");
    expect(output).toContain("Static analysis only");
  });

  it("writes graph.json by default", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arclens-cli-"));
    const samples = path.join(root, "samples");
    const graphPath = path.join(dir, "graph.json");

    runCli(["analyze", samples, "-o", graphPath, "-q", "--no-color"]);

    expect(fs.existsSync(graphPath)).toBe(true);
    const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.meta.projectName).toBe("samples");
  });

  it("writes .txt vs .json reports based on extension", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arclens-cli-"));
    const samples = path.join(root, "samples");
    const txt = path.join(dir, "out.txt");
    const json = path.join(dir, "out.json");

    runCli(["analyze", samples, "--report-file", txt, "-q", "--no-color"]);
    runCli(["analyze", samples, "--report-file", json, "-q", "--no-color"]);

    expect(fs.readFileSync(txt, "utf8")).toContain("Arclens");
    expect(fs.readFileSync(json, "utf8").trimStart().startsWith("{")).toBe(
      true
    );
  });

  it("exits non-zero for invalid path", () => {
    expect(() => runCli(["analyze", "./not-a-real-path"])).toThrow();
  });

  it("explains when the target has no TypeScript sources", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arclens-cli-html-"));
    fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html>\n");

    const { output, status } = runCli(["analyze", dir, "--no-color"], {
      expectFailure: true,
    });

    expect(status).toBe(1);
    expect(output).toMatch(/No TypeScript sources/);
    expect(output).toMatch(/HTML-only/);
    expect(output).toMatch(/not supported yet/);
    expect(output).toMatch(/HTML file/);
  });

  it("registers watch and view subcommands", () => {
    const { output: watchHelp } = runCli(["watch", "-h"]);
    expect(watchHelp).toContain("Re-run analyze when .ts/.tsx files change");
    expect(watchHelp).toContain("--insights");

    const { output: viewHelp } = runCli(["view", "-h"]);
    expect(viewHelp).toContain("Open the architecture graph viewer");
    expect(viewHelp).toContain("--graph");
  });

  it("prints an ascii version banner for -v and --version", () => {
    const short = runCli(["-v"]);
    const long = runCli(["--version"]);

    for (const { output } of [short, long]) {
      expect(output).toContain("Version");
      expect(output).toContain("Interactive architecture explorer");
      expect(output).toMatch(/Version \d+\.\d+\.\d+/);
    }
  });

  it("registers update subcommand", () => {
    const { output } = runCli(["update", "-h"]);
    expect(output).toContain("update a global npm install");
  });
});
