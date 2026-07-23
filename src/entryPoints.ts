export function normalizeFilePath(file: string): string {
  return file.replace(/\\/g, "/");
}

function fileBaseName(file: string): string {
  const normalized = normalizeFilePath(file);
  const name = normalized.slice(normalized.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(0, dot) : name;
}

const TEST_SETUP_NAMES =
  /^(setupTests|vitest\.setup|jest\.setup|test-setup|setup\.(test|spec))$/i;

/**
 * Test, story, mock, and setup files are never app entry points.
 */
export function isNonProductionFile(file: string): boolean {
  const normalized = normalizeFilePath(file);

  if (/\.(test|spec)\.(tsx?|jsx?)$/i.test(normalized)) return true;
  if (/\.stories\.(tsx?|ts)$/i.test(normalized)) return true;
  if (/(^|\/)(__tests__|__mocks__)(\/|$)/i.test(normalized)) return true;

  const base = fileBaseName(normalized);
  if (TEST_SETUP_NAMES.test(base)) return true;

  return false;
}

/**
 * Known React app bootstrap / root mount file paths — not barrel re-exports in component folders.
 */
export function isAppEntryFile(file: string): boolean {
  if (isNonProductionFile(file)) return false;

  const normalized = normalizeFilePath(file);
  const base = fileBaseName(normalized);

  if (/^main$/i.test(base) && /\.(tsx|jsx|ts|js)$/i.test(normalized)) {
    return true;
  }

  if (/^index$/i.test(base)) {
    if (/(^|\/)src\/index\.(tsx|jsx|ts|js)$/i.test(normalized)) return true;
    if (/(^|\/)app\/index\.(tsx|jsx|ts|js)$/i.test(normalized)) return true;
    return false;
  }

  if (/(^|\/)app\/layout\.(tsx|jsx)$/i.test(normalized)) return true;
  if (/(^|\/)app\/page\.(tsx|jsx)$/i.test(normalized)) return true;
  if (/(^|\/)pages\/_app\.(tsx|jsx)$/i.test(normalized)) return true;
  if (/(^|\/)pages\/_document\.(tsx|jsx)$/i.test(normalized)) return true;

  return false;
}

export type EntryConfidence = "high" | "medium" | "low";

const CONFIDENCE_RANK: Record<EntryConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function entryFileConfidence(file: string, nodeType?: string): EntryConfidence {
  if (isNonProductionFile(file)) return "low";

  const normalized = normalizeFilePath(file);
  const base = fileBaseName(normalized);

  if (/^main$/i.test(base) && /\.(tsx|jsx)$/i.test(normalized)) return "high";
  if (/(^|\/)src\/index\.(tsx|jsx)$/i.test(normalized)) return "high";
  if (/(^|\/)app\/layout\.(tsx|jsx)$/i.test(normalized)) return "high";
  if (/(^|\/)pages\/_app\.(tsx|jsx)$/i.test(normalized)) return "high";
  if (/(^|\/)app\/page\.(tsx|jsx)$/i.test(normalized)) return "high";

  if (isAppEntryFile(file)) return "medium";
  if (nodeType === "entry") return "medium";

  return "low";
}

export type EntryNodeLike = {
  id: string;
  name: string;
  file: string;
  type: string;
};

export function isEntryNode(node: EntryNodeLike): boolean {
  if (isNonProductionFile(node.file)) return false;

  if (node.type === "entry") return true;
  if (isAppEntryFile(node.file)) return true;

  return false;
}

export function filterEntryNodes<T extends EntryNodeLike>(
  nodes: T[],
  metaEntryIds?: string[],
): T[] {
  if (metaEntryIds && metaEntryIds.length > 0) {
    const idSet = new Set(metaEntryIds);
    const fromMeta = nodes.filter((node) => idSet.has(node.id) && isEntryNode(node));
    if (fromMeta.length > 0) return fromMeta;
  }

  return nodes.filter(isEntryNode);
}

export function findEntryNodeIds<T extends EntryNodeLike>(
  nodes: T[],
  metaEntryIds?: string[],
): string[] {
  return filterEntryNodes(nodes, metaEntryIds).map((node) => node.id);
}

export function pickPrimaryEntryNode<T extends EntryNodeLike>(nodes: T[], file: string): T {
  const typed = nodes.find((node) => node.type === "entry");
  if (typed) return typed;

  const base = fileBaseName(file);
  const byName = nodes.find((node) => node.name === base || node.name === "default");
  if (byName) return byName;

  return [...nodes].sort((a, b) => a.name.localeCompare(b.name))[0]!;
}

export type EntryOverview<T extends EntryNodeLike = EntryNodeLike> = {
  node: T;
  file: string;
  exportCount: number;
  confidence: EntryConfidence;
};

function compareEntryOverviews<T extends EntryNodeLike>(
  a: EntryOverview<T>,
  b: EntryOverview<T>,
): number {
  const confDiff = CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence];
  if (confDiff !== 0) return confDiff;

  const aIsMain = fileBaseName(a.file).toLowerCase() === "main" ? 0 : 1;
  const bIsMain = fileBaseName(b.file).toLowerCase() === "main" ? 0 : 1;
  if (aIsMain !== bIsMain) return aIsMain - bIsMain;

  return a.file.localeCompare(b.file);
}

export function dedupeEntryPointsByFile<T extends EntryNodeLike>(
  nodes: T[],
  limit = 5,
): EntryOverview<T>[] {
  const byFile = new Map<string, T[]>();

  for (const node of nodes) {
    const key = normalizeFilePath(node.file);
    const group = byFile.get(key) ?? [];
    group.push(node);
    byFile.set(key, group);
  }

  let overviews = [...byFile.entries()].map(([file, fileNodes]) => {
    const node = pickPrimaryEntryNode(fileNodes, file);
    return {
      node,
      file,
      exportCount: fileNodes.length,
      confidence: entryFileConfidence(file, node.type),
    };
  });

  overviews.sort(compareEntryOverviews);

  const hasClearMain = overviews.some(
    (entry) =>
      entry.confidence === "high" && fileBaseName(entry.file).toLowerCase() === "main",
  );
  if (hasClearMain) {
    overviews = overviews.filter(
      (entry) => fileBaseName(entry.file).toLowerCase() === "main",
    );
  }

  return overviews.slice(0, limit);
}
