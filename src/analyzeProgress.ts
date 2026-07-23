import fs from "node:fs";
import path from "node:path";
import ora, { type Ora } from "ora";
import pc from "picocolors";
import { formatDuration } from "./discoverFiles";

export const LARGE_PROJECT_THRESHOLD = 1000;
export const PARSE_UPDATE_BATCH = 25;
export const VERBOSE_CACHE_FILE_LIMIT = 50;
export const PHASE_HEARTBEAT_MS = 3000;

/** Per-file parse progress verbs — cycled by file index so consecutive lines vary. */
export const FILE_ACTION_VERBS = [
  "Cooking",
  "Whisking",
  "Scanning",
  "Unpacking",
  "Distilling",
  "Mapping",
  "Tracing",
  "Forging",
  "Inspecting",
  "Decoding",
  "Harvesting",
  "Stitching",
  "Weaving",
  "Charting",
  "Cataloging",
  "Sifting",
  "Probing",
  "Extracting",
  "Indexing",
  "Surveying",
  "Untangling",
  "Parsing",
  "Reading",
  "Analyzing",
] as const;

const CACHE_HIT_VERBS = [
  "Recalling",
  "Reusing",
  "Serving",
  "Retrieving",
  "Pulling",
] as const;

const START_VERBS = ["Charting", "Mapping", "Surveying", "Tracing"] as const;

const PARSE_PHASE_VERBS = ["Distilling", "Decoding", "Sifting", "Forging"] as const;

const MERGE_PHASE_VERBS = ["Stitching", "Weaving", "Linking", "Connecting"] as const;

export function pickCycledVerb<T extends readonly string[]>(
  verbs: T,
  index: number,
): T[number] {
  return verbs[(index - 1) % verbs.length]!;
}

function pickSeededVerb<T extends readonly string[]>(verbs: T, seed: string): T[number] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % verbs.length;
  }
  return verbs[hash]!;
}

export type AnalyzeProgressReporterOptions = {
  quiet?: boolean;
  verbose?: boolean;
  reanalyze?: boolean;
  color?: boolean;
};

export type AnalyzeProgressReporter = {
  start: (projectName: string, targetDir: string) => void;
  discoveryScan: (targetDir: string) => void;
  discoveryDone: (fileCount: number) => void;
  cacheSummary: (hits: number, misses: number) => void;
  parseFile: (filePath: string, current: number, total: number, targetDir: string) => void;
  cachedFile: (filePath: string, current: number, total: number, targetDir: string) => void;
  phase: (message: string) => void;
  complete: (nodes: number, edges: number, durationMs: number) => void;
  fail: (message: string) => void;
  stop: () => void;
};

function createColors(enabled: boolean) {
  if (!enabled) {
    return new Proxy(pc, { get: () => (value: string) => value });
  }
  return pc;
}

export function formatTargetLabel(
  projectName: string,
  targetDir: string,
  cwd = process.cwd(),
): string {
  const rel = path.relative(cwd, targetDir) || path.basename(targetDir);
  return `${projectName} (${rel})`;
}

export function formatDiscoveryPattern(targetDir: string, cwd = process.cwd()): string {
  const rel = path.relative(cwd, targetDir) || ".";
  if (rel === ".") return "**/*.{ts,tsx}";
  return `${rel}/**/*.{ts,tsx}`;
}

export function formatDiscoveryScan(targetDir: string, cwd = process.cwd()): string {
  const pattern = formatDiscoveryPattern(targetDir, cwd);
  return `Sweeping ${pattern}...`;
}

export function formatDiscoveryDone(fileCount: number): string {
  return `Harvested ${fileCount} TypeScript file${fileCount === 1 ? "" : "s"}`;
}

export function formatCacheSummary(hits: number, misses: number): string {
  if (hits === 0 && misses === 0) return "Cache: empty";
  if (hits === 0) return `Cache: ${misses} miss${misses === 1 ? "" : "es"}`;
  if (misses === 0) return `Cache: ${hits} hit${hits === 1 ? "" : "s"}`;
  return `Cache: ${hits} hit${hits === 1 ? "" : "s"}, ${misses} miss${misses === 1 ? "" : "es"}`;
}

export function formatRelativeFile(
  filePath: string,
  targetDir: string,
  cwd = process.cwd(),
): string {
  const fromTarget = path.relative(targetDir, filePath);
  if (fromTarget && !fromTarget.startsWith("..")) return fromTarget;
  return path.relative(cwd, filePath) || path.basename(filePath);
}

export function formatParseProgress(
  filePath: string,
  current: number,
  total: number,
  targetDir: string,
  cwd = process.cwd(),
): string {
  const display = formatRelativeFile(filePath, targetDir, cwd);
  const verb = pickCycledVerb(FILE_ACTION_VERBS, current);
  return `${verb} ${display} (${current}/${total})...`;
}

export function formatCachedFileProgress(
  filePath: string,
  current: number,
  total: number,
  targetDir: string,
  cwd = process.cwd(),
): string {
  const display = formatRelativeFile(filePath, targetDir, cwd);
  const verb = pickCycledVerb(CACHE_HIT_VERBS, current);
  return `${verb} ${display} (${current}/${total})...`;
}

export function formatCacheLoadPhase(): string {
  return "Unpacking cache...";
}

export function formatParsePhase(fileCount: number): string {
  const verb = pickCycledVerb(PARSE_PHASE_VERBS, fileCount);
  return `${verb} ${fileCount} source file${fileCount === 1 ? "" : "s"}...`;
}

export function formatMergePhase(fileCount: number): string {
  const verb = pickCycledVerb(MERGE_PHASE_VERBS, fileCount);
  return `${verb} relationships from ${fileCount} file${fileCount === 1 ? "" : "s"}...`;
}

export function formatBuildGraphPhase(): string {
  return "Mapping dependency graph...";
}

export function formatEnrichGraphPhase(): string {
  return "Cataloging graph metadata...";
}

export function formatHooksCheckPhase(): string {
  return "Inspecting Rules of Hooks...";
}

export function shouldUpdateFileProgress(
  current: number,
  total: number,
  lastUpdate: number,
): boolean {
  if (total < LARGE_PROJECT_THRESHOLD) return true;
  if (current === 1 || current === total) return true;
  return current - lastUpdate >= PARSE_UPDATE_BATCH;
}

export function formatComplete(nodes: number, edges: number, durationMs: number): string {
  return `Done — ${nodes} node${nodes === 1 ? "" : "s"}, ${edges} edge${edges === 1 ? "" : "s"} in ${formatDuration(durationMs)}`;
}

export function formatStartMessage(
  projectName: string,
  targetDir: string,
  reanalyze: boolean,
  cwd = process.cwd(),
): string {
  const label = formatTargetLabel(projectName, targetDir, cwd);
  if (reanalyze) return `Re-mapping ${label}...`;
  const verb = pickSeededVerb(START_VERBS, projectName);
  return `${verb} ${label}...`;
}

export function isWatchProgressMode(
  options: Pick<AnalyzeProgressReporterOptions, "reanalyze"> = {},
): boolean {
  return Boolean(options.reanalyze || process.env.REACT_ATLAS_WATCH_TARGET);
}

export function formatPhaseHeartbeat(message: string, elapsedMs: number): string {
  const elapsed = formatDuration(elapsedMs);
  if (message.endsWith("...")) {
    return `${message.slice(0, -3)} (${elapsed})...`;
  }
  return `${message} (${elapsed})...`;
}

/** Write progress immediately (sync) in watch mode so chokidar/shell pipes don't buffer stderr. */
export function writeProgressLine(message: string, flush = false): void {
  const line = `${message}\n`;
  if (flush && typeof process.stderr.fd === "number") {
    try {
      fs.writeSync(process.stderr.fd, line);
      return;
    } catch {
      // fall through to async write
    }
  }
  process.stderr.write(line);
}

export function runWithPhaseHeartbeat<T>(
  progress: AnalyzeProgressReporter | undefined,
  message: string,
  work: () => T,
  intervalMs = PHASE_HEARTBEAT_MS,
): T {
  if (!progress) return work();

  const started = Date.now();
  progress.phase(message);

  const timer = setInterval(() => {
    progress.phase(formatPhaseHeartbeat(message, Date.now() - started));
  }, intervalMs);

  try {
    return work();
  } finally {
    clearInterval(timer);
  }
}

function createNoopReporter(): AnalyzeProgressReporter {
  return {
    start: () => undefined,
    discoveryScan: () => undefined,
    discoveryDone: () => undefined,
    cacheSummary: () => undefined,
    parseFile: () => undefined,
    cachedFile: () => undefined,
    phase: () => undefined,
    complete: () => undefined,
    fail: () => undefined,
    stop: () => undefined,
  };
}

function createLineReporter(options: AnalyzeProgressReporterOptions): AnalyzeProgressReporter {
  const colors = createColors(options.color !== false);
  const flushLines = isWatchProgressMode(options);
  let lastParseUpdate = 0;
  let lastCachedUpdate = 0;

  const writeln = (message: string) => {
    writeProgressLine(message, flushLines);
  };

  return {
    start(projectName, targetDir) {
      lastParseUpdate = 0;
      lastCachedUpdate = 0;
      writeln(formatStartMessage(projectName, targetDir, Boolean(options.reanalyze)));
    },

    discoveryScan(targetDir) {
      writeln(formatDiscoveryScan(targetDir));
    },

    discoveryDone(fileCount) {
      writeln(formatDiscoveryDone(fileCount));
    },

    cacheSummary(hits, misses) {
      writeln(formatCacheSummary(hits, misses));
    },

    parseFile(filePath, current, total, targetDir) {
      if (!shouldUpdateFileProgress(current, total, lastParseUpdate)) return;
      lastParseUpdate = current;
      writeln(formatParseProgress(filePath, current, total, targetDir));
    },

    cachedFile(filePath, current, total, targetDir) {
      if (!options.verbose || total > VERBOSE_CACHE_FILE_LIMIT) return;
      if (!shouldUpdateFileProgress(current, total, lastCachedUpdate)) return;
      lastCachedUpdate = current;
      writeln(formatCachedFileProgress(filePath, current, total, targetDir));
    },

    phase(message) {
      writeln(message);
    },

    complete(nodes, edges, durationMs) {
      writeln(colors.green(`✔ ${formatComplete(nodes, edges, durationMs)}`));
    },

    fail(message) {
      writeln(colors.red(`✖ ${message}`));
    },

    stop() {
      // no-op
    },
  };
}

function createSpinnerReporter(options: AnalyzeProgressReporterOptions): AnalyzeProgressReporter {
  const colors = createColors(options.color !== false);
  let spinner: Ora | null = null;
  let lastParseUpdate = 0;
  let lastCachedUpdate = 0;

  const setText = (message: string) => {
    if (spinner) spinner.text = message;
  };

  return {
    start(projectName, targetDir) {
      lastParseUpdate = 0;
      lastCachedUpdate = 0;
      if (!spinner) {
        spinner = ora({ color: "cyan", stream: process.stderr }).start();
      }
      setText(formatStartMessage(projectName, targetDir, Boolean(options.reanalyze)));
    },

    discoveryScan(targetDir) {
      setText(formatDiscoveryScan(targetDir));
    },

    discoveryDone(fileCount) {
      setText(formatDiscoveryDone(fileCount));
    },

    cacheSummary(hits, misses) {
      setText(formatCacheSummary(hits, misses));
    },

    parseFile(filePath, current, total, targetDir) {
      if (!shouldUpdateFileProgress(current, total, lastParseUpdate)) return;
      lastParseUpdate = current;
      setText(formatParseProgress(filePath, current, total, targetDir));
    },

    cachedFile(filePath, current, total, targetDir) {
      if (!options.verbose || total > VERBOSE_CACHE_FILE_LIMIT) return;
      if (!shouldUpdateFileProgress(current, total, lastCachedUpdate)) return;
      lastCachedUpdate = current;
      setText(formatCachedFileProgress(filePath, current, total, targetDir));
    },

    phase(message) {
      setText(message);
    },

    complete(nodes, edges, durationMs) {
      if (spinner) {
        spinner.succeed(colors.green(formatComplete(nodes, edges, durationMs)));
        spinner = null;
      }
    },

    fail(message) {
      if (spinner) {
        spinner.fail(colors.red(message));
        spinner = null;
      }
    },

    stop() {
      spinner?.stop();
      spinner = null;
    },
  };
}

export function createAnalyzeProgressReporter(
  options: AnalyzeProgressReporterOptions = {},
): AnalyzeProgressReporter {
  if (options.quiet) return createNoopReporter();

  // Watch mode logs each phase as a line so re-runs stay readable; ora spinner
  // only keeps the latest line, which hides discovery/cache/build steps.
  const useSpinner =
    process.stderr.isTTY &&
    options.color !== false &&
    !isWatchProgressMode(options);
  if (useSpinner) return createSpinnerReporter(options);
  return createLineReporter(options);
}
