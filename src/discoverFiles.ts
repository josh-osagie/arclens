import fs from "node:fs";
import path from "node:path";
import { CACHE_DIR } from "./cache/fileCache";
import { isConfigFile } from "./extractors/reactFunction";

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  "out",
  CACHE_DIR,
]);

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

function isIgnoredSourceFile(fileName: string): boolean {
  if (isConfigFile(fileName)) return true;
  if (/\.d\.ts$/i.test(fileName)) return true;
  return false;
}

export function discoverSourceFiles(rootDir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    let entries: fs.Dirent[];

    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          walk(fullPath);
        }
        continue;
      }

      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name);
      if (SOURCE_EXTENSIONS.has(ext) && !isIgnoredSourceFile(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return files.sort();
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export const FILE_COUNT_WARNING = 300;
export const FILE_COUNT_SLOW = 800;
