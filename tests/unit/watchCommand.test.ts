import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getWatchGlobs } from "../../src/watchCommand";

const repoRoot = path.resolve(import.meta.dirname, "../..");

describe("watchCommand", () => {
  it("watches samples and analyzer source when target is samples", () => {
    const globs = getWatchGlobs(path.join(repoRoot, "samples"), repoRoot);

    expect(globs).toContain(path.join(repoRoot, "samples", "**", "*.{ts,tsx}"));
    expect(globs).toContain(path.join(repoRoot, "src", "**", "*.ts"));
  });

  it("watches src/ when the target has a src directory", () => {
    const dir = fs.mkdtempSync(path.join(repoRoot, ".tmp-watch-globs-src-"));
    try {
      fs.mkdirSync(path.join(dir, "src"));
      const globs = getWatchGlobs(dir, repoRoot);

      expect(globs).toEqual([path.join(dir, "src", "**", "*.{ts,tsx}")]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("watches the whole target tree when there is no src directory", () => {
    const dir = fs.mkdtempSync(path.join(repoRoot, ".tmp-watch-globs-"));
    try {
      const globs = getWatchGlobs(dir, repoRoot);
      expect(globs).toEqual([path.join(dir, "**", "*.{ts,tsx}")]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
