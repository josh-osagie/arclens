/**
 * Plan entitlements for open-core monetization (Paddle Billing licenses).
 *
 * Free stays fully usable for mid-size apps. Pro raises scale limits and
 * reserves flags for features that ship later (incremental watch, adapters).
 */

import { readLocalLicense, type LicenseData } from "./license";

export type PlanId = "free" | "pro";

export type Entitlements = {
  plan: PlanId;
  label: string;
  /** Hard ceiling for --max-files / discovered file count */
  maxFiles: number;
  features: {
    largeProjects: boolean;
    /** Reserved: true incremental dirty-file rebuild */
    incrementalWatch: boolean;
    /** Reserved: Next.js / Remix route adapters */
    frameworkAdapters: boolean;
    /** Reserved: CI / PR impact checks */
    ciIntegration: boolean;
    /** Reserved: shared team graph views */
    sharedViews: boolean;
  };
};

/** Marketing + CLI upgrade destinations (override via env in deploys). */
export function getSiteUrl(): string {
  return (
    process.env.ARCLENS_SITE_URL?.replace(/\/$/, "") ||
    process.env.SITE_URL?.replace(/\/$/, "") ||
    "https://arclens.dev"
  );
}

export function getPricingUrl(): string {
  return process.env.ARCLENS_PRICING_URL || `${getSiteUrl()}/#pricing`;
}

/**
 * Paddle Billing checkout share URL for Pro plan.
 * ARCLENS_CHECKOUT_PRO should be set to a Paddle checkout link, e.g.
 * https://buy.paddle.com/product/<product-id> or a custom share URL.
 */
export function getCheckoutUrl(plan: "pro"): string | null {
  const envKey = process.env.ARCLENS_CHECKOUT_PRO;
  return envKey?.trim() || null;
}

const PLAN_TABLE: Record<PlanId, Entitlements> = {
  free: {
    plan: "free",
    label: "Free",
    maxFiles: 1_000,
    features: {
      largeProjects: false,
      incrementalWatch: false,
      frameworkAdapters: false,
      ciIntegration: false,
      sharedViews: false,
    },
  },
  pro: {
    plan: "pro",
    label: "Pro",
    maxFiles: 25_000,
    features: {
      largeProjects: true,
      incrementalWatch: true,
      frameworkAdapters: true,
      ciIntegration: false,
      sharedViews: false,
    },
  },
};

/** Map Paddle Billing variant_name → plan id. */
export function planFromVariantName(variantName: string | undefined): PlanId {
  const name = (variantName ?? "").toLowerCase();
  if (name.includes("pro") || name.includes("plus")) return "pro";
  return "free";
}

export function entitlementsFor(plan: PlanId): Entitlements {
  return PLAN_TABLE[plan];
}

export function resolvePlanFromLicense(
  license: LicenseData | null
): PlanId {
  if (!license || license.status !== "active") return "free";
  return planFromVariantName(license.variantName);
}

/** Sync read of local license → current plan (no network). */
export function getActivePlan(): PlanId {
  return resolvePlanFromLicense(readLocalLicense());
}

export function getActiveEntitlements(): Entitlements {
  return entitlementsFor(getActivePlan());
}

export class PlanLimitError extends Error {
  readonly plan: PlanId;
  readonly limit: number;
  readonly requested: number;

  constructor(message: string, opts: { plan: PlanId; limit: number; requested: number }) {
    super(message);
    this.name = "PlanLimitError";
    this.plan = opts.plan;
    this.limit = opts.limit;
    this.requested = opts.requested;
  }
}

/**
 * Resolve the effective --max-files for this run.
 * Unspecified → plan default. Explicit value above plan ceiling → PlanLimitError.
 */
export function resolveMaxFiles(
  requestedRaw: string | undefined,
  entitlements: Entitlements = getActiveEntitlements()
): number {
  if (requestedRaw === undefined || requestedRaw === "") {
    return entitlements.maxFiles;
  }

  const requested = Number.parseInt(requestedRaw, 10);
  if (Number.isNaN(requested) || requested <= 0) {
    throw new Error("--max-files must be a positive number");
  }

  if (requested > entitlements.maxFiles) {
    throw new PlanLimitError(
      formatMaxFilesUpgradeMessage(requested, entitlements),
      {
        plan: entitlements.plan,
        limit: entitlements.maxFiles,
        requested,
      }
    );
  }

  return requested;
}

export function formatMaxFilesUpgradeMessage(
  requested: number,
  entitlements: Entitlements
): string {
  const pricing = getPricingUrl();
  const checkout = getCheckoutUrl("pro");
  const buyLine = checkout
    ? `Buy Pro: ${checkout}`
    : `Upgrade: ${pricing}`;

  if (entitlements.plan === "free") {
    return [
      `Your Free plan allows up to ${entitlements.maxFiles} files (requested --max-files ${requested}).`,
      `Scan a smaller folder (e.g. ./src), or upgrade to Pro for larger codebases.`,
      buyLine,
      `Then run: arclens activate <license-key>`,
    ].join("\n");
  }

  return [
    `Your ${entitlements.label} plan allows up to ${entitlements.maxFiles} files (requested ${requested}).`,
    `Scan a smaller folder or contact support if you need a higher ceiling.`,
    pricing,
  ].join("\n");
}

export function formatFileCountLimitMessage(
  fileCount: number,
  entitlements: Entitlements,
  effectiveLimit: number = entitlements.maxFiles
): string {
  const pricing = getPricingUrl();
  const checkout = getCheckoutUrl("pro");
  const buyLine = checkout
    ? `Buy Pro: ${checkout}`
    : `Upgrade: ${pricing}`;

  if (effectiveLimit < entitlements.maxFiles) {
    return [
      `Refusing to analyze ${fileCount} files (limit: ${effectiveLimit}).`,
      `Scan a smaller folder or raise --max-files (your ${entitlements.label} plan allows up to ${entitlements.maxFiles}).`,
    ].join("\n");
  }

  if (entitlements.plan === "free") {
    return [
      `Refusing to analyze ${fileCount} files (Free plan limit: ${entitlements.maxFiles}).`,
      `Scan a smaller folder (e.g. ./src), or upgrade to Pro for large projects.`,
      buyLine,
      `Then run: arclens activate <license-key>`,
    ].join("\n");
  }

  return [
    `Refusing to analyze ${fileCount} files (${entitlements.label} limit: ${entitlements.maxFiles}).`,
    `Scan a smaller folder or pass a lower --max-files value.`,
    pricing,
  ].join("\n");
}

/** Whether a reserved paid feature is unlocked on the active plan. */
export function hasFeature(
  feature: keyof Entitlements["features"],
  entitlements: Entitlements = getActiveEntitlements()
): boolean {
  return entitlements.features[feature];
}

export function formatUpgradeHint(featureLabel: string): string {
  const pricing = getPricingUrl();
  const checkout = getCheckoutUrl("pro");
  const buyLine = checkout ? `Buy Pro: ${checkout}` : `See plans: ${pricing}`;
  return [
    `${featureLabel} requires Arclens Pro.`,
    buyLine,
    `After purchase: arclens activate <license-key>`,
  ].join("\n");
}
