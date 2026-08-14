import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface LicenseData {
  licenseKey: string;
  instanceId: string;
  instanceName: string;
  status: "active" | "disabled" | "expired";
  variantName: string;
  customerEmail: string;
  customerName?: string;
  activatedAt: string;
  expiresAt: string | null;
}

export function getGlobalConfigDir(): string {
  return path.join(os.homedir(), ".arclens");
}

export function getLicenseFilePath(): string {
  return path.join(getGlobalConfigDir(), "license.json");
}

export function readLocalLicense(): LicenseData | null {
  try {
    const filePath = getLicenseFilePath();
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as LicenseData;
  } catch {
    return null;
  }
}

export function writeLocalLicense(data: LicenseData): void {
  const dir = getGlobalConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(
    getLicenseFilePath(),
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}

export function removeLocalLicense(): void {
  try {
    const filePath = getLicenseFilePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
  }
}

/**
 * License activation strategy: PROXY + OFFLINE fallback.
 *
 * Paddle Billing's License Codes API is SERVER-TO-SERVER ONLY — it requires a
 * Bearer PADDLE_API_KEY that must never ship inside a CLI binary:
 *   POST https://api.paddle.com/license-codes/{license_code}/activate
 *     Body: { instance_name: string }
 *     Headers: Authorization: Bearer {PADDLE_API_KEY}
 *     Returns: { data: { id, activation_id, instance_name, status, license_key: { id, status, expires_at } } }
 *
 *   POST https://api.paddle.com/license-codes/{license_code}/deactivate
 *     Body: { instance_id: string, instance_name?: string }
 *
 *   POST https://api.paddle.com/license-codes/{license_code}/validate
 *     Body: { instance_id?: string }
 *
 * For an indie dev CLI, we therefore support two modes and NEVER call Paddle
 * directly from this file (direct calls belong in your own proxy):
 *
 *   1. PROXY MODE — set ARCLENS_LICENSE_PROXY_URL to your small serverless
 *      function (e.g. Next.js Route Handler, Vercel/Netlify function, Cloudflare
 *      Worker) that holds PADDLE_API_KEY server-side and forwards calls.
 *      Deploy this when you want real activation counting / revocation and
 *      your user base has grown enough to justify a tiny infra surface.
 *
 *   2. OFFLINE MODE (default) — ARCLENS_LICENSE_PROXY_URL is empty / unset.
 *      Activations are recorded locally only. Perfect for indie-scale launches
 *      (0 → ~500 users) where you trust your honest customers and don't want
 *      to maintain any backend. Fraud is low among developer tool users; you
 *      can always add the proxy later by flipping the env var in a release.
 */

const PROXY_URL = process.env.ARCLENS_LICENSE_PROXY_URL?.replace(/\/$/, "") || "";

function sha256HostnameInstance(): string {
  const host = os.hostname() || "arclens-local";
  return crypto.createHash("sha256").update(host).digest("hex").slice(0, 32);
}

export async function activateLicense(
  licenseKey: string,
  options?: { apiUrl?: string }
): Promise<{ success: boolean; data?: LicenseData; error?: string }> {
  const cleanKey = licenseKey.trim();
  if (!cleanKey) {
    return { success: false, error: "License key cannot be empty" };
  }

  const instanceName = os.hostname() || "Arclens Machine";

  if (PROXY_URL) {
    try {
      const response = await fetch(`${PROXY_URL}/activate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          licenseKey: cleanKey,
          instanceName,
        }),
      });

      const resData = (await response.json()) as {
        success: boolean;
        data?: LicenseData;
        error?: string;
      };

      if (!response.ok || !resData.success) {
        return {
          success: false,
          error: resData.error || `Proxy returned HTTP ${response.status}`,
        };
      }

      if (resData.data) {
        writeLocalLicense(resData.data);
      }
      return { success: true, data: resData.data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Proxy activation failed: ${msg}` };
    }
  }

  const licenseRecord: LicenseData = {
    licenseKey: cleanKey,
    instanceId: sha256HostnameInstance(),
    instanceName,
    status: "active",
    variantName: "Pro",
    customerEmail: "customer@domain.com",
    activatedAt: new Date().toISOString(),
    expiresAt: null,
  };

  writeLocalLicense(licenseRecord);

  if (process.env.NODE_ENV !== "test") {
    console.log(
      [
        "",
        "License activated in offline mode (no proxy configured).",
        "To enable server-side activation counting, revocation, and expiry",
        "management, set ARCLENS_LICENSE_PROXY_URL to your Paddle proxy.",
        "",
      ].join("\n")
    );
  }

  return { success: true, data: licenseRecord };
}

export async function deactivateLicense(options?: {
  apiUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  const current = readLocalLicense();
  if (!current) {
    return { success: false, error: "No active license found locally" };
  }

  if (PROXY_URL) {
    try {
      await fetch(`${PROXY_URL}/deactivate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          licenseKey: current.licenseKey,
          instanceId: current.instanceId,
        }),
      });
    } catch {
    }
  }

  removeLocalLicense();
  return { success: true };
}

export async function validateLicense(options?: {
  apiUrl?: string;
}): Promise<{ valid: boolean; data?: LicenseData; error?: string }> {
  const current = readLocalLicense();
  if (!current) {
    return { valid: false, error: "No local license stored" };
  }

  if (PROXY_URL) {
    try {
      const response = await fetch(`${PROXY_URL}/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          licenseKey: current.licenseKey,
          instanceId: current.instanceId,
        }),
      });

      const resData = (await response.json()) as {
        valid: boolean;
        data?: LicenseData;
        error?: string;
      };

      if (response.ok && resData.valid) {
        const updated: LicenseData = resData.data
          ? { ...resData.data }
          : { ...current, status: "active" };
        writeLocalLicense(updated);
        return { valid: true, data: updated };
      }

      if (response.ok && !resData.valid) {
        const disabled: LicenseData = { ...current, status: "disabled" };
        writeLocalLicense(disabled);
        return {
          valid: false,
          data: disabled,
          error: resData.error || "License is inactive",
        };
      }

      return { valid: current.status === "active", data: current };
    } catch {
      return { valid: current.status === "active", data: current };
    }
  }

  const now = Date.now();
  if (current.expiresAt) {
    const expires = new Date(current.expiresAt).getTime();
    if (!Number.isNaN(expires) && expires < now) {
      const expired: LicenseData = { ...current, status: "expired" };
      writeLocalLicense(expired);
      return { valid: false, data: expired, error: "License has expired" };
    }
  }

  return { valid: current.status === "active", data: current };
}
