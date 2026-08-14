import { useMemo, useState, useEffect } from "react";
import { tiers, DOCS_URL, type Tier } from "../data/tiers";
import { usePaddlePrices } from "../hooks/usePaddlePrices";
import {
  type Environments,
  initializePaddle,
  type Paddle,
} from "@paddle/paddle-js";

interface Props {
  headline?: string;
  sub?: string;
  className?: string;
  country?: string;
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
  country = "OTHERS",
}: Props) {
  const [frequency, setFrequency] = useState<"month" | "year">("month");
  const [paddle, setPaddle] = useState<Paddle | undefined>();

  const { prices, loading } = usePaddlePrices(paddle, country);

  useEffect(() => {
    const token = import.meta.env.PUBLIC_PADDLE_CLIENT_TOKEN;
    const env = import.meta.env.PUBLIC_PADDLE_ENV as Environments;
    
    if (!env) {
      throw new Error("Missing PUBLIC_PADDLE_ENV environment variable. Never run without specifying the environment.");
    }

    if (!token) {
      console.warn("Missing PUBLIC_PADDLE_CLIENT_TOKEN");
      return;
    }

    initializePaddle({
      token,
      environment: env,
    }).then((p) => p && setPaddle(p));
  }, []);

  function handleSubscribe(tier: Tier) {
    if (tier.id === "free") {
      window.location.href = tier.cta.href;
      return;
    }

    if (!paddle || !tier.priceId) return;

    paddle.Checkout.open({
      items: [{ priceId: tier.priceId[frequency], quantity: 1 }],
      settings: {
        displayMode: "overlay",
        variant: "one-page",
        successUrl: `${window.location.origin}/welcome`,
      },
    });
  }

  return (
    <section
      className={`section pricing ${className}`}
      id="pricing"
      aria-labelledby="pricing-title"
    >
      <div className="wrap">
        <div className="section-head pricing-head mx-auto text-center flex flex-col items-center max-w-2xl">
          <p className="eyebrow">Pricing</p>
          <h2 id="pricing-title" className="text-center">{headline}</h2>
          <p className="pricing-sub text-center max-w-md">{sub}</p>
          
          <div className="mt-8 inline-flex items-center rounded-none border border-line bg-ink p-1">
            <button
              className={`rounded-none px-2 py-1 text-xs font-mono font-medium transition-colors ${
                frequency === "month"
                  ? "bg-accent text-ink"
                  : "text-text-muted hover:text-text"
              }`}
              onClick={() => setFrequency("month")}
            >
              Monthly
            </button>
            <button
              className={`relative group rounded-none px-4 py-1.5 text-xs font-mono font-medium transition-colors ${
                frequency === "year"
                  ? "bg-accent text-ink"
                  : "text-text-muted hover:text-text"
              }`}
              onClick={() => setFrequency("year")}
            >
              Annually
              {/* Mobile: inline label */}
              <span className="ml-1 text-xs opacity-75 sm:hidden">(Save 16%)</span>
              {/* Desktop: tooltip on hover */}
              <span className="pointer-events-none hidden sm:block absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-none bg-ink-raised border border-line px-2 py-0.5 font-mono text-[0.65rem] text-accent opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                Save 16%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 md:max-w-4xl md:mx-auto mt-4">
          {tiers.map((tier) => {
            const priceId = tier.priceId?.[frequency];
            const formattedPrice = priceId ? prices[priceId] : null;
            const displayPrice = tier.id === "pro" 
              ? (loading || !formattedPrice ? "..." : formattedPrice)
              : tier.price;
            
            const displayPeriod = tier.id === "pro" ? `/${frequency}` : tier.period;

            return (
              <article
                key={tier.id}
                className={tierClass(tier.id)}
                data-tier={tier.id}
              >
                {/* Fixed-height badge slot — keeps both cards aligned */}
                <div className="h-7 mb-3 flex items-center">
                  {tier.recommended ? (
                    <span className="pricing-badge m-0">Recommended</span>
                  ) : null}
                </div>

                {/* Header */}
                <header className="pricing-tier-header flex flex-col justify-start pb-4">
                  <p className="pricing-tier-name">{tier.name}</p>
                  <p className="pricing-price-row flex items-baseline gap-1 my-1">
                    <span className="pricing-price text-4xl font-semibold tracking-tight">{displayPrice}</span>
                    {displayPeriod ? (
                      <span className="pricing-period text-sm text-text-muted">{displayPeriod}</span>
                    ) : null}
                  </p>
                  <p className="pricing-blurb text-sm text-text-body">{tier.blurb}</p>
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
                  <button
                    className={`${ctaClass(tier.cta.kind)} w-full cursor-pointer`}
                    onClick={() => handleSubscribe(tier)}
                    disabled={tier.id === "pro" && !paddle}
                  >
                    {tier.cta.label}
                  </button>
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
            );
          })}
        </div>
      </div>
    </section>
  );
}
