import { describe, expect, it } from "vitest";
import { Project, SyntaxKind } from "ts-morph";
import {
  classifyExport,
  isConfigFile,
  isReactFunctionNode,
  nodeCallsHooks,
  nodeHasJsx,
  resolveDefaultExportName,
} from "../../src/extractors/reactFunction";
import { dedupeExports, type ExportRecord } from "../../src/extractors/exports";

function parseExport(source: string, exportName = "default") {
  const project = new Project({ useInMemoryFileSystem: true });
  const file = project.createSourceFile("/test.tsx", source);
  const exported = file.getExportedDeclarations();
  const declarations = exported.get(exportName) ?? [];
  return { declarations, file };
}

describe("reactFunction", () => {
  describe("nodeHasJsx / nodeCallsHooks", () => {
    it("detects JSX in arrow components", () => {
      const { declarations } = parseExport(
        `export const X = () => <div />;`,
        "X",
      );
      expect(nodeHasJsx(declarations[0]!)).toBe(true);
      expect(nodeCallsHooks(declarations[0]!)).toBe(false);
    });

    it("detects hook calls in custom hooks", () => {
      const { declarations } = parseExport(
        `export function useAuth() { return useState(0); }`,
        "useAuth",
      );
      expect(nodeCallsHooks(declarations[0]!)).toBe(true);
      expect(nodeHasJsx(declarations[0]!)).toBe(false);
    });
  });

  describe("classifyExport", () => {
    it("classifies lowercase JSX functions as components", () => {
      const { declarations } = parseExport(
        `export const counter = () => <div />;`,
        "counter",
      );
      expect(classifyExport("counter", declarations)).toBe("component");
    });

    it("classifies use-prefixed hook exports", () => {
      const { declarations } = parseExport(
        `export function useCounter() { return useState(0); }`,
        "useCounter",
      );
      expect(classifyExport("useCounter", declarations)).toBe("hook");
    });

    it("classifies plain API helpers as utility", () => {
      const { declarations } = parseExport(
        `export async function fetchUser(id: string) { return fetch(id); }`,
        "fetchUser",
      );
      expect(classifyExport("fetchUser", declarations)).toBe("utility");
    });
  });

  describe("resolveDefaultExportName", () => {
    it("resolves export default function App()", () => {
      const { declarations, file } = parseExport(
        `export default function App() { return null; }`,
      );
      expect(resolveDefaultExportName(declarations[0], file.getFilePath())).toBe("App");
    });

    it("resolves export default Identifier", () => {
      const { declarations, file } = parseExport(
        `const Hero = () => null;\nexport default Hero;`,
      );
      expect(resolveDefaultExportName(declarations[0], file.getFilePath())).toBe("Hero");
    });

    it("falls back to filename when anonymous", () => {
      const { declarations, file } = parseExport(
        `export default () => null;`,
      );
      expect(resolveDefaultExportName(declarations[0], file.getFilePath())).toBe("test");
    });
  });

  describe("dedupeExports", () => {
    it("prefers named export over default when both resolve to same symbol", () => {
      const records: ExportRecord[] = [
        {
          file: "/Hero.tsx",
          name: "Hero",
          exportKind: "default",
          kind: "Identifier",
          type: "component",
        },
        {
          file: "/Hero.tsx",
          name: "Hero",
          exportKind: "named",
          kind: "VariableDeclaration",
          type: "component",
        },
      ];

      const deduped = dedupeExports(records);
      expect(deduped).toHaveLength(1);
      expect(deduped[0]?.exportKind).toBe("named");
    });
  });

  describe("isConfigFile", () => {
    it("matches vite and other config files", () => {
      expect(isConfigFile("/project/vite.config.ts")).toBe(true);
      expect(isConfigFile("/project/jest.config.js")).toBe(true);
      expect(isConfigFile("/project/src/App.tsx")).toBe(false);
    });
  });

  describe("isReactFunctionNode", () => {
    it("treats JSX functions as React roots regardless of casing", () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        "/c.tsx",
        `export const counter = () => <div />;`,
      );
      const arrow = file.getDescendantsOfKind(SyntaxKind.ArrowFunction)[0]!;
      expect(isReactFunctionNode(arrow)).toBe(true);
    });
  });
});
