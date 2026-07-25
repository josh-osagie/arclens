import fs from "node:fs";
import path from "node:path";

/** Primary on-disk cache directory (writes always use this). */
export const CACHE_DIR = ".arclens";

/** Legacy cache directory (read-only fallback when `.arclens` is absent). */
export const LEGACY_CACHE_DIR = ".react-atlas";

export const CACHE_FILE = "cache.json";
export const SNIPPETS_SUBDIR = "snippets";

/** Display path for CLI messages (e.g. `.arclens/snippets`). */
export const SNIPPETS_DIR = `${CACHE_DIR}/${SNIPPETS_SUBDIR}`;

/** All cache directory names to skip during source discovery. */
export const ALL_CACHE_DIR_NAMES: readonly string[] = [
  CACHE_DIR,
  LEGACY_CACHE_DIR,
];

export function getWriteCacheDir(targetDir: string): string {
  return path.join(targetDir, CACHE_DIR);
}

export function getWriteCacheFilePath(targetDir: string): string {
  return path.join(getWriteCacheDir(targetDir), CACHE_FILE);
}

/**
 * Resolve cache.json for reading. Prefers `.arclens/cache.json`, then legacy dirs.
 * Returns the primary write path when no cache file exists yet.
 */
export function resolveCacheFilePath(targetDir: string): string {
  const primaryFile = getWriteCacheFilePath(targetDir);
  if (fs.existsSync(primaryFile)) {
    return primaryFile;
  }

  const legacyFile = path.join(targetDir, LEGACY_CACHE_DIR, CACHE_FILE);
  if (fs.existsSync(legacyFile)) {
    return legacyFile;
  }

  return primaryFile;
}

export function getWriteSnippetsDir(targetDir: string): string {
  return path.join(targetDir, CACHE_DIR, SNIPPETS_SUBDIR);
}

function legacySnippetsDir(targetDir: string): string {
  return path.join(targetDir, LEGACY_CACHE_DIR, SNIPPETS_SUBDIR);
}

/**
 * Resolve snippets sidecar directory for reading. Prefers `.arclens/snippets`, then legacy.
 */
export function resolveSnippetsDir(targetDir: string): string | null {
  const primary = getWriteSnippetsDir(targetDir);
  if (fs.existsSync(primary)) {
    return primary;
  }

  const legacy = legacySnippetsDir(targetDir);
  if (fs.existsSync(legacy)) {
    return legacy;
  }

  return null;
}

/** Resolve a snippet sidecar file path for reading (legacy fallbacks included). */
export function resolveSnippetSidecarPath(
  projectRoot: string,
  relativeFile: string,
): string | null {
  const segments = relativeFile.split("/");
  const candidates = [
    path.join(getWriteSnippetsDir(projectRoot), ...segments),
    path.join(legacySnippetsDir(projectRoot), ...segments),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

/** @deprecated Use getWriteCacheFilePath for writes or resolveCacheFilePath for reads. */
export function getCachePath(targetDir: string): string {
  return getWriteCacheFilePath(targetDir);
}
