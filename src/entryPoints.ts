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
  stats?: { incoming?: number; outgoing?: number };
};

export type EntryEdgeLike = { from: string; to: string };

const FALLBACK_TYPE_RANK: Record<string, number> = {
  entry: 0,
  component: 1,
  hook: 2,
  context: 3,
  utility: 4,
  config: 5,
};

function nodeIncomingCount(
  node: EntryNodeLike,
  incoming?: Map<string, number>,
): number {
  if (node.stats?.incoming !== undefined) return node.stats.incoming;
  return incoming?.get(node.id) ?? 0;
}

function nodeOutgoingCount(
  node: EntryNodeLike,
  outgoing?: Map<string, number>,
): number {
  if (node.stats?.outgoing !== undefined) return node.stats.outgoing;
  return outgoing?.get(node.id) ?? 0;
}

function buildEdgeCounts(edges: EntryEdgeLike[]): {
  incoming: Map<string, number>;
  outgoing: Map<string, number>;
} {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const edge of edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + 1);
  }
  return { incoming, outgoing };
}

/**
 * When no bootstrap entry file exists, treat graph roots (zero incoming, some outgoing)
 * as entry points. Prefers components over hooks and utilities.
 */
export function findFallbackEntryNodes<T extends EntryNodeLike>(
  nodes: T[],
  edges: EntryEdgeLike[] = [],
): T[] {
  const counts = edges.length > 0 ? buildEdgeCounts(edges) : null;

  const roots = nodes.filter((node) => {
    if (node.file === "external") return false;
    if (isNonProductionFile(node.file)) return false;

    const incoming = nodeIncomingCount(node, counts?.incoming);
    const outgoing = nodeOutgoingCount(node, counts?.outgoing);
    return incoming === 0 && outgoing > 0;
  });

  return roots.sort((a, b) => {
    const rankA = FALLBACK_TYPE_RANK[a.type] ?? 99;
    const rankB = FALLBACK_TYPE_RANK[b.type] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name);
  });
}

export function isEntryNode(node: EntryNodeLike): boolean {
  if (isNonProductionFile(node.file)) return false;

  if (node.type === "entry") return true;
  if (isAppEntryFile(node.file)) return true;

  return false;
}

export function filterEntryNodes<T extends EntryNodeLike>(
  nodes: T[],
  metaEntryIds?: string[],
  edges: EntryEdgeLike[] = [],
): T[] {
  if (metaEntryIds && metaEntryIds.length > 0) {
    const idSet = new Set(metaEntryIds);
    const fromMeta = nodes.filter((node) => idSet.has(node.id) && isEntryNode(node));
    if (fromMeta.length > 0) return fromMeta;
  }

  const fromHeuristic = nodes.filter(isEntryNode);
  if (fromHeuristic.length > 0) return fromHeuristic;

  return findFallbackEntryNodes(nodes, edges);
}

export function findEntryNodeIds<T extends EntryNodeLike>(
  nodes: T[],
  metaEntryIds?: string[],
  edges: EntryEdgeLike[] = [],
): string[] {
  return filterEntryNodes(nodes, metaEntryIds, edges).map((node) => node.id);
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
