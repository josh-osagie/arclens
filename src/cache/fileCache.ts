import fs from "node:fs";
import path from "node:path";
import { sanitizeFileAnalysisPayload, type FileAnalysisPayload } from "../extractFileAnalysis";

export const CACHE_VERSION = 1;
export const CACHE_DIR = ".react-atlas";
export const CACHE_FILE = "cache.json";

export type FileCacheEntry = {
  mtimeMs: number;
  size: number;
  data: FileAnalysisPayload;
};

export type FileCacheFile = {
  version: typeof CACHE_VERSION;
  tsConfigKey?: string;
  files: Record<string, FileCacheEntry>;
};

export type FileStat = {
  mtimeMs: number;
  size: number;
};

export function getCachePath(targetDir: string): string {
  return path.join(targetDir, CACHE_DIR, CACHE_FILE);
}

export function normalizePath(filePath: string): string {
  return path.normalize(filePath);
}

export function toRelativeKey(targetDir: string, absolutePath: string): string {
  return path.relative(targetDir, normalizePath(absolutePath)).split(path.sep).join("/");
}

export function readFileStat(filePath: string): FileStat {
  const stat = fs.statSync(filePath);
  return { mtimeMs: stat.mtimeMs, size: stat.size };
}

export function tsConfigCacheKey(tsConfigPath: string | undefined): string | undefined {
  if (!tsConfigPath || !fs.existsSync(tsConfigPath)) {
    return undefined;
  }

  const stat = fs.statSync(tsConfigPath);
  return `${path.normalize(tsConfigPath)}:${stat.mtimeMs}:${stat.size}`;
}

export function isCacheEntryValid(
  entry: FileCacheEntry,
  stat: FileStat,
): boolean {
  return entry.mtimeMs === stat.mtimeMs && entry.size === stat.size;
}

export function readFileCache(cachePath: string): FileCacheFile | null {
  if (!fs.existsSync(cachePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath, "utf8")) as FileCacheFile;
    if (parsed.version !== CACHE_VERSION || typeof parsed.files !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeFileCache(cachePath: string, cache: FileCacheFile): void {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`);
}

export type CachePartition = {
  cached: FileAnalysisPayload[];
  toParse: string[];
  cacheHits: number;
  cacheMisses: number;
};

export function partitionFilesByCache(
  targetDir: string,
  discoveredFiles: string[],
  cache: FileCacheFile | null,
  tsConfigKey: string | undefined,
): CachePartition {
  if (!cache || cache.tsConfigKey !== tsConfigKey) {
    return {
      cached: [],
      toParse: discoveredFiles,
      cacheHits: 0,
      cacheMisses: discoveredFiles.length,
    };
  }

  const cached: FileAnalysisPayload[] = [];
  const toParse: string[] = [];
  let cacheHits = 0;
  let cacheMisses = 0;

  for (const filePath of discoveredFiles) {
    const key = toRelativeKey(targetDir, filePath);
    const entry = cache.files[key];

    if (!entry) {
      toParse.push(filePath);
      cacheMisses += 1;
      continue;
    }

    const stat = readFileStat(filePath);
    if (!isCacheEntryValid(entry, stat)) {
      toParse.push(filePath);
      cacheMisses += 1;
      continue;
    }

    cached.push(sanitizeFileAnalysisPayload(entry.data));
    cacheHits += 1;
  }

  return { cached, toParse, cacheHits, cacheMisses };
}

export function buildCacheFile(
  targetDir: string,
  discoveredFiles: string[],
  payloads: FileAnalysisPayload[],
  tsConfigKey: string | undefined,
): FileCacheFile {
  const files: Record<string, FileCacheEntry> = {};

  for (const payload of payloads) {
    const key = toRelativeKey(targetDir, payload.filePath);
    const stat = readFileStat(payload.filePath);
    files[key] = {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      data: payload,
    };
  }

  return {
    version: CACHE_VERSION,
    tsConfigKey,
    files,
  };
}
