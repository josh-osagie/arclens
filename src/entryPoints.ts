export function normalizeFilePath(file: string): string {
  return file.replace(/\\/g, "/");
}

function fileBaseName(file: string): string {
  const normalized = normalizeFilePath(file);
  const name = normalized.slice(normalized.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(0, dot) : name;
}

/**
 * React app bootstrap / root mount files — not barrel re-exports in component folders.
 */
export function isAppEntryFile(file: string): boolean {
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
  if (/(^|\/)pages\/_app\.(tsx|jsx)$/i.test(normalized)) return true;
  if (/(^|\/)pages\/_document\.(tsx|jsx)$/i.test(normalized)) return true;

  return false;
}

export type EntryNodeLike = {
  id: string;
  name: string;
  file: string;
  type: string;
};

export function isEntryNode(node: EntryNodeLike): boolean {
  return node.type === "entry" || isAppEntryFile(node.file);
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
};

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

  return [...byFile.entries()]
    .map(([file, fileNodes]) => ({
      node: pickPrimaryEntryNode(fileNodes, file),
      file,
      exportCount: fileNodes.length,
    }))
    .sort((a, b) => a.file.localeCompare(b.file))
    .slice(0, limit);
}
