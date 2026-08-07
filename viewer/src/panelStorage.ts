import {
  readLocalStorage,
  removeLocalStorage,
  writeLocalStorage,
} from "./storageCompat";

export type PanelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const STORAGE_PREFIX = "arclens-panel:";

export function panelStorageKey(id: string): string {
  return `${STORAGE_PREFIX}${id}`;
}

export function panelMinimizedKey(id: string): string {
  return `${STORAGE_PREFIX}${id}:minimized`;
}

export function loadPanelMinimized(id: string): boolean {
  try {
    return readLocalStorage(panelMinimizedKey(id)) === "1";
  } catch {
    return false;
  }
}

export function savePanelMinimized(id: string, minimized: boolean): void {
  try {
    const key = panelMinimizedKey(id);
    if (minimized) {
      writeLocalStorage(key, "1");
    } else {
      removeLocalStorage(key);
    }
  } catch {
    // ignore quota errors
  }
}

export function loadPanelRect(id: string): PanelRect | null {
  try {
    const raw = readLocalStorage(panelStorageKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PanelRect;
    if (
      typeof parsed.x === "number" &&
      typeof parsed.y === "number" &&
      typeof parsed.width === "number" &&
      typeof parsed.height === "number"
    ) {
      return parsed;
    }
  } catch {
    // ignore corrupt storage
  }
  return null;
}

export function savePanelRect(id: string, rect: PanelRect): void {
  try {
    writeLocalStorage(panelStorageKey(id), JSON.stringify(rect));
  } catch {
    // ignore quota errors
  }
}

export function clampPanelRect(rect: PanelRect, min: PanelRect): PanelRect {
  const inset = 16;
  const maxW = window.innerWidth - inset * 2;
  const maxH = window.innerHeight - inset * 2;
  const width = Math.min(Math.max(rect.width, min.width), maxW);
  const height = Math.min(Math.max(rect.height, min.height), maxH);
  const x = Math.min(
    Math.max(rect.x, inset),
    window.innerWidth - width - inset
  );
  const y = Math.min(
    Math.max(rect.y, inset),
    window.innerHeight - height - inset
  );

  return { x, y, width, height };
}

export function defaultMainPanelRect(): PanelRect {
  const inset = 16;
  return clampPanelRect(
    {
      x: inset,
      y: inset,
      width: 280,
      height: Math.min(560, window.innerHeight - inset * 2),
    },
    { x: inset, y: inset, width: 220, height: 180 }
  );
}

export function defaultDetailsPanelRect(): PanelRect {
  const inset = 16;
  const width = 340;
  return clampPanelRect(
    {
      x: window.innerWidth - width - inset,
      y: inset,
      width,
      height: Math.min(560, window.innerHeight - inset * 2),
    },
    { x: inset, y: inset, width: 260, height: 180 }
  );
}
