import type { GraphInsight } from "./types";
import { InfoTip } from "./InfoTip";

const severityOrder = { error: 0, warning: 1, info: 2, tip: 3 } as const;

type Props = {
  insights: GraphInsight[];
  /** Drawer mode shows all items in a floating panel; default sidebar card caps at 8. */
  variant?: "sidebar" | "drawer";
};

export function InsightsPanel({ insights, variant = "sidebar" }: Props) {
  if (insights.length === 0) return null;

  const sorted = [...insights].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );
  const isDrawer = variant === "drawer";
  const shown = isDrawer ? sorted : sorted.slice(0, 8);
  const remaining = sorted.length - shown.length;

  return (
    <div
      className={`insights-panel${isDrawer ? " insights-panel--drawer" : ""}`}
    >
      {!isDrawer && (
        <h3 className="insights-panel__title">
          <span className="field-label">
            <span className="field-label__text">Insights</span>
            <InfoTip text="Architecture hints from analyze — same rules as CLI --insights." />
          </span>
        </h3>
      )}
      <div
        className={`insights-panel__scroll${isDrawer ? " insights-panel__scroll--drawer" : ""} atlas-scroll`}
      >
        <ul className="insights-panel__list">
          {shown.map((insight, index) => (
            <li
              key={`${insight.title}-${index}`}
              className={`insights-panel__item insights-panel__item--${insight.severity}`}
            >
              <span className="insights-panel__item-title">
                {insight.title}
              </span>
              <span className="insights-panel__item-detail">
                {insight.detail}
              </span>
              {insight.file && (
                <span className="insights-panel__item-file">
                  {insight.file}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      {!isDrawer && remaining > 0 && (
        <p className="insights-panel__more">+{remaining} more in CLI report</p>
      )}
    </div>
  );
}
