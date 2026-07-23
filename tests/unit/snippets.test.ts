import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSnippetApiUrl,
  isPathWithinRoot,
  parseSnippetLinesParam,
  readSnippetFromDisk,
  resolveRelativeFile,
  truncateLines,
  writeSnippetSidecar,
} from "../../src/snippets";

describe("snippets", () => {
  it("truncates content to a max line count", () => {
    const source = ["one", "two", "three", "four"].join("\n");
    const result = truncateLines(source, 2);

    expect(result.content).toBe("one\ntwo");
    expect(result.lineCount).toBe(2);
    expect(result.totalLines).toBe(4);
    expect(result.truncated).toBe(true);
  });

  it("resolves absolute and relative files under project root", () => {
    const root = path.join(os.tmpdir(), "react-atlas-snippet-root");
    const file = path.join(root, "src", "Button.tsx");

    expect(resolveRelativeFile(root, file)).toBe("src/Button.tsx");
    expect(resolveRelativeFile(root, "src/Button.tsx")).toBe("src/Button.tsx");
    expect(resolveRelativeFile(root, "../escape.ts")).toBeNull();
    expect(resolveRelativeFile(root, "external")).toBeNull();
  });

  it("blocks path traversal when reading snippets", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "react-atlas-snippet-"));
    expect(() => readSnippetFromDisk(root, "../secret.ts")).toThrow();
  });

  it("reads live files and falls back to sidecar copies", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "react-atlas-snippet-"));
    const sourcePath = path.join(root, "src", "App.tsx");
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, "line1\nline2\nline3\n", "utf8");

    const live = readSnippetFromDisk(root, "src/App.tsx", 2);
    expect(live.source).toBe("live");
    expect(live.content).toBe("line1\nline2");
    expect(live.truncated).toBe(true);

    writeSnippetSidecar(root, sourcePath, 2);
    fs.unlinkSync(sourcePath);

    const sidecar = readSnippetFromDisk(root, "src/App.tsx", 120);
    expect(sidecar.source).toBe("sidecar");
    expect(sidecar.content).toBe("line1\nline2");
  });

  it("builds encoded snippet API URLs", () => {
    expect(buildSnippetApiUrl("src/ui/Button.tsx", 120)).toBe(
      "/api/snippet?file=src%2Fui%2FButton.tsx&lines=120",
    );
  });

  it("caps snippet line params", () => {
    expect(parseSnippetLinesParam(undefined)).toBe(120);
    expect(parseSnippetLinesParam("80")).toBe(80);
    expect(parseSnippetLinesParam("9999")).toBe(500);
    expect(parseSnippetLinesParam("-1")).toBe(120);
  });

  it("detects paths within root", () => {
    const root = path.join(os.tmpdir(), "project");
    const inside = path.join(root, "src", "App.tsx");
    const outside = path.join(os.tmpdir(), "outside.ts");

    expect(isPathWithinRoot(root, inside)).toBe(true);
    expect(isPathWithinRoot(root, outside)).toBe(false);
  });
});
