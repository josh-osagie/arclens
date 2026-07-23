import type { GraphInsight } from "./types";

const severityOrder = { error: 0, warning: 1, info: 2, tip: 3 } as const;

type Props = {
  insights: GraphInsight[];
};

export function InsightsPanel({ insights }: Props) {
  if (insights.length === 0) return null;

  const sorted = [...insights].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );
  const shown = sorted.slice(0, 8);
  const remaining = sorted.length - shown.length;

  return (
    <div className="insights-panel">
      <h3 className="insights-panel__title">Insights</h3>
      <div className="insights-panel__scroll atlas-scroll">
        <ul className="insights-panel__list">
          {shown.map((insight, index) => (
            <li
              key={`${insight.title}-${index}`}
              className={`insights-panel__item insights-panel__item--${insight.severity}`}
            >
              <span className="insights-panel__item-title">{insight.title}</span>
              <span className="insights-panel__item-detail">{insight.detail}</span>
              {insight.file && (
                <span className="insights-panel__item-file">{insight.file}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
      {remaining > 0 && (
        <p className="insights-panel__more">+{remaining} more in CLI report</p>
      )}
    </div>
  );
}
