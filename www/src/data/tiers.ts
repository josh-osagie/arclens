export type TierId = 'free' | 'pro' | 'team' | 'enterprise';

export type TierCta = {
  label: string;
  href: string;
  kind: 'primary' | 'secondary' | 'ghost';
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
    id: 'free',
    name: 'Free',
    price: '$0',
    period: null,
    blurb: 'Local analyze, graph, and viewer for mid-size React/TS apps.',
    featured: true,
    features: [
      'Analyze, watch, and view locally',
      'Components, hooks, contexts, utilities',
      'Import, render, and use edges',
      'Viewer: search, clusters, node details',
      'Focus neighborhoods and edge toggles',
      'CLI insights and terminal report',
      'Docs and walkthroughs',
      'Soft file limits, community support',
    ],
    cta: {
      label: 'Get started',
      href: '#get-started',
      kind: 'primary',
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$5',
    period: '/seat/mo',
    blurb: 'For repos that outgrow local limits: scale, focus, and framework depth.',
    recommended: true,
    features: [
      'Higher file limits',
      'Large-graph performance',
      'Faster incremental watch',
      'Impact analysis beyond --focus',
      'Next.js depth when shipped',
    ],
    cta: {
      label: 'Join waitlist',
      href: 'mailto:joshx.dev@gmail.com?subject=Arclens%20Pro%20waitlist',
      kind: 'secondary',
    },
  },
  {
    id: 'team',
    name: 'Team',
    price: '$10',
    period: '/seat/mo',
    blurb: 'CI, shared views, and architecture health for the squad.',
    features: [
      'Everything in Pro',
      'CI and PR impact checks',
      'Shared saved views',
      'Architecture health reports',
      'Ownership overlay and monorepo',
    ],
    cta: {
      label: 'Join waitlist',
      href: 'mailto:joshx.dev@gmail.com?subject=Arclens%20Team%20waitlist',
      kind: 'ghost',
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Discuss',
    period: null,
    blurb: 'SSO, air-gap, custom adapters, and procurement paths.',
    features: [
      'SSO and private registry',
      'Custom adapters',
      'Support SLA',
      'Procurement-ready billing',
    ],
    cta: {
      label: 'Contact',
      href: 'mailto:joshx.dev@gmail.com?subject=Arclens%20Enterprise',
      kind: 'ghost',
    },
  },
];

export const DOCS_URL = 'https://arclens.vercel.app';
export const GITHUB_URL = 'https://github.com/josh-osagie/arclens';
export const NPM_URL = 'https://www.npmjs.com/package/arclens';
export const INSTALL_CMD = 'npm install -g arclens';
export const ANALYZE_CMD = 'npx arclens analyze ./src --insights';
