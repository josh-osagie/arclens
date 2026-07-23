import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverSourceFiles } from "../../src/discoverFiles";
import { findTsConfig, resolveProjectName, resolveTarget } from "../../src/resolveTarget";
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

  it("skips .react-atlas snippet sidecars", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "react-atlas-discover-"));
    fs.writeFileSync(path.join(dir, "App.tsx"), "export const App = () => null;\n");
    const sidecarDir = path.join(dir, ".react-atlas", "snippets");
    fs.mkdirSync(sidecarDir, { recursive: true });
    fs.writeFileSync(path.join(sidecarDir, "App.tsx"), "export const App = () => null;\n");

    const files = discoverSourceFiles(dir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/App\.tsx$/);
    expect(files[0]).not.toContain(".react-atlas");
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

describe("resolveProjectName", () => {
  it("uses package.json name when present", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "react-atlas-name-"));
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "my-cool-app" }),
    );

    expect(resolveProjectName(dir)).toBe("my-cool-app");
  });

  it("falls back to directory basename without package.json", () => {
    const dir = path.join(fixturesDir, "default-export-app");
    expect(resolveProjectName(dir)).toBe("default-export-app");
  });
});
