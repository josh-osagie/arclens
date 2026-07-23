import path from "node:path";
import { Project } from "ts-morph";
import { discoverSourceFiles, formatDuration } from "./discoverFiles";
import { buildGraph } from "./buildGraph";
import { enrichGraph } from "./enrichGraph";
import {
  extractEdges,
  extractExports,
  extractHookUsages,
  extractRenders,
} from "./extractors/extracts";
import type {
  ExportRecord,
  extractHookUsage,
  extractImportEdges,
  extractJsxRenders,
} from "./extractors/exports";
import { applyModuleClassification, assessReactProject, type ReactAssessment } from "./reactAssessment";
import { detectHookRuleViolations, type HookRuleViolation } from "./extractors/hookRules";
import { extractComponentProps } from "./extractors/props";
import { findTsConfig } from "./resolveTarget";
import type { Graph } from "./types";

export type ImportEdge = ReturnType<typeof extractImportEdges>[number];
export type RenderEdge = ReturnType<typeof extractJsxRenders>[number];
export type UseEdge = ReturnType<typeof extractHookUsage>[number];

export type AnalyzeOptions = {
  maxFiles?: number;
  onProgress?: (message: string) => void;
};

export type AnalysisResult = {
  targetDir: string;
  tsConfigPath: string | undefined;
  fileCount: number;
  scannedFiles: string[];
  durationMs: number;
  graph: Graph;
  importEdges: ImportEdge[];
  exports: ExportRecord[];
  renders: RenderEdge[];
  uses: UseEdge[];
  hookRuleViolations: HookRuleViolation[];
  reactAssessment: ReactAssessment;
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
 */
export function analyzeProject(
  targetDir: string,
  options: AnalyzeOptions = {},
): AnalysisResult {
  const started = Date.now();
  const progress = options.onProgress ?? (() => undefined);
  const maxFiles = options.maxFiles ?? 3000;

  progress("Discovering TypeScript files…");
  const discoveredFiles = discoverSourceFiles(targetDir);

  if (discoveredFiles.length === 0) {
    throw new Error(`No .ts/.tsx files found under ${targetDir}`);
  }

  if (discoveredFiles.length > maxFiles) {
    throw new Error(
      `Refusing to analyze ${discoveredFiles.length} files (limit: ${maxFiles}). ` +
        "Scan a smaller folder (e.g. ./src) or pass --max-files to raise the limit.",
    );
  }

  progress(`Found ${discoveredFiles.length} files — parsing…`);

  const tsConfigPath = findTsConfig(targetDir);

  const project = new Project({
    tsConfigFilePath: tsConfigPath,
    skipAddingFilesFromTsConfig: true,
  });

  for (const filePath of discoveredFiles) {
    project.addSourceFileAtPath(filePath);
  }

  for (const sourceFile of [...project.getSourceFiles()]) {
    if (!isSafeSourceFile(sourceFile.getFilePath())) {
      project.removeSourceFile(sourceFile);
    }
  }

  const sourceFiles = project.getSourceFiles();
  progress(`Extracting relationships from ${sourceFiles.length} files…`);

  const importEdges = extractEdges(project);
  const exports = extractExports(project);
  const renders = extractRenders(project);
  const uses = extractHookUsages(project);

  progress("Building graph…");
  const graph = buildGraph(importEdges, exports, renders, uses);
  applyModuleClassification(sourceFiles, exports, graph);
  const propsByNodeId = extractComponentProps(sourceFiles, exports);
  const enrichedGraph = enrichGraph(graph, exports, propsByNodeId);

  progress("Checking Rules of Hooks…");
  const hookRuleViolations = detectHookRuleViolations(sourceFiles);

  const reactAssessment = assessReactProject({
    graph: enrichedGraph,
    exports,
    renders,
    uses,
    importEdges,
  });

  enrichedGraph.meta = {
    targetDir,
    isReactProject: reactAssessment.isReactProject,
    signals: reactAssessment.signals,
    ...(reactAssessment.message ? { notice: reactAssessment.message } : {}),
  };

  const durationMs = Date.now() - started;
  progress(`Done in ${formatDuration(durationMs)}`);

  return {
    targetDir,
    tsConfigPath,
    fileCount: sourceFiles.length,
    scannedFiles: sourceFiles.map((file) => file.getFilePath()),
    durationMs,
    graph: enrichedGraph,
    importEdges,
    exports,
    renders,
    uses,
    hookRuleViolations,
    reactAssessment,
  };
}
