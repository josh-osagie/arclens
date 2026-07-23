import { describe, expect, it } from "vitest";
import { highlightLine } from "../../viewer/src/highlightLine";

describe("highlightLine", () => {
  it("returns a space for empty lines", () => {
    expect(highlightLine("")).toEqual([{ key: "empty", text: " " }]);
  });

  it("does not throw on lines with comments (matchAll requires global regex)", () => {
    expect(() => highlightLine("// comment")).not.toThrow();
    expect(() => highlightLine("const x = 1; // trailing")).not.toThrow();
    expect(() => highlightLine("/* block */")).not.toThrow();
  });

  it("highlights keywords and strings", () => {
    const parts = highlightLine('import React from "react"');
    const classes = parts.filter((part) => part.className).map((part) => part.className);
    expect(classes).toContain("snippet-token--keyword");
    expect(classes).toContain("snippet-token--string");
  });

  it("highlights line comments", () => {
    const parts = highlightLine("// TODO: fix");
    const comment = parts.find((part) => part.className === "snippet-token--comment");
    expect(comment?.text).toBe("// TODO: fix");
  });

  it("reconstructs the original line text", () => {
    const line = 'const count = 42; // answer';
    const parts = highlightLine(line);
    expect(parts.map((part) => part.text).join("")).toBe(line);
  });
});
