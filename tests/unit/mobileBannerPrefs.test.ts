import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MOBILE_BANNER_PREFS,
  dismissMobileBanner,
  loadMobileBannerPrefs,
  MOBILE_BANNER_STORAGE_KEY,
  shouldShowMobileBanner,
} from "../../viewer/src/features/mobile-banner/mobileBannerPrefs";

describe("mobileBannerPrefs", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows banner on narrow viewports by default", () => {
    expect(loadMobileBannerPrefs()).toEqual(DEFAULT_MOBILE_BANNER_PREFS);
    expect(shouldShowMobileBanner(DEFAULT_MOBILE_BANNER_PREFS, true)).toBe(true);
    expect(shouldShowMobileBanner(DEFAULT_MOBILE_BANNER_PREFS, false)).toBe(false);
  });

  it("persists temporary dismiss", () => {
    const prefs = dismissMobileBanner(false);
    expect(store[MOBILE_BANNER_STORAGE_KEY]).toBe(JSON.stringify(prefs));
    expect(shouldShowMobileBanner(prefs, true)).toBe(false);
    expect(shouldShowMobileBanner(loadMobileBannerPrefs(), true)).toBe(false);
  });

  it("persists permanent dismiss", () => {
    const prefs = dismissMobileBanner(true);
    expect(prefs.permanent).toBe(true);
    expect(shouldShowMobileBanner(prefs, true)).toBe(false);
    expect(shouldShowMobileBanner(loadMobileBannerPrefs(), true)).toBe(false);
  });
});
