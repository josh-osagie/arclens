import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverSourceFiles } from "../../src/discoverFiles";
import { findTsConfig, resolveTarget } from "../../src/resolveTarget";
import { fixturesDir } from "../helpers";

describe("discoverFiles", () => {
  it("finds .ts and .tsx under a directory", () => {
    const files = discoverSourceFiles(path.join(fixturesDir, "default-export-app"));
    expect(files.some((f) => f.endsWith("App.tsx"))).toBe(true);
    expect(files.some((f) => f.endsWith("main.tsx"))).toBe(true);
  });

  it("skips config and declaration files", () => {
    const files = discoverSourceFiles(path.join(fixturesDir, "with-config"));
    expect(files.some((f) => f.endsWith("vite.config.ts"))).toBe(false);
    expect(files.some((f) => f.endsWith("App.tsx"))).toBe(true);
  });
});

describe("resolveTarget", () => {
  it("resolves relative paths to absolute directories", () => {
    const target = resolveTarget("./samples");
    expect(path.isAbsolute(target)).toBe(true);
    expect(fs.statSync(target).isDirectory()).toBe(true);
  });

  it("rejects non-existent paths", () => {
    expect(() => resolveTarget("./does-not-exist-xyz")).toThrow(/does not exist/);
  });

  it("refuses node_modules as target", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "react-atlas-resolve-"));
    const nm = path.join(dir, "node_modules");
    fs.mkdirSync(nm);
    expect(() => resolveTarget(nm)).toThrow(/Refusing to analyze/);
  });
});

describe("findTsConfig", () => {
  it("finds tsconfig in fixture folder", () => {
    const config = findTsConfig(path.join(fixturesDir, "default-export-app"));
    expect(config).toMatch(/tsconfig\.json$/);
  });
});
