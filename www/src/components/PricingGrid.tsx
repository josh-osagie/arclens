import { tiers, DOCS_URL, type Tier } from '../data/tiers';

interface Props {
  headline?: string;
  sub?: string;
  className?: string;
}

function ctaClass(kind: Tier['cta']['kind']) {
  if (kind === 'primary') return 'btn btn-primary';
  if (kind === 'secondary') return 'btn btn-secondary';
  return 'btn btn-ghost';
}

function tierClass(id: Tier['id']) {
  const base =
    'pricing-tier flex flex-col gap-2 border border-line bg-[rgba(13,20,32,0.75)] p-4 sm:p-5';
  if (id === 'free') {
    return `${base} border-line-strong bg-gradient-to-b from-[rgba(18,27,42,0.95)] to-[rgba(13,20,32,0.7)]`;
  }
  if (id === 'pro') {
    return `${base} border-[rgba(77,176,216,0.45)] bg-gradient-to-b from-[rgba(22,36,52,0.98)] to-[rgba(13,20,32,0.85)] shadow-[0_0_0_1px_rgba(77,176,216,0.12)]`;
  }
  return base;
}

export default function PricingGrid({
  headline = 'Start free. Upgrade when it hurts.',
  sub = 'Open core. Local-first. Pay for scale, frameworks, and teams.',
  className = '',
}: Props) {
  return (
    <section className={`section pricing ${className}`} id="pricing" aria-labelledby="pricing-title">
      <div className="wrap">
        <div className="section-head pricing-head">
          <p className="eyebrow">Pricing</p>
          <h2 id="pricing-title">{headline}</h2>
          <p className="pricing-sub">{sub}</p>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tiers.map((tier) => (
            <article key={tier.id} className={tierClass(tier.id)} data-tier={tier.id}>
              <header className="pricing-tier-header">
                {tier.recommended ? (
                  <span className="pricing-badge">Recommended</span>
                ) : null}
                <p className="pricing-tier-name">{tier.name}</p>
                <p className="pricing-price-row">
                  <span className="pricing-price">{tier.price}</span>
                  {tier.period ? <span className="pricing-period">{tier.period}</span> : null}
                </p>
                <p className="pricing-blurb">{tier.blurb}</p>
              </header>

              <ul className="feature-list pricing-features flex-1">
                {tier.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              <div className="mt-auto grid gap-1.5 pt-1">
                <a className={`${ctaClass(tier.cta.kind)} w-full`} href={tier.cta.href}>
                  {tier.cta.label}
                </a>
                {tier.id === 'free' ? (
                  <a
                    className="text-center text-[0.75rem] text-text-muted no-underline hover:text-accent-strong"
                    href={DOCS_URL}
                  >
                    Docs
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
