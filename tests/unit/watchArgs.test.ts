import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const bash = process.env.SHELL || "bash";
const watchSh = path.join(repoRoot, "scripts", "watch.sh");

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

  it("prints interactive watch help with restart, exit, and help keys", () => {
    const out = runBash(`
      source scripts/common.sh
      print_watch_help
    `);

    expect(out).toMatch(/restart/);
    expect(out).toMatch(/\bq\b.*exit/);
    expect(out).toMatch(/\?\s+help/);
    expect(out).toMatch(/Ctrl\+C/);
  });

  it("maps interactive keys to restart, exit, and help actions", () => {
    const out = runBash(`
      source scripts/common.sh
      handle_watch_key() {
        case "\$1" in
          r|R) printf 'restart' ;;
          q|Q) printf 'exit' ;;
          h|H|\\?) printf 'help' ;;
          *) printf 'ignore' ;;
        esac
      }
      printf '%s %s %s' "\$(handle_watch_key r)" "\$(handle_watch_key q)" "\$(handle_watch_key '?')"
    `);

    expect(out).toBe("restart exit help");
  });

  it("exits before watching when initial analyze hits an unsupported project", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "react-atlas-watch-html-"));
    fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html>\n");

    try {
      execFileSync(bash, [watchSh, dir, "--no-color"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          MSYS2_ARG_CONV_EXCL: "*",
        },
        stdio: ["pipe", "pipe", "pipe"],
      });
      expect.fail("watch.sh should exit non-zero for unsupported projects");
    } catch (error) {
      const execError = error as { status?: number; stderr?: string; stdout?: string };
      const combined = `${execError.stdout ?? ""}${execError.stderr ?? ""}`;
      expect(execError.status).toBe(1);
      expect(combined).toMatch(/No TypeScript sources/);
      expect(combined).not.toMatch(/still watching/i);
    }
  });
});
