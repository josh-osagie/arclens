import fs from "node:fs";
import path from "node:path";
import { isConfigFile } from "./extractors/reactFunction";

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  "out",
]);

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

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
      if (SOURCE_EXTENSIONS.has(ext) && !isConfigFile(entry.name)) {
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
