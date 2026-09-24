/**
 * Public commerce URLs for the marketing site (Paddle Billing checkouts).
 * Set these in www/.env / Vercel — never hardcode live checkout links in git.
 */

export function getSiteOrigin(): string {
  const fromEnv = import.meta.env.PUBLIC_SITE_URL || import.meta.env.SITE;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.replace(/\/$/, "");
  }
  return "https://arclens.dev";
}

/** Paddle Billing checkout for Pro. Empty → pricing anchor until prices are live. */
export function getProCheckoutUrl(): string {
  return (
    import.meta.env.PUBLIC_PADDLE_CHECKOUT_PRO?.trim() ||
    `${getSiteOrigin()}/#pricing`
  );
}

export function hasLiveCheckout(plan: "pro"): boolean {
  const raw = import.meta.env.PUBLIC_PADDLE_CHECKOUT_PRO;
  return Boolean(raw?.trim());
}

/**
 * Pro sales gate for the marketing site. Defaults to coming soon so a deploy
 * with Paddle env vars does not open checkout until you opt in.
 *
 * Set PUBLIC_PRO_AVAILABLE=true in production when Pro is ready to sell.
 */
export function isProComingSoon(): boolean {
  const flag = import.meta.env.PUBLIC_PRO_AVAILABLE;
  if (flag === "true") return false;
  if (flag === "false") return true;
  return true;
}

/** Paddle overlay checkout is allowed only when Pro is live and configured. */
export function isProCheckoutLive(): boolean {
  return !isProComingSoon() && hasLiveCheckout("pro");
}
