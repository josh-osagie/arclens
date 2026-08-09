import {
  getProCheckoutUrl,
  getTeamCheckoutUrl,
  hasLiveCheckout,
} from "./commerce";

export type TierId = "free" | "pro" | "team";

export type TierCta = {
  label: string;
  href: string;
  kind: "primary" | "secondary" | "ghost";
  /** Open Lemon Squeezy checkout in a new tab when live */
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
      "Export graph snapshot (graph.json)",
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
      "For repos that outgrow Free limits: larger graphs, scale, and Pro depth.",
    recommended: true,
    features: [
      "Everything in Free tier",
      "Large codebase support (up to 25,000 files)",
      "Higher --max-files ceiling & large-graph UX",
      "Pro roadmap: incremental watch & impact depth",
      "Pro roadmap: Next.js & Remix router adapters",
      "Priority email & GitHub issue support",
    ],
    cta: {
      label: hasLiveCheckout("pro") ? "Get Pro" : "Get Pro",
      href: getProCheckoutUrl(),
      kind: "secondary",
      external: hasLiveCheckout("pro"),
    },
  },
  {
    id: "team",
    name: "Team",
    price: "$10",
    period: "/month",
    blurb: "CI integration, shared architecture views, and PR impact reports.",
    features: [
      "Everything in Pro tier",
      "Higher scale ceiling (up to 100,000 files)",
      "Team roadmap: GitHub Actions & CI impact checks",
      "Team roadmap: shared graph views & PR reports",
      "Team roadmap: monorepo workspace graphs",
      "Priority team support & setup assistance",
    ],
    cta: {
      label: hasLiveCheckout("team") ? "Get Team" : "Get Team",
      href: getTeamCheckoutUrl(),
      kind: "ghost",
      external: hasLiveCheckout("team"),
    },
  },
];

export const DOCS_URL = import.meta.env.PUBLIC_DOCS_URL || "/docs";
export const GITHUB_URL = "https://github.com/josh-osagie/arclens";
export const NPM_URL = "https://www.npmjs.com/package/arclens";
export const INSTALL_CMD = "npm install -g arclens";
export const ANALYZE_CMD = "npx arclens analyze ./src --insights";
export const ACTIVATE_CMD = "arclens activate <license-key>";
