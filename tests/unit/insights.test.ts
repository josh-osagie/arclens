import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeProject } from "../../src/analyzeProject";
import { analyzeSamples } from "../helpers";
import {
  buildInsights,
  hookRuleViolationsToInsights,
} from "../../src/insights";
import type { ExportRecord } from "../../src/extractors/exports";
import type { GraphEdge, GraphNode } from "../../src/types";
import { nodeId } from "../../src/extractors/find";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempApp(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arclens-insights-"));
  tempDirs.push(dir);

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(dir, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }

  return dir;
}

function graphNode(
  name: string,
  file: string,
  type: GraphNode["type"]
): GraphNode {
  return {
    id: nodeId({
      file,
      name,
      exportKind: "named",
      kind: "FunctionDeclaration",
      type,
    }),
    name,
    file,
    type,
    connections: { incoming: [], outgoing: [] },
    stats: { incoming: 0, outgoing: 0 },
  };
}

describe("buildInsights gates", () => {
  it("does not warn component or hook naming for samples", async () => {
    const result = await analyzeSamples();
    const titles = buildInsights(result).map((insight) => insight.title);

    expect(titles.some((title) => title.includes("Component naming:"))).toBe(
      false
    );
    expect(titles.some((title) => title.includes("Hook naming:"))).toBe(false);
  });

  it("skips component naming when symbol is never rendered as JSX", async () => {
    const file = "/src/components/ErrorHandler.tsx";
    const exports: ExportRecord[] = [
      {
        file,
        name: "generateFileError",
        exportKind: "named",
        kind: "FunctionDeclaration",
        type: "component",
      },
    ];
    const nodes = [graphNode("generateFileError", file, "component")];
    const edges: GraphEdge[] = [];

    const samplesResult = await analyzeSamples();
    const titles = buildInsights({
      ...samplesResult,
      graph: { nodes, edges },
      exports,
      importEdges: [],
    }).map((insight) => insight.title);

    expect(
      titles.some((title) =>
        title.includes("Component naming: generateFileError")
      )
    ).toBe(false);
  });

  it("excludes exported types/interfaces from nodes and orphan insights while preserving component props", async () => {
    const dir = makeTempApp({
      "tsconfig.json": JSON.stringify({
        compilerOptions: { jsx: "react-jsx", module: "ESNext", moduleResolution: "bundler", target: "ES2020" },
        include: ["src/**/*"],
      }),
      "src/components/auth/AuthCard.tsx": `
        export interface AuthCardProps {
          title: string;
          subtitle?: string;
        }
        export type AuthMode = "login" | "signup";
        export function AuthCard({ title, subtitle }: AuthCardProps) {
          return <section><h1>{title}</h1><p>{subtitle}</p></section>;
        }
      `,
      "src/components/auth/index.ts": `
        export * from "./AuthCard";
      `,
      "src/hooks/useDashboard.ts": `
        import { useState } from "react";
        export function useDashboard() {
          const [ready] = useState(true);
          return { ready };
        }
      `,
      "src/components/ui/button.tsx": `
        export const buttonVariants = () => "btn";
        export function Button() {
          return <button className={buttonVariants()} />;
        }
      `,
      "src/main.tsx": `
        import { createRoot } from "react-dom/client";
        import { AuthCard } from "./components/auth";
        import { Button } from "./components/ui/button";
        import { useDashboard } from "./hooks/useDashboard";
        function App() {
          const { ready } = useDashboard();
          return ready ? <><AuthCard title="Hi" /><Button /></> : null;
        }
        createRoot(document.getElementById("root")!).render(<App />);
      `,
    });

    const result = await analyzeProject(dir, { cache: false });
    const nodeNames = result.graph.nodes.map((n) => n.name);
    const titles = buildInsights(result).map((i) => i.title);

    expect(nodeNames).not.toContain("AuthCardProps");
    expect(nodeNames).not.toContain("AuthMode");
    expect(result.graph.nodes.filter((n) => n.name === "AuthCard")).toHaveLength(1);

    const authCard = result.graph.nodes.find((n) => n.name === "AuthCard");
    expect(authCard?.props?.map((p) => p.name)).toEqual(["title", "subtitle"]);

    expect(titles).not.toContain("Orphan export: AuthCardProps");
    expect(titles).not.toContain("Orphan export: AuthMode");
    expect(titles).not.toContain("Orphan export: AuthCard");
    expect(titles).not.toContain("Orphan export: buttonVariants");
    expect(titles).not.toContain("Orphan export: useDashboard");

    // Local hook resolved cleanly without creating an external::useDashboard node
    expect(result.graph.nodes.some((n) => n.id === "external::useDashboard")).toBe(false);
    expect(result.graph.nodes.some((n) => n.id === "external::useState")).toBe(true);
    expect(
      result.graph.edges.some(
        (e) =>
          e.type === "uses" &&
          e.to.endsWith("useDashboard.ts::useDashboard")
      )
    ).toBe(true);
  });
});

describe("hookRuleViolationsToInsights", () => {
  it("groups duplicate hook violations in the same file", async () => {
    const file = "/src/features/LoanApply.tsx";
    const insights = hookRuleViolationsToInsights([
      {
        hook: "useFormik",
        file,
        line: 42,
        context: "after an early return",
        eslintRule: "@eslint-react/rules-of-hooks",
      },
      {
        hook: "useFormik",
        file,
        line: 78,
        context: "after an early return",
        eslintRule: "@eslint-react/rules-of-hooks",
      },
    ]);

    expect(insights).toHaveLength(1);
    expect(insights[0]?.title).toBe(
      "Rules of Hooks: 2× useFormik called after an early return"
    );
    expect(insights[0]?.detail).toContain("At lines 42, 78.");
  });

  it("keeps separate insights for different hooks or contexts", async () => {
    const file = "/src/Comp.tsx";
    const insights = hookRuleViolationsToInsights([
      {
        hook: "useFormik",
        file,
        line: 10,
        context: "after an early return",
        eslintRule: "@eslint-react/rules-of-hooks",
      },
      {
        hook: "useState",
        file,
        line: 20,
        context: "after an early return",
        eslintRule: "@eslint-react/rules-of-hooks",
      },
    ]);

    expect(insights).toHaveLength(2);
    expect(insights.every((insight) => !insight.title.includes("×"))).toBe(
      true
    );
  });
});
