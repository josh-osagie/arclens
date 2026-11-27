import type { Viewport } from "@xyflow/react";

export type CameraHistoryEntry = {
  scopeKey: string;
  domain: string | null;
  trail?: readonly string[];
  viewport: Viewport;
};

/**
 * Push a viewport snapshot onto the navigation stack before drilling deeper.
 * Replaces the top entry if it shares the same `scopeKey`.
 */
export function pushViewport<T extends CameraHistoryEntry>(
  stack: readonly T[],
  entry: T,
  maxDepth = 20
): T[] {
  const copy = [...stack];
  const top = copy[copy.length - 1];

  if (top && top.scopeKey === entry.scopeKey) {
    copy[copy.length - 1] = entry;
    return copy;
  }

  copy.push(entry);
  if (copy.length > maxDepth) {
    return copy.slice(copy.length - maxDepth);
  }
  return copy;
}

/**
 * Pop the most recent viewport (or unwind back to a specific `targetScopeKey`,
 * such as `"overview"` or `"area:src/app"`).
 */
export function popViewport<T extends CameraHistoryEntry>(
  stack: readonly T[],
  targetScopeKey?: string
): {
  entry: T | null;
  nextStack: T[];
} {
  if (stack.length === 0) {
    return { entry: null, nextStack: [] };
  }

  if (targetScopeKey) {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i]!.scopeKey === targetScopeKey) {
        return {
          entry: stack[i]!,
          nextStack: stack.slice(0, i),
        };
      }
    }
  }

  const nextStack = stack.slice(0, -1);
  const entry = stack[stack.length - 1] ?? null;
  return { entry, nextStack };
}

/**
 * Append a breadcrumb item to `items`, deduplicating by `scopeKey`.
 * When an active/current scope already appeared earlier in `historyStack` with
 * `isCurrent: false`, move it to the tail instead of dropping the current crumb.
 */
export function pushBreadcrumbItem<
  T extends { scopeKey: string; isCurrent: boolean },
>(
  items: T[],
  seenKeys: Set<string>,
  item: T,
  options?: { moveDuplicateToEnd?: boolean }
): void {
  if (seenKeys.has(item.scopeKey)) {
    if (!item.isCurrent && !options?.moveDuplicateToEnd) return;
    const existingIdx = items.findIndex((i) => i.scopeKey === item.scopeKey);
    if (existingIdx >= 0) {
      items.splice(existingIdx, 1);
    }
    items.push(item);
    return;
  }
  seenKeys.add(item.scopeKey);
  items.push(item);
}
