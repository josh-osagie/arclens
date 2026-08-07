import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const bash = process.env.SHELL || "bash";
const analyzeOnce = path.join(repoRoot, "scripts", "analyze-once.sh");

type BashResult = {
  status: number;
  stdout: string;
  stderr: string;
};

function runBash(
  script: string,
  options: { expectFailure?: boolean; env?: NodeJS.ProcessEnv } = {}
): BashResult {
  try {
    const stdout = execFileSync(bash, ["-lc", script], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        MSYS2_ARG_CONV_EXCL: "*",
        ...options.env,
      },
    });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    if (!options.expectFailure) throw error;
    const execError = error as {
      status?: number;
      stdout?: string;
      stderr?: string;
    };
    return {
      status: execError.status ?? 1,
      stdout: execError.stdout ?? "",
      stderr: execError.stderr ?? "",
    };
  }
}

function runAnalyzeOnce(
  target: string,
  options: { watch?: boolean } = {}
): BashResult {
  const quotedTarget = JSON.stringify(target);
  const env = options.watch ? { ARCLENS_WATCH_TARGET: target } : undefined;
  return runBash(
    `bash ${JSON.stringify(analyzeOnce)} ${quotedTarget} --no-color`,
    {
      expectFailure: true,
      env,
    }
  );
}

describe("analyze-once.sh", () => {
  it("exits non-zero for unsupported projects without watch messaging", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arclens-analyze-once-"));
    fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html>\n");

    const result = runAnalyzeOnce(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/No TypeScript sources/);
    expect(result.stderr).not.toMatch(/still watching/i);
  });

  it("shows still-watching hint only for watch-mode re-analyze failures", () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "arclens-analyze-once-watch-")
    );
    fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html>\n");

    const result = runAnalyzeOnce(dir, { watch: true });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/still watching/i);
    expect(result.stderr).toMatch(/Press q to exit/i);
    expect(result.stderr).not.toMatch(/initial analysis failed/i);
  });
});
