/** Map `arclens-*` storage keys to their `react-atlas-*` legacy equivalents. */
export function toLegacyStorageKey(key: string): string {
  return key.replace(/^arclens/, "react-atlas");
}

/** Read localStorage, trying the primary key then legacy fallbacks. */
export function readLocalStorage(
  key: string,
  legacyKeys: string[] = [toLegacyStorageKey(key)],
): string | null {
  try {
    const primary = localStorage.getItem(key);
    if (primary !== null) {
      return primary;
    }

    for (const legacyKey of legacyKeys) {
      const legacy = localStorage.getItem(legacyKey);
      if (legacy !== null) {
        return legacy;
      }
    }
  } catch {
    // ignore storage errors
  }

  return null;
}

/** Write localStorage using the primary (arclens) key only. */
export function writeLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore quota errors
  }
}

/** Remove a value from localStorage (primary key only). */
export function removeLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}
