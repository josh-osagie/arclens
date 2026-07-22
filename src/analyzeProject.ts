import path from "node:path";
import { Project } from "ts-morph";
import { buildGraph } from "./buildGraph";
import {
  extractEdges,
  extractExports,
  extractHookUsages,
  extractRenders,
} from "./extractors/extracts";
import type { extractImportEdges } from "./extractors/exports";
import { findTsConfig } from "./resolveTarget";
import type { Graph } from "./types";

export type ImportEdge = ReturnType<typeof extractImportEdges>[number];

export type AnalysisResult = {
  targetDir: string;
  tsConfigPath: string | undefined;
  fileCount: number;
  graph: Graph;
  importEdges: ImportEdge[];
};

const IGNORED_PATH_PARTS = [
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}dist${path.sep}`,
  `${path.sep}build${path.sep}`,
  `${path.sep}.git${path.sep}`,
];

function isSafeSourceFile(filePath: string): boolean {
  return !IGNORED_PATH_PARTS.some((part) => filePath.includes(part));
}

/**
 * Static analysis entry point.
 * - ts-morph parses source text into an AST (same as your editor/tsc)
 * - analyzed code is NEVER imported, required, or executed
 * - only .ts / .tsx files under the target are read from disk
 */
export function analyzeProject(targetDir: string): AnalysisResult {
  const tsConfigPath = findTsConfig(targetDir);

  const project = new Project({
    tsConfigFilePath: tsConfigPath,
    skipAddingFilesFromTsConfig: true,
  });

  project.addSourceFilesAtPaths(`${targetDir.replace(/\\/g, "/")}/**/*.{ts,tsx}`);

  for (const sourceFile of [...project.getSourceFiles()]) {
    if (!isSafeSourceFile(sourceFile.getFilePath())) {
      project.removeSourceFile(sourceFile);
    }
  }

  const importEdges = extractEdges(project);
  const exports = extractExports(project);
  const renders = extractRenders(project);
  const hookUsages = extractHookUsages(project);

  const graph = buildGraph(importEdges, exports, renders, hookUsages);

  return {
    targetDir,
    tsConfigPath,
    fileCount: project.getSourceFiles().length,
    graph,
    importEdges,
  };
}
