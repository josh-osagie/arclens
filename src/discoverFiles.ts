import fs from "node:fs";
import path from "node:path";
import { ALL_CACHE_DIR_NAMES } from "./paths";
import { isConfigFile } from "./extractors/reactFunction";

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  "out",
  ...ALL_CACHE_DIR_NAMES,
]);

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

const UNSUPPORTED_HINT_EXTENSIONS = new Set([".html", ".htm", ".js", ".jsx", ".mjs", ".cjs"]);

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

/** Thrown when the target folder has no .ts/.tsx sources to analyze. */
export class UnsupportedProjectError extends Error {
  readonly targetDir: string;

  constructor(targetDir: string, hint?: string) {
    super(formatUnsupportedProjectMessage(targetDir, hint));
    this.name = "UnsupportedProjectError";
    this.targetDir = targetDir;
  }
}

export function formatUnsupportedProjectMessage(
  targetDir: string,
  hint?: string,
  cwd = process.cwd(),
): string {
  const rel = path.relative(cwd, targetDir) || targetDir;
  const lines = [
    `No TypeScript sources (.ts/.tsx) found under ${rel}.`,
    "",
    "Arclens analyzes React/TypeScript projects only.",
    "HTML-only, plain JavaScript, and other non-TS projects are not supported yet.",
  ];

  if (hint) {
    lines.push("", hint);
  }

  lines.push("", "Try pointing at a folder that contains .tsx/.ts files (often ./src).");
  return lines.join("\n");
}

/** Best-effort hint when a folder has HTML/JS but no TS sources. */
export function detectUnsupportedProjectHint(rootDir: string): string | undefined {
  const counts = new Map<string, number>();

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

      const ext = path.extname(entry.name).toLowerCase();
      if (UNSUPPORTED_HINT_EXTENSIONS.has(ext)) {
        counts.set(ext, (counts.get(ext) ?? 0) + 1);
      }
    }
  }

  walk(rootDir);

  const htmlCount = (counts.get(".html") ?? 0) + (counts.get(".htm") ?? 0);
  const jsCount =
    (counts.get(".js") ?? 0) +
    (counts.get(".jsx") ?? 0) +
    (counts.get(".mjs") ?? 0) +
    (counts.get(".cjs") ?? 0);

  if (htmlCount > 0 && jsCount > 0) {
    return `Found ${htmlCount} HTML and ${jsCount} JavaScript file${jsCount === 1 ? "" : "s"}, but no TypeScript (.ts/.tsx) sources.`;
  }
  if (htmlCount > 0) {
    return `Found ${htmlCount} HTML file${htmlCount === 1 ? "" : "s"}, but no TypeScript (.ts/.tsx) sources.`;
  }
  if (jsCount > 0) {
    return `Found ${jsCount} JavaScript file${jsCount === 1 ? "" : "s"}, but no TypeScript (.ts/.tsx) sources.`;
  }

  return undefined;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export const FILE_COUNT_WARNING = 300;
export const FILE_COUNT_SLOW = 800;
