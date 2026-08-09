/**
 * Public commerce URLs for the marketing site (Lemon Squeezy checkouts).
 * Set these in www/.env / Vercel — never hardcode live checkout links in git.
 */

export function getSiteOrigin(): string {
  const fromEnv = import.meta.env.PUBLIC_SITE_URL || import.meta.env.SITE;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.replace(/\/$/, "");
  }
  return "https://arclens.dev";
}

/** Lemon Squeezy checkout for Pro. Empty → pricing anchor until products are live. */
export function getProCheckoutUrl(): string {
  return (
    import.meta.env.PUBLIC_LEMON_CHECKOUT_PRO?.trim() ||
    `${getSiteOrigin()}/#pricing`
  );
}

/** Lemon Squeezy checkout for Team. Empty → pricing anchor until products are live. */
export function getTeamCheckoutUrl(): string {
  return (
    import.meta.env.PUBLIC_LEMON_CHECKOUT_TEAM?.trim() ||
    `${getSiteOrigin()}/#pricing`
  );
}

export function hasLiveCheckout(plan: "pro" | "team"): boolean {
  const raw =
    plan === "pro"
      ? import.meta.env.PUBLIC_LEMON_CHECKOUT_PRO
      : import.meta.env.PUBLIC_LEMON_CHECKOUT_TEAM;
  return Boolean(raw?.trim());
}
