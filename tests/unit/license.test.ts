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

  const originalProxyUrl = process.env.ARCLENS_LICENSE_PROXY_URL;

  beforeEach(() => {
    removeLocalLicense();
    process.env.ARCLENS_LICENSE_PROXY_URL = "https://license.arclens.dev";
  });

  afterEach(() => {
    removeLocalLicense();
    vi.restoreAllMocks();
    if (originalProxyUrl !== undefined) {
      process.env.ARCLENS_LICENSE_PROXY_URL = originalProxyUrl;
    } else {
      delete process.env.ARCLENS_LICENSE_PROXY_URL;
    }
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

  it("activates license locally in offline mode when proxy is unset", async () => {
    delete process.env.ARCLENS_LICENSE_PROXY_URL;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const res = await activateLicense("OFFLINE-KEY");
    expect(res.success).toBe(true);
    expect(res.data?.variantName).toBe("Pro");
    expect(res.data?.licenseKey).toBe("OFFLINE-KEY");
    expect(readLocalLicense()?.licenseKey).toBe("OFFLINE-KEY");
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("validates expired license locally in offline mode", async () => {
    delete process.env.ARCLENS_LICENSE_PROXY_URL;
    const expiredLicense: LicenseData = {
      ...sampleLicense,
      expiresAt: new Date(Date.now() - 10000).toISOString(),
    };
    writeLocalLicense(expiredLicense);

    const res = await validateLicense();
    expect(res.valid).toBe(false);
    expect(res.error).toBe("License has expired");
    expect(readLocalLicense()?.status).toBe("expired");
  });
});
