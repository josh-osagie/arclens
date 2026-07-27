import { describe, expect, it } from "vitest";
import {
  formatVersionBanner,
  getPackageVersion,
  isDevelopmentInstall,
} from "../../src/versionBanner";

describe("versionBanner", () => {
  it("reads version from package.json", () => {
    expect(getPackageVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("prints ascii banner with version", () => {
    const banner = formatVersionBanner("2.3.1", { color: false });

    expect(banner).toContain("/ __ \\/");
    expect(banner).toContain("Version 2.3.1");
    expect(banner).toContain("Interactive architecture explorer");
    expect(banner).toContain("https://arclens.vercel.app");
  });

  it("detects development installs from source", () => {
    expect(isDevelopmentInstall()).toBe(true);
  });
});
