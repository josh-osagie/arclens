import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeProject } from "../../src/analyzeProject";
import {
  buildCacheFile,
  getCachePath,
  isCacheEntryValid,
  partitionFilesByCache,
  readFileCache,
  readFileStat,
  toRelativeKey,
  writeFileCache,
  type FileCacheEntry,
} from "../../src/cache/fileCache";
import type { FileAnalysisPayload } from "../../src/extractFileAnalysis";
import { analyzeFixture } from "../helpers";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempProject(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arclens-cache-"));
  tempDirs.push(dir);

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(dir, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }

  return dir;
}

function samplePayload(filePath: string): FileAnalysisPayload {
  return {
    filePath,
    importEdges: [],
    exports: [
      {
        file: filePath,
        name: "Widget",
        exportKind: "named",
        kind: "FunctionDeclaration",
        type: "component",
      },
    ],
    renders: [],
    uses: [],
    hookRuleViolations: [],
    propsByNodeId: {},
    moduleType: "utility",
  };
}

describe("fileCache", () => {
  it("validates entries by mtime and size", () => {
    const dir = makeTempProject({
      "App.tsx": "export function App() { return null; }",
    });
    const filePath = path.join(dir, "App.tsx");
    const stat = readFileStat(filePath);

    const validEntry: FileCacheEntry = {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      data: samplePayload(filePath),
    };

    expect(isCacheEntryValid(validEntry, stat)).toBe(true);

    fs.appendFileSync(filePath, "\n");
    const changedStat = readFileStat(filePath);
    expect(isCacheEntryValid(validEntry, changedStat)).toBe(false);
  });

  it("partitions discovered files into cache hits and misses", () => {
    const dir = makeTempProject({
      "A.tsx": "export function A() { return null; }",
      "B.tsx": "export function B() { return null; }",
    });
    const fileA = path.join(dir, "A.tsx");
    const fileB = path.join(dir, "B.tsx");
    const statA = readFileStat(fileA);

    const cache = buildCacheFile(
      dir,
      [fileA, fileB],
      [samplePayload(fileA)],
      undefined
    );
    const partition = partitionFilesByCache(
      dir,
      [fileA, fileB],
      cache,
      undefined
    );

    expect(partition.cacheHits).toBe(1);
    expect(partition.cacheMisses).toBe(1);
    expect(partition.cached).toHaveLength(1);
    expect(partition.cached[0]?.filePath).toBe(fileA);
    expect(partition.toParse).toEqual([fileB]);
  });

  it("treats all files as misses when tsconfig key changes", () => {
    const dir = makeTempProject({
      "App.tsx": "export function App() { return null; }",
    });
    const filePath = path.join(dir, "App.tsx");
    const cache = buildCacheFile(
      dir,
      [filePath],
      [samplePayload(filePath)],
      "old-key"
    );

    const partition = partitionFilesByCache(dir, [filePath], cache, "new-key");
    expect(partition.cacheHits).toBe(0);
    expect(partition.toParse).toEqual([filePath]);
  });

  it("removes deleted files when rebuilding cache", () => {
    const dir = makeTempProject({
      "App.tsx": "export function App() { return null; }",
    });
    const filePath = path.join(dir, "App.tsx");
    const removedPath = path.join(dir, "Removed.tsx");
    const cachePath = getCachePath(dir);

    writeFileCache(cachePath, {
      version: 1,
      files: {
        [toRelativeKey(dir, filePath)]: {
          mtimeMs: readFileStat(filePath).mtimeMs,
          size: readFileStat(filePath).size,
          data: samplePayload(filePath),
        },
        [toRelativeKey(dir, removedPath)]: {
          mtimeMs: 1,
          size: 1,
          data: samplePayload(removedPath),
        },
      },
    });

    const rebuilt = buildCacheFile(
      dir,
      [filePath],
      [samplePayload(filePath)],
      undefined
    );
    writeFileCache(cachePath, rebuilt);

    const stored = readFileCache(cachePath);
    expect(Object.keys(stored?.files ?? {})).toEqual([
      toRelativeKey(dir, filePath),
    ]);
  });
});

describe("analyzeProject cache integration", () => {
  it("populates cache on first run and hits on second run", () => {
    const dir = makeTempProject({
      "Counter.tsx": `
        import { useState } from "react";
        export function Counter() {
          const [n, setN] = useState(0);
          return <button onClick={() => setN(n + 1)}>{n}</button>;
        }
      `,
    });

    const first = analyzeProject(dir, { cache: true });
    expect(first.cacheMisses).toBe(1);
    expect(first.cacheHits).toBe(0);
    expect(fs.existsSync(getCachePath(dir))).toBe(true);

    const second = analyzeProject(dir, { cache: true });
    expect(second.cacheHits).toBe(1);
    expect(second.cacheMisses).toBe(0);
    expect(second.graph.nodes.map((node) => node.name)).toEqual(
      first.graph.nodes.map((node) => node.name)
    );
  });

  it("re-parses changed files after mtime invalidation", () => {
    const dir = makeTempProject({
      "Widget.tsx": "export function Widget() { return null; }",
    });
    const filePath = path.join(dir, "Widget.tsx");

    analyzeProject(dir, { cache: true });

    fs.writeFileSync(
      filePath,
      "export function WidgetRenamed() { return null; }"
    );

    const result = analyzeProject(dir, { cache: true });
    expect(result.cacheMisses).toBe(1);
    expect(result.exports.some((exp) => exp.name === "WidgetRenamed")).toBe(
      true
    );
  });

  it("bypasses cache with cache: false", () => {
    const dir = makeTempProject({
      "App.tsx": "export function App() { return null; }",
    });

    analyzeProject(dir, { cache: true });
    const withoutCache = analyzeProject(dir, { cache: false });
    expect(withoutCache.cacheHits).toBe(0);
    expect(withoutCache.cacheMisses).toBe(1);
  });

  it("matches uncached fixture analysis results", () => {
    const uncached = analyzeFixture("default-export-app", { cache: false });
    const cached = analyzeFixture("default-export-app", { cache: true });
    analyzeFixture("default-export-app", { cache: true });

    expect(cached.graph.nodes.map((node) => node.id).sort()).toEqual(
      uncached.graph.nodes.map((node) => node.id).sort()
    );
    expect(cached.graph.edges.length).toBe(uncached.graph.edges.length);
  });

  it("reads legacy .react-atlas cache when .arclens is absent", () => {
    const dir = makeTempProject({
      "App.tsx": "export function App() { return null; }",
    });
    const filePath = path.join(dir, "App.tsx");
    const legacyCachePath = path.join(dir, ".react-atlas", "cache.json");

    writeFileCache(
      legacyCachePath,
      buildCacheFile(dir, [filePath], [samplePayload(filePath)], undefined)
    );

    const result = analyzeProject(dir, { cache: true });
    expect(result.cacheHits).toBe(1);
    expect(result.cacheMisses).toBe(0);
    expect(fs.existsSync(getCachePath(dir))).toBe(true);
  });
});
