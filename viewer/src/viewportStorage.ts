import type { Viewport } from "@xyflow/react";

const STORAGE_PREFIX = "react-atlas-viewport:";

export function viewportStorageKey(graphKey: string): string {
  return `${STORAGE_PREFIX}${graphKey}`;
}

export function loadViewport(graphKey: string): Viewport | null {
  try {
    const raw = localStorage.getItem(viewportStorageKey(graphKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Viewport;
    if (
      typeof parsed.x === "number" &&
      typeof parsed.y === "number" &&
      typeof parsed.zoom === "number"
    ) {
      return parsed;
    }
  } catch {
    // ignore corrupt storage
  }
  return null;
}

export function saveViewport(graphKey: string, viewport: Viewport): void {
  try {
    localStorage.setItem(viewportStorageKey(graphKey), JSON.stringify(viewport));
  } catch {
    // ignore quota errors
  }
}
