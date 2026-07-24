import type { AnalysisResult } from "./analyzeProject";
import type { ExportRecord } from "./extractors/exports";
import { isConfigFile } from "./extractors/reactFunction";
import type { Graph, GraphNodeType } from "./types";

export type ReactAssessment = {
  isReactProject: boolean;
  signals: string[];
  message?: string;
};

export function applyModuleClassification(
  moduleTypeByFile: Map<string, GraphNodeType>,
  exports: ExportRecord[],
  graph: Graph,
): void {
  for (const exp of exports) {
    if (isConfigFile(exp.file)) {
      exp.type = "config";
      continue;
    }

    const moduleType = moduleTypeByFile.get(exp.file);
    if (moduleType && exp.type === "utility") {
      exp.type = moduleType;
    }
  }

  for (const node of graph.nodes) {
    if (isConfigFile(node.file)) {
      node.type = "config";
      continue;
    }

    const moduleType = moduleTypeByFile.get(node.file);
    if (moduleType && node.type === "utility") {
      node.type = moduleType;
    }
  }
}

export function assessReactProject(
  result: Pick<AnalysisResult, "graph" | "exports" | "renders" | "uses" | "importEdges">,
): ReactAssessment {
  const components = result.graph.nodes.filter((node) => node.type === "component");
  const hasRenders = result.renders.length > 0;
  const hasHookUses = result.uses.length > 0;
  const hasEntry = result.graph.nodes.some((node) => node.type === "entry");
  const hasReactImports = result.importEdges.some(
    (edge) =>
      edge.to === "react" ||
      edge.to.startsWith("react/") ||
      edge.to.startsWith("react-dom") ||
      edge.to.startsWith("react-native"),
  );

  const signals: string[] = [];
  if (components.length > 0) signals.push(`${components.length} component(s)`);
  if (hasRenders) signals.push("JSX render edges");
  if (hasHookUses) signals.push("hook usage");
  if (hasEntry) signals.push("entry/bootstrap file");
  if (hasReactImports) signals.push("react imports");

  const isReactProject =
    components.length > 0 || hasRenders || hasHookUses || hasEntry;

  if (!isReactProject) {
    return {
      isReactProject: false,
      signals,
      message:
        "No React components, JSX, hooks, or entry files detected. " +
        "This folder may not be a React app - try pointing at src/ or a package that uses React.",
    };
  }

  return { isReactProject: true, signals };
}
