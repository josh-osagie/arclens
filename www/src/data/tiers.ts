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
      "Unlimited local project analysis & AST mapping",
      "Component, hook, context & utility extraction",
      "Interactive graph viewer & neighborhood focus",
      "CLI terminal reports & orphan detection",
      "Export graph snapshot (.arclens/graph.json)",
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
      "For repos that outgrow local limits: scale, impact analysis, and framework depth.",
    recommended: true,
    features: [
      "Everything in Free tier",
      "Large codebase support (>1,000 files & nodes)",
      "Fast incremental file-watcher engine",
      "Deep impact analysis & dependency tracing",
      "Next.js & Remix framework router depth",
      "Priority email & GitHub issue support",
    ],
    cta: {
      label: "Get Pro",
      href: "#get-started",
      kind: "secondary",
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
      "Automated GitHub Actions & CI impact checks",
      "Shared team architecture graph views",
      "PR change risk & architecture debt reports",
      "Monorepo multi-package graph workspace",
      "Priority team support & setup assistance",
    ],
    cta: {
      label: "Get Team",
      href: "#get-started",
      kind: "ghost",
    },
  },
];

export const DOCS_URL = import.meta.env.PUBLIC_DOCS_URL || "/docs";
export const GITHUB_URL = "https://github.com/josh-osagie/arclens";
export const NPM_URL = "https://www.npmjs.com/package/arclens";
export const INSTALL_CMD = "npm install -g arclens";
export const ANALYZE_CMD = "npx arclens analyze ./src --insights";
