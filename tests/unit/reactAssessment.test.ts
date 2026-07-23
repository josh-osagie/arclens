import { describe, expect, it } from "vitest";
import { Project } from "ts-morph";
import { assessReactProject } from "../../src/reactAssessment";
import type { AnalysisResult } from "../../src/analyzeProject";

function mockResult(partial: Partial<AnalysisResult>): AnalysisResult {
  return {
    targetDir: "/project",
    tsConfigPath: undefined,
    fileCount: 1,
    scannedFiles: [],
    durationMs: 1,
    graph: { nodes: [], edges: [] },
    importEdges: [],
    exports: [],
    renders: [],
    uses: [],
    hookRuleViolations: [],
    reactAssessment: { isReactProject: true, signals: [] },
    ...partial,
  };
}

describe("assessReactProject", () => {
  it("detects React projects with components", () => {
    const result = mockResult({
      graph: {
        nodes: [
          {
            id: "a::App",
            name: "App",
            file: "/a/App.tsx",
            type: "component",
            connections: { incoming: [], outgoing: [] },
            stats: { incoming: 0, outgoing: 0 },
          },
        ],
        edges: [],
      },
    });

    expect(assessReactProject(result).isReactProject).toBe(true);
  });

  it("warns when no React signals are found", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/utils/math.ts", `export function add(a: number, b: number) { return a + b; }`);

    const result = mockResult({
      exports: [
        {
          file: "/utils/math.ts",
          name: "add",
          exportKind: "named",
          kind: "FunctionDeclaration",
          type: "utility",
        },
      ],
      graph: {
        nodes: [
          {
            id: "/utils/math.ts::add",
            name: "add",
            file: "/utils/math.ts",
            type: "utility",
            connections: { incoming: [], outgoing: [] },
            stats: { incoming: 0, outgoing: 0 },
          },
        ],
        edges: [],
      },
    });

    const assessment = assessReactProject(result);
    expect(assessment.isReactProject).toBe(false);
    expect(assessment.message).toMatch(/may not be a React app/);
  });
});
