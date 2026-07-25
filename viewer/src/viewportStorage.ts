import type { Viewport } from "@xyflow/react";
import { readLocalStorage, writeLocalStorage } from "./storageCompat";

const STORAGE_PREFIX = "arclens-viewport:";

export function viewportStorageKey(graphKey: string): string {
  return `${STORAGE_PREFIX}${graphKey}`;
}

export function loadViewport(graphKey: string): Viewport | null {
  try {
    const raw = readLocalStorage(viewportStorageKey(graphKey));
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
    writeLocalStorage(viewportStorageKey(graphKey), JSON.stringify(viewport));
  } catch {
    // ignore quota errors
  }
}
