import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const bash = process.env.SHELL || "bash";

function runBash(script: string): string {
  return execFileSync(bash, ["-lc", script], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      MSYS2_ARG_CONV_EXCL: "*",
    },
  }).trim();
}

describe("watch.sh argument parsing", () => {
  it("skips leading -- and keeps target plus extra args", () => {
    const out = runBash(`
      source scripts/common.sh
      set -- "--" "C:/Users/example/app" "-v"
      while [ "\${1:-}" = "--" ]; do shift; done
      TARGET="\$(normalize_target "\${1:-./samples}")"
      shift || true
      printf 'TARGET=%s\\nEXTRA=%s' "\$TARGET" "\$*"
    `);

    expect(out).toBe("TARGET=C:/Users/example/app\nEXTRA=-v");
  });

  it("expands tilde targets to absolute mixed Windows paths", () => {
    const out = runBash(`
      source scripts/common.sh
      normalize_target "~/projects/lendha/lendha_onboarding_app"
    `);

    expect(out).toMatch(/^[A-Za-z]:\//);
    expect(out).not.toContain("~");
    expect(out).not.toMatch(/^\/Users\//);
    expect(out).not.toMatch(/^\/c\//);
  });

  it("forces bash for chokidar when SHELL is unset", () => {
    const out = runBash(`
      source scripts/common.sh
      unset SHELL
      ensure_chokidar_shell
      printf '%s' "\$SHELL"
    `);

    expect(out).toMatch(/bash/);
  });
});
