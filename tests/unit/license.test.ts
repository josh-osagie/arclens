import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import {
  activateLicense,
  deactivateLicense,
  getLicenseFilePath,
  readLocalLicense,
  removeLocalLicense,
  validateLicense,
  writeLocalLicense,
  type LicenseData,
} from "../../src/license";

describe("license module", () => {
  const sampleLicense: LicenseData = {
    licenseKey: "TEST-PRO-KEY-1234",
    instanceId: "inst_999",
    instanceName: "Test-Machine",
    status: "active",
    variantName: "Pro",
    customerEmail: "dev@arclens.dev",
    activatedAt: new Date().toISOString(),
    expiresAt: null,
  };

  beforeEach(() => {
    removeLocalLicense();
  });

  afterEach(() => {
    removeLocalLicense();
    vi.restoreAllMocks();
  });

  it("handles empty/missing local license", () => {
    expect(readLocalLicense()).toBeNull();
  });

  it("persists and reads local license data", () => {
    writeLocalLicense(sampleLicense);
    const read = readLocalLicense();
    expect(read).not.toBeNull();
    expect(read?.licenseKey).toBe("TEST-PRO-KEY-1234");
    expect(read?.variantName).toBe("Pro");
    expect(read?.status).toBe("active");
  });

  it("removes local license file on removeLocalLicense", () => {
    writeLocalLicense(sampleLicense);
    expect(fs.existsSync(getLicenseFilePath())).toBe(true);
    removeLocalLicense();
    expect(fs.existsSync(getLicenseFilePath())).toBe(false);
  });

  it("activates license successfully via mock API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        activated: true,
        instance: { id: "inst_777", name: "Laptop" },
        license_key: { status: "active", expires_at: null },
        meta: { variant_name: "Team", customer_email: "team@arclens.dev" },
      }),
    } as Response);

    const res = await activateLicense("PRO-KEY-ABC");
    expect(res.success).toBe(true);
    expect(res.data?.variantName).toBe("Team");
    expect(res.data?.customerEmail).toBe("team@arclens.dev");
    expect(readLocalLicense()?.licenseKey).toBe("PRO-KEY-ABC");

    fetchSpy.mockRestore();
  });

  it("handles activation failure gracefully", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        activated: false,
        error: "License key does not exist",
      }),
    } as Response);

    const res = await activateLicense("INVALID-KEY");
    expect(res.success).toBe(false);
    expect(res.error).toBe("License key does not exist");
    expect(readLocalLicense()).toBeNull();

    fetchSpy.mockRestore();
  });

  it("validates existing local license", async () => {
    writeLocalLicense(sampleLicense);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        valid: true,
        license_key: { status: "active" },
      }),
    } as Response);

    const res = await validateLicense();
    expect(res.valid).toBe(true);
    expect(res.data?.status).toBe("active");

    fetchSpy.mockRestore();
  });

  it("deactivates license locally and calls API", async () => {
    writeLocalLicense(sampleLicense);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ deactivated: true }),
    } as Response);

    const res = await deactivateLicense();
    expect(res.success).toBe(true);
    expect(readLocalLicense()).toBeNull();

    fetchSpy.mockRestore();
  });
});
