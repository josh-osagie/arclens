import {
  getProCheckoutUrl,
  hasLiveCheckout,
  isProComingSoon,
} from "./commerce";

export type TierId = "free" | "pro";

export type TierCta = {
  label: string;
  href: string;
  kind: "primary" | "secondary" | "ghost";
  /** Open Paddle Billing checkout in a new tab when live */
  external?: boolean;
};

export type Tier = {
  id: TierId;
  name: string;
  price: string;
  period: string | null;
  blurb: string;
  features: string[];
  cta: TierCta;
  priceId?: { month: string; year: string };
  recommended?: boolean;
  featured?: boolean;
};

/** Single source for pricing UI. Change prices here only. Checkout URLs come from env. */
export const tiers: Tier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: null,
    blurb: "Local analyze, graph, and viewer for mid-size React/TS apps.",
    featured: true,
    features: [
      "Local project analysis & AST mapping (up to 1,000 files)",
      "Component, hook, context & utility extraction",
      "Interactive graph viewer & neighborhood focus",
      "CLI terminal reports & orphan detection",
      "Export graph snapshot (`graph.json`)",
      "Community support & open documentation",
    ],
    cta: {
      label: "Get started",
      href: "#get-started",
      kind: "primary",
    },
  },
  {
    id: "pro",
    name: "Pro",
    price: "$5",
    period: "/month",
    blurb:
      "For repos that outgrow Free limits: larger graphs, Next.js depth, and Pro insights.",
    priceId: {
      month: "pri_01m00nnjq4kgg4n02g09agqwpp",
      year: "pri_01m00np50cn2pnk0m70cpz9m2g",
    },
    recommended: true,
    features: [
      "Everything in Free tier",
      "Large codebase support (up to 25,000 files)",
      "Next.js App Router + Pages Router adapter",
      "Circular dependency & coupling detection (Pro insights)",
      "Pro roadmap: incremental watch & impact depth",
      "Priority email & GitHub issue support",
      "Paddle Billing handles global tax + email receipt delivery",
    ],
    cta: {
      label: isProComingSoon() ? "Coming soon" : "Get Pro",
      href: getProCheckoutUrl(),
      kind: "secondary",
      external: hasLiveCheckout("pro") && !isProComingSoon(),
    },
  },
];

export const DOCS_URL = import.meta.env.PUBLIC_DOCS_URL || "/docs";
export const GITHUB_URL = "https://github.com/josh-osagie/arclens";
export const NPM_URL = "https://www.npmjs.com/package/arclens";
export const INSTALL_CMD = "npm install -g arclens";
export const ANALYZE_CMD = "npx arclens analyze ./src --insights";
/** License key validation uses Paddle Billing — see ARCLENS_PADDLE_API_BASE_URL in root .env */
export const INSTALL_CMD_PRO = "npx arclens install-pro <license-key>";
