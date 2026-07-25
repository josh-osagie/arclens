import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CACHE_DIR,
  getWriteCacheFilePath,
  getWriteSnippetsDir,
  LEGACY_CACHE_DIR,
  resolveCacheFilePath,
  resolveSnippetSidecarPath,
} from "../../src/paths";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arclens-paths-"));
  tempDirs.push(dir);
  return dir;
}

describe("paths cache dir resolution", () => {
  it("writes to .arclens/cache.json", () => {
    const dir = makeTempDir();
    expect(getWriteCacheFilePath(dir)).toBe(
      path.join(dir, CACHE_DIR, "cache.json"),
    );
  });

  it("reads from .arclens when present", () => {
    const dir = makeTempDir();
    const cacheFile = getWriteCacheFilePath(dir);
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, "{}", "utf8");

    expect(resolveCacheFilePath(dir)).toBe(cacheFile);
  });

  it("falls back to .react-atlas when .arclens cache is absent", () => {
    const dir = makeTempDir();
    const legacyFile = path.join(dir, LEGACY_CACHE_DIR, "cache.json");
    fs.mkdirSync(path.dirname(legacyFile), { recursive: true });
    fs.writeFileSync(legacyFile, "{}", "utf8");

    expect(resolveCacheFilePath(dir)).toBe(legacyFile);
    expect(getWriteCacheFilePath(dir)).toBe(path.join(dir, CACHE_DIR, "cache.json"));
  });

  it("prefers .arclens over .react-atlas when both exist", () => {
    const dir = makeTempDir();
    const primaryFile = getWriteCacheFilePath(dir);
    const legacyFile = path.join(dir, LEGACY_CACHE_DIR, "cache.json");

    fs.mkdirSync(path.dirname(legacyFile), { recursive: true });
    fs.writeFileSync(legacyFile, '{"legacy":true}', "utf8");
    fs.mkdirSync(path.dirname(primaryFile), { recursive: true });
    fs.writeFileSync(primaryFile, '{"primary":true}', "utf8");

    expect(resolveCacheFilePath(dir)).toBe(primaryFile);
  });

  it("returns primary path when no cache exists", () => {
    const dir = makeTempDir();
    expect(resolveCacheFilePath(dir)).toBe(getWriteCacheFilePath(dir));
  });

  it("falls back to legacy snippet sidecars on read", () => {
    const dir = makeTempDir();
    const legacySidecar = path.join(dir, LEGACY_CACHE_DIR, "snippets", "src", "App.tsx");
    fs.mkdirSync(path.dirname(legacySidecar), { recursive: true });
    fs.writeFileSync(legacySidecar, "legacy snippet", "utf8");

    expect(resolveSnippetSidecarPath(dir, "src/App.tsx")).toBe(legacySidecar);
    expect(getWriteSnippetsDir(dir)).toBe(path.join(dir, CACHE_DIR, "snippets"));
  });
});
