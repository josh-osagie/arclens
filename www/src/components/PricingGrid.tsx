import { useMemo } from "react";
import { tiers, DOCS_URL, type Tier } from "../data/tiers";

interface Props {
  headline?: string;
  sub?: string;
  className?: string;
}

function ctaClass(kind: Tier["cta"]["kind"]) {
  if (kind === "primary") return "btn btn-primary";
  if (kind === "secondary") return "btn btn-secondary";
  return "btn btn-ghost";
}

type InlineSegment =
  | { kind: "text"; value: string }
  | { kind: "code"; value: string };

function parseInlineCode(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const regex = /`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: "text", value: text.slice(lastIndex, match.index) });
    }
    segments.push({ kind: "code", value: match[1] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: "text", value: text.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ kind: "text", value: text }];
}

function InlineText({ text }: { text: string }) {
  const segments = useMemo(() => parseInlineCode(text), [text]);
  return (
    <>
      {segments.map((seg, i) =>
        seg.kind === "code" ? (
          <code
            key={i}
            className="pricing-inline-code"
          >
            {seg.value}
          </code>
        ) : (
          <span key={i}>{seg.value}</span>
        )
      )}
    </>
  );
}

function tierClass(id: Tier["id"]) {
  const base =
    "pricing-tier flex flex-col border border-line bg-[rgba(13,20,32,0.75)] p-5 sm:p-6";
  if (id === "free") {
    return `${base} border-line-strong bg-gradient-to-b from-[rgba(18,27,42,0.95)] to-[rgba(13,20,32,0.7)]`;
  }
  if (id === "pro") {
    return `${base} border-[rgba(77,176,216,0.45)] bg-gradient-to-b from-[rgba(22,36,52,0.98)] to-[rgba(13,20,32,0.85)] shadow-[0_0_0_1px_rgba(77,176,216,0.12)]`;
  }
  return base;
}

export default function PricingGrid({
  headline = "Start free. Upgrade when it hurts.",
  sub = "Local-first. Pay for scale, framework depth, and team features.",
  className = "",
}: Props) {
  return (
    <section
      className={`section pricing ${className}`}
      id="pricing"
      aria-labelledby="pricing-title"
    >
      <div className="wrap">
        <div className="section-head pricing-head">
          <p className="eyebrow">Pricing</p>
          <h2 id="pricing-title">{headline}</h2>
          <p className="pricing-sub">{sub}</p>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-3">
          {tiers.map((tier) => (
            <article
              key={tier.id}
              className={tierClass(tier.id)}
              data-tier={tier.id}
            >
              {/* Badge Slot - Fixed height for identical baseline */}
              <div className="h-6 mb-2 flex items-center">
                {tier.recommended ? (
                  <span className="pricing-badge m-0">Recommended</span>
                ) : null}
              </div>

              {/* Header - Fixed min-height so divider lines align */}
              <header className="pricing-tier-header flex flex-col justify-start min-h-36.25 pb-4">
                <p className="pricing-tier-name">{tier.name}</p>
                <p className="pricing-price-row">
                  <span className="pricing-price">{tier.price}</span>
                  {tier.period ? (
                    <span className="pricing-period">{tier.period}</span>
                  ) : null}
                </p>
                <p className="pricing-blurb mt-1">{tier.blurb}</p>
              </header>

              {/* Features List */}
              <ul className="pricing-features flex-1 border-t border-line py-5 space-y-3 list-none m-0 p-0">
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-[0.8125rem] text-text-body leading-snug"
                  >
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <InlineText text={feature} />
                  </li>
                ))}
              </ul>

              {/* CTA Footer - Uniform button alignment */}
              <div className="mt-auto pt-4 flex flex-col items-center">
                <a
                  className={`${ctaClass(tier.cta.kind)} w-full`}
                  href={tier.cta.href}
                  {...(tier.cta.external
                    ? {
                        target: "_blank",
                        rel: "noopener noreferrer",
                      }
                    : {})}
                >
                  {tier.cta.label}
                </a>
                <div className="h-5 mt-2 flex items-center justify-center">
                  {tier.id === "free" ? (
                    <a
                      className="text-center text-sm text-text-muted no-underline hover:text-accent-strong"
                      href={DOCS_URL}
                    >
                      Docs
                    </a>
                  ) : (
                    <span className="text-center text-xs text-text-muted">
                      License key emailed after checkout
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
