export const DEFAULT_SNIPPET_LINES = 120;

export type SnippetResponse = {
  file: string;
  content: string;
  lines: number;
  totalLines: number;
  truncated: boolean;
  source: "live" | "sidecar";
};

export type SnippetResult =
  | { status: "idle" }
  | { status: "loading"; file: string }
  | { status: "error"; file: string; message: string }
  | { status: "ready"; snippet: SnippetResponse };

const cache = new Map<string, SnippetResponse>();

function normalizeSlashes(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function isPathWithinRoot(projectRoot: string, absolutePath: string): boolean {
  const root = normalizeSlashes(projectRoot).replace(/\/+$/, "");
  const candidate = normalizeSlashes(absolutePath);
  const rootPrefix = `${root}/`;
  return candidate === root || candidate.startsWith(rootPrefix);
}

export function resolveNodeSnippetPath(
  nodeFile: string,
  projectRoot?: string
): string | null {
  if (!nodeFile || nodeFile === "external" || !projectRoot) {
    return null;
  }

  const root = normalizeSlashes(projectRoot).replace(/\/+$/, "");
  const absolute = normalizeSlashes(
    nodeFile.startsWith("/") || /^[A-Za-z]:\//.test(nodeFile)
      ? nodeFile
      : `${root}/${nodeFile}`
  );

  if (!isPathWithinRoot(root, absolute)) {
    return null;
  }

  return absolute.slice(root.length + 1);
}

export function buildSnippetApiUrl(
  relativeFile: string,
  maxLines: number
): string {
  const params = new URLSearchParams({
    file: relativeFile,
    lines: String(maxLines),
  });
  return `/api/snippet?${params.toString()}`;
}

function cacheKey(relativeFile: string, maxLines: number): string {
  return `${relativeFile}:${maxLines}`;
}

export function clearSnippetCache(): void {
  cache.clear();
}

export async function fetchFileSnippet(
  relativeFile: string,
  maxLines: number = DEFAULT_SNIPPET_LINES
): Promise<SnippetResponse> {
  const key = cacheKey(relativeFile, maxLines);
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const response = await fetch(buildSnippetApiUrl(relativeFile, maxLines));
  const payload = (await response.json()) as SnippetResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      payload.error ?? `Snippet fetch failed (${response.status})`
    );
  }

  cache.set(key, payload);
  return payload;
}
