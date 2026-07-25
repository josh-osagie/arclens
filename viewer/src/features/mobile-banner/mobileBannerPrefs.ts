import { readLocalStorage, writeLocalStorage } from "./storageCompat";

export const MOBILE_BANNER_STORAGE_KEY = "arclens-mobile-banner-dismissed";

export type MobileBannerPrefs = {
  dismissed: boolean;
  permanent: boolean;
};

export const DEFAULT_MOBILE_BANNER_PREFS: MobileBannerPrefs = {
  dismissed: false,
  permanent: false,
};

export function loadMobileBannerPrefs(): MobileBannerPrefs {
  try {
    const raw = readLocalStorage(MOBILE_BANNER_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MOBILE_BANNER_PREFS };
    const parsed = JSON.parse(raw) as Partial<MobileBannerPrefs>;
    return { ...DEFAULT_MOBILE_BANNER_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_MOBILE_BANNER_PREFS };
  }
}

export function saveMobileBannerPrefs(prefs: MobileBannerPrefs): void {
  try {
    writeLocalStorage(MOBILE_BANNER_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota errors
  }
}

export function dismissMobileBanner(permanent: boolean): MobileBannerPrefs {
  const prefs: MobileBannerPrefs = { dismissed: true, permanent };
  saveMobileBannerPrefs(prefs);
  return prefs;
}

export function shouldShowMobileBanner(
  prefs: MobileBannerPrefs,
  isNarrowViewport: boolean,
): boolean {
  if (prefs.permanent) return false;
  if (!isNarrowViewport) return false;
  return !prefs.dismissed;
}

export const MOBILE_BANNER_MAX_WIDTH_PX = 768;
