import path from "node:path";
import { Project } from "ts-morph";
import {
  buildCacheFile,
  CACHE_DIR,
  getCachePath,
  normalizePath,
  partitionFilesByCache,
  readFileCache,
  tsConfigCacheKey,
  writeFileCache,
} from "./cache/fileCache";
import { discoverSourceFiles, formatDuration } from "./discoverFiles";
import { buildGraph } from "./buildGraph";
import { enrichGraph } from "./enrichGraph";
import {
  extractFileAnalysis,
  mergeFilePayloads,
  type ImportEdge,
  type RenderEdge,
  type UseEdge,
} from "./extractFileAnalysis";
import type { ExportRecord } from "./extractors/exports";
import { applyModuleClassification, assessReactProject, type ReactAssessment } from "./reactAssessment";
import type { HookRuleViolation } from "./extractors/hookRules";
import { findTsConfig, resolveProjectName } from "./resolveTarget";
import type { Graph } from "./types";

export type { ImportEdge, RenderEdge, UseEdge };

export type AnalyzeOptions = {
  maxFiles?: number;
  onProgress?: (message: string) => void;
  cache?: boolean;
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
  cacheHits?: number;
  cacheMisses?: number;
};

const IGNORED_PATH_PARTS = [
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}dist${path.sep}`,
  `${path.sep}build${path.sep}`,
  `${path.sep}.git${path.sep}`,
  `${path.sep}${CACHE_DIR}${path.sep}`,
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
  const useCache = options.cache !== false;

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
  const tsConfigKey = tsConfigCacheKey(tsConfigPath);
  const cachePath = getCachePath(targetDir);

  let cacheHits = 0;
  let cacheMisses = discoveredFiles.length;

  const existingCache = useCache ? readFileCache(cachePath) : null;
  const partition = useCache
    ? partitionFilesByCache(targetDir, discoveredFiles, existingCache, tsConfigKey)
    : { cached: [], toParse: discoveredFiles, cacheHits: 0, cacheMisses: discoveredFiles.length };

  cacheHits = partition.cacheHits;
  cacheMisses = partition.cacheMisses;

  if (useCache && partition.cacheHits > 0) {
    progress(
      `Cache: ${partition.cacheHits} hit(s), ${partition.cacheMisses} miss(es) — parsing ${partition.toParse.length} file(s)…`,
    );
  }

  const project = new Project({
    tsConfigFilePath: tsConfigPath,
    skipAddingFilesFromTsConfig: true,
  });

  for (const filePath of partition.toParse) {
    project.addSourceFileAtPath(filePath);
  }

  for (const sourceFile of [...project.getSourceFiles()]) {
    if (!isSafeSourceFile(sourceFile.getFilePath())) {
      project.removeSourceFile(sourceFile);
    }
  }

  const freshPayloads = project.getSourceFiles().map(extractFileAnalysis);
  const payloadByFile = new Map(
    [...partition.cached, ...freshPayloads].map((payload) => [
      normalizePath(payload.filePath),
      payload,
    ]),
  );
  const allPayloads = discoveredFiles.flatMap((filePath) => {
    const payload = payloadByFile.get(normalizePath(filePath));
    return payload ? [payload] : [];
  });

  progress(`Extracting relationships from ${allPayloads.length} files…`);

  const merged = mergeFilePayloads(allPayloads);

  if (useCache) {
    const nextCache = buildCacheFile(targetDir, discoveredFiles, allPayloads, tsConfigKey);
    writeFileCache(cachePath, nextCache);
  }

  progress("Building graph…");
  const graph = buildGraph(
    merged.importEdges,
    merged.exports,
    merged.renders,
    merged.uses,
  );
  applyModuleClassification(merged.moduleTypeByFile, merged.exports, graph);
  const enrichedGraph = enrichGraph(graph, merged.exports, merged.propsByNodeId);

  progress("Checking Rules of Hooks…");

  const reactAssessment = assessReactProject({
    graph: enrichedGraph,
    exports: merged.exports,
    renders: merged.renders,
    uses: merged.uses,
    importEdges: merged.importEdges,
  });

  enrichedGraph.meta = {
    targetDir,
    projectName: resolveProjectName(targetDir),
    isReactProject: reactAssessment.isReactProject,
    signals: reactAssessment.signals,
    ...(reactAssessment.message ? { notice: reactAssessment.message } : {}),
  };

  const durationMs = Date.now() - started;
  progress(`Done in ${formatDuration(durationMs)}`);

  return {
    targetDir,
    tsConfigPath,
    fileCount: merged.scannedFiles.length,
    scannedFiles: merged.scannedFiles,
    durationMs,
    graph: enrichedGraph,
    importEdges: merged.importEdges,
    exports: merged.exports,
    renders: merged.renders,
    uses: merged.uses,
    hookRuleViolations: merged.hookRuleViolations,
    reactAssessment,
    cacheHits,
    cacheMisses,
  };
}
