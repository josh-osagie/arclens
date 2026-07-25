import fs from "node:fs";
import path from "node:path";
import {
  getWriteSnippetsDir,
  resolveSnippetSidecarPath,
} from "./paths";

export { SNIPPETS_DIR } from "./paths";
export const DEFAULT_SNIPPET_LINES = 120;

export type TruncatedContent = {
  content: string;
  lineCount: number;
  totalLines: number;
  truncated: boolean;
};

export function normalizeSlashes(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

export function isPathWithinRoot(
  rootDir: string,
  candidatePath: string,
): boolean {
  const root = path.resolve(rootDir);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

/**
 * Resolve a graph node file path to a project-relative posix path safe for APIs.
 */
export function resolveRelativeFile(
  projectRoot: string,
  filePath: string,
): string | null {
  if (!filePath || filePath === "external") {
    return null;
  }

  const root = path.resolve(projectRoot);
  const absolute = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(root, filePath);

  if (!isPathWithinRoot(root, absolute)) {
    return null;
  }

  return normalizeSlashes(path.relative(root, absolute));
}

export function truncateLines(
  source: string,
  maxLines: number = DEFAULT_SNIPPET_LINES,
): TruncatedContent {
  const normalized = source.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const truncated = lines.length > maxLines;
  const slice = truncated ? lines.slice(0, maxLines) : lines;

  return {
    content: slice.join("\n"),
    lineCount: slice.length,
    totalLines: lines.length,
    truncated,
  };
}

export function readSnippetFromDisk(
  projectRoot: string,
  relativeFile: string,
  maxLines: number = DEFAULT_SNIPPET_LINES,
): TruncatedContent & { source: "live" | "sidecar" } {
  const root = path.resolve(projectRoot);
  const livePath = path.resolve(root, relativeFile);

  if (!isPathWithinRoot(root, livePath)) {
    throw new Error("Path escapes project root");
  }

  if (fs.existsSync(livePath) && fs.statSync(livePath).isFile()) {
    const raw = fs.readFileSync(livePath, "utf8");
    return { ...truncateLines(raw, maxLines), source: "live" };
  }

  const sidecarPath = resolveSnippetSidecarPath(root, relativeFile);
  if (sidecarPath) {
    const raw = fs.readFileSync(sidecarPath, "utf8");
    const lines = raw.replace(/\r\n/g, "\n").split("\n");
    return {
      content: raw,
      lineCount: lines.length,
      totalLines: lines.length,
      truncated: false,
      source: "sidecar",
    };
  }

  throw new Error(`File not found: ${relativeFile}`);
}

export function snippetSidecarPath(
  projectRoot: string,
  relativeFile: string,
): string {
  return path.join(
    getWriteSnippetsDir(projectRoot),
    ...relativeFile.split("/"),
  );
}

export function writeSnippetSidecar(
  projectRoot: string,
  absoluteFilePath: string,
  maxLines: number = DEFAULT_SNIPPET_LINES,
): string | null {
  const relativeFile = resolveRelativeFile(projectRoot, absoluteFilePath);
  if (!relativeFile) {
    return null;
  }

  const sourcePath = path.resolve(projectRoot, relativeFile);
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    return null;
  }

  const { content } = truncateLines(
    fs.readFileSync(sourcePath, "utf8"),
    maxLines,
  );
  const outPath = snippetSidecarPath(projectRoot, relativeFile);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, "utf8");
  return outPath;
}

/**
 * Write snippet sidecars for a list of file paths.
 */
export function writeSnippetSidecars(
  projectRoot: string,
  filePaths: Iterable<string>,
  maxLines: number = DEFAULT_SNIPPET_LINES,
): number {
  const unique = new Set<string>();
  for (const filePath of filePaths) {
    if (filePath && filePath !== "external") {
      unique.add(filePath);
    }
  }

  let written = 0;
  for (const filePath of unique) {
    if (writeSnippetSidecar(projectRoot, filePath, maxLines)) {
      written += 1;
    }
  }
  return written;
}

export function parseSnippetLinesParam(
  value: string | null | undefined,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_SNIPPET_LINES;
  }
  return Math.min(parsed, 500);
}

export function buildSnippetApiUrl(
  relativeFile: string,
  maxLines: number,
): string {
  const params = new URLSearchParams({
    file: relativeFile,
    lines: String(maxLines),
  });
  return `/api/snippet?${params.toString()}`;
}
