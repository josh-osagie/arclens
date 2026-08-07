import fs from "node:fs";
import path from "node:path";

const BLOCKED_DIR_NAMES = new Set(["node_modules", ".git", "dist", "build"]);

/**
 * Resolve and validate the directory the user wants to analyze.
 *
 * only accept an explicit directory path, resolve it to an
 * absolute path, and verify it exists. We never follow user input into
 * shell commands or dynamic code execution.
 */
export function resolveTarget(inputPath: string): string {
  const resolved = path.resolve(process.cwd(), inputPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Target path does not exist: ${inputPath}`);
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`Target path is not a directory: ${inputPath}`);
  }

  const dirName = path.basename(resolved);
  if (BLOCKED_DIR_NAMES.has(dirName)) {
    throw new Error(
      `Refusing to analyze "${dirName}" directly. Point at your source folder (e.g. ./src).`
    );
  }

  return resolved;
}

/**
 * Human-readable project label for CLI and viewer.
 * Prefers package.json "name" at the analyzed root; falls back to folder basename.
 */
export function resolveProjectName(targetDir: string): string {
  const packageJsonPath = path.join(targetDir, "package.json");

  if (fs.existsSync(packageJsonPath)) {
    try {
      const raw = fs.readFileSync(packageJsonPath, "utf8");
      const pkg = JSON.parse(raw) as { name?: unknown };
      if (typeof pkg.name === "string" && pkg.name.trim()) {
        return pkg.name.trim();
      }
    } catch {
      // fall through to basename
    }
  }

  return path.basename(targetDir);
}

/**
 * Find the nearest tsconfig.json starting from the target directory.
 * TypeScript uses this for module resolution — not for running code.
 */
export function findTsConfig(targetDir: string): string | undefined {
  let current = targetDir;

  for (let depth = 0; depth < 6; depth++) {
    const candidate = path.join(current, "tsconfig.json");
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return undefined;
}
