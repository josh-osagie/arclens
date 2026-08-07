export type TierId = "free" | "pro" | "team";

export type TierCta = {
  label: string;
  href: string;
  kind: "primary" | "secondary" | "ghost";
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

/** Single source for pricing UI. Change prices here only. */
export const tiers: Tier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: null,
    blurb: "Local analyze, graph, and viewer for mid-size React/TS apps.",
    featured: true,
    features: [
      "Analyze, watch, and view locally",
      "Components, hooks, contexts, utilities",
      "Import, render, and use edge maps",
      "Interactive search & cluster details",
      "Focus neighborhoods & edge toggles",
      "CLI insights & terminal reports",
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
      "For repos that outgrow local limits: scale, focus, and framework depth.",
    recommended: true,
    features: [
      "Everything in Free tier",
      "Higher file & node scaling limits",
      "Large-graph performance mode",
      "Faster incremental file watch engine",
      "Deep impact analysis beyond --focus",
      "Next.js framework depth support",
    ],
    cta: {
      label: "Join waitlist",
      href: "mailto:joshx.dev@gmail.com?subject=Arclens%20Pro%20waitlist",
      kind: "secondary",
    },
  },
  {
    id: "team",
    name: "Team",
    price: "$10",
    period: "/month",
    blurb: "CI, shared views, and architecture health for the squad.",
    features: [
      "Everything in Pro tier",
      "Automated CI & PR impact checks",
      "Shared saved architecture views",
      "Architecture health & debt reports",
      "Monorepo & ownership overlays",
      "Priority squad support & SLA",
    ],
    cta: {
      label: "Join waitlist",
      href: "mailto:joshx.dev@gmail.com?subject=Arclens%20Team%20waitlist",
      kind: "ghost",
    },
  },
];

export const DOCS_URL = "https://arclens.vercel.app";
export const GITHUB_URL = "https://github.com/josh-osagie/arclens";
export const NPM_URL = "https://www.npmjs.com/package/arclens";
export const INSTALL_CMD = "npm install -g arclens";
export const ANALYZE_CMD = "npx arclens analyze ./src --insights";
