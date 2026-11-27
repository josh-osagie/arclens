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
export function pushViewport(
  stack: readonly CameraHistoryEntry[],
  entry: CameraHistoryEntry,
  maxDepth = 16
): CameraHistoryEntry[] {
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
 * such as `"overview"` or `"domain:src/app"`).
 */
export function popViewport(
  stack: readonly CameraHistoryEntry[],
  targetScopeKey?: string
): {
  entry: CameraHistoryEntry | null;
  nextStack: CameraHistoryEntry[];
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
