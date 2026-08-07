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
    // Ignore error if file doesn't exist
  }
}

const LEMON_SQUEEZY_API_URL = "https://api.lemonsqueezy.com/v1/licenses";

export async function activateLicense(
  licenseKey: string,
  options?: { apiUrl?: string }
): Promise<{ success: boolean; data?: LicenseData; error?: string }> {
  const cleanKey = licenseKey.trim();
  if (!cleanKey) {
    return { success: false, error: "License key cannot be empty" };
  }

  const instanceName = os.hostname() || "Arclens Machine";
  const baseUrl = options?.apiUrl ?? LEMON_SQUEEZY_API_URL;

  try {
    const bodyParams = new URLSearchParams({
      license_key: cleanKey,
      instance_name: instanceName,
    });

    const response = await fetch(`${baseUrl}/activate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP Error ${response.status}: Failed to reach Lemon Squeezy API`,
      };
    }

    const resData = (await response.json()) as {
      activated?: boolean;
      error?: string;
      license_key?: {
        status?: string;
        expires_at?: string | null;
      };
      instance?: {
        id?: string;
        name?: string;
      };
      meta?: {
        variant_name?: string;
        customer_email?: string;
        customer_name?: string;
      };
    };

    if (resData.error || !resData.activated) {
      return {
        success: false,
        error:
          resData.error || "License key is invalid or activation limit reached",
      };
    }

    const licenseRecord: LicenseData = {
      licenseKey: cleanKey,
      instanceId: String(resData.instance?.id ?? "local-instance"),
      instanceName: resData.instance?.name ?? instanceName,
      status:
        (resData.license_key?.status as LicenseData["status"]) || "active",
      variantName: resData.meta?.variant_name ?? "Pro",
      customerEmail: resData.meta?.customer_email ?? "customer@domain.com",
      customerName: resData.meta?.customer_name,
      activatedAt: new Date().toISOString(),
      expiresAt: resData.license_key?.expires_at ?? null,
    };

    writeLocalLicense(licenseRecord);
    return { success: true, data: licenseRecord };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Activation failed: ${msg}` };
  }
}

export async function deactivateLicense(options?: {
  apiUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  const current = readLocalLicense();
  if (!current) {
    return { success: false, error: "No active license found locally" };
  }

  const baseUrl = options?.apiUrl ?? LEMON_SQUEEZY_API_URL;

  try {
    const bodyParams = new URLSearchParams({
      license_key: current.licenseKey,
      instance_id: current.instanceId,
    });

    await fetch(`${baseUrl}/deactivate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: bodyParams.toString(),
    });

    removeLocalLicense();
    return { success: true };
  } catch (err) {
    // Even if remote network fails, remove local cached activation
    removeLocalLicense();
    return { success: true };
  }
}

export async function validateLicense(options?: {
  apiUrl?: string;
}): Promise<{ valid: boolean; data?: LicenseData; error?: string }> {
  const current = readLocalLicense();
  if (!current) {
    return { valid: false, error: "No local license stored" };
  }

  const baseUrl = options?.apiUrl ?? LEMON_SQUEEZY_API_URL;

  try {
    const bodyParams = new URLSearchParams({
      license_key: current.licenseKey,
      instance_id: current.instanceId,
    });

    const response = await fetch(`${baseUrl}/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      // If offline / network error, return stored local state gracefully
      return { valid: current.status === "active", data: current };
    }

    const resData = (await response.json()) as {
      valid?: boolean;
      error?: string;
      license_key?: {
        status?: string;
        expires_at?: string | null;
      };
    };

    if (resData.valid && resData.license_key?.status === "active") {
      const updated: LicenseData = {
        ...current,
        status: "active",
        expiresAt: resData.license_key.expires_at ?? current.expiresAt,
      };
      writeLocalLicense(updated);
      return { valid: true, data: updated };
    }

    // Invalid license response
    const disabled: LicenseData = { ...current, status: "disabled" };
    writeLocalLicense(disabled);
    return {
      valid: false,
      data: disabled,
      error: resData.error || "License is inactive",
    };
  } catch {
    // Fall back to local file state if network request fails
    return { valid: current.status === "active", data: current };
  }
}
