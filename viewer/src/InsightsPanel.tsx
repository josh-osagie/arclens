import { useMemo, useState } from "react";
import {
  categorizeInsight,
  findNodeForInsight,
  INSIGHT_CATEGORY_LABELS,
  type InsightCategory,
} from "./insightHelpers";
import type { AtlasGraphNode, GraphInsight } from "./types";
import { InfoTip } from "./InfoTip";

const severityOrder = { error: 0, warning: 1, info: 2, tip: 3 } as const;
const CATEGORY_ORDER: InsightCategory[] = [
  "hooks",
  "naming",
  "unused",
  "imports",
  "other",
];

type Props = {
  insights: GraphInsight[];
  nodes?: AtlasGraphNode[];
  onInsightClick?: (insight: GraphInsight) => void;
  /** Drawer mode shows all items in a floating panel; default sidebar card caps at 8. */
  variant?: "sidebar" | "drawer";
};

export function InsightsPanel({
  insights,
  nodes = [],
  onInsightClick,
  variant = "sidebar",
}: Props) {
  const [activeCategory, setActiveCategory] = useState<
    InsightCategory | "all"
  >("all");

  const sorted = useMemo(
    () =>
      [...insights].sort(
        (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
      ),
    [insights]
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<InsightCategory, number>();
    for (const insight of sorted) {
      const cat = categorizeInsight(insight);
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return counts;
  }, [sorted]);

  if (insights.length === 0) return null;

  const isDrawer = variant === "drawer";
  const filtered =
    isDrawer && activeCategory !== "all"
      ? sorted.filter((insight) => categorizeInsight(insight) === activeCategory)
      : sorted;
  const shown = isDrawer ? filtered : filtered.slice(0, 8);
  const remaining = filtered.length - shown.length;
  const nonEmptyCategories = CATEGORY_ORDER.filter(
    (cat) => (categoryCounts.get(cat) ?? 0) > 0
  );

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

      {isDrawer && nonEmptyCategories.length > 1 && (
        <div
          className="insights-panel__filters"
          role="group"
          aria-label="Filter insights by category"
        >
          <button
            type="button"
            className={`insights-panel__filter${activeCategory === "all" ? " insights-panel__filter--active" : ""}`}
            onClick={() => setActiveCategory("all")}
          >
            All ({sorted.length})
          </button>
          {nonEmptyCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`insights-panel__filter${activeCategory === cat ? " insights-panel__filter--active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {INSIGHT_CATEGORY_LABELS[cat]} ({categoryCounts.get(cat) ?? 0})
            </button>
          ))}
        </div>
      )}

      <div
        className={`insights-panel__scroll${isDrawer ? " insights-panel__scroll--drawer" : ""} atlas-scroll`}
      >
        <ul className="insights-panel__list">
          {shown.map((insight, index) => {
            const matchedNode =
              onInsightClick && nodes.length > 0
                ? findNodeForInsight(insight, nodes)
                : null;
            const clickable = Boolean(onInsightClick && matchedNode);

            return (
              <li
                key={`${insight.title}-${insight.file ?? ""}-${index}`}
                className={`insights-panel__item insights-panel__item--${insight.severity}${clickable ? " insights-panel__item--clickable" : ""}`}
              >
                {clickable ? (
                  <button
                    type="button"
                    className="insights-panel__item-btn"
                    onClick={() => onInsightClick?.(insight)}
                  >
                    <span className="insights-panel__item-head">
                      <span className="insights-panel__item-title">
                        {insight.title}
                      </span>
                      <span className="insights-panel__item-jump">Jump →</span>
                    </span>
                    <span className="insights-panel__item-detail">
                      {insight.detail}
                    </span>
                    {insight.file && (
                      <span className="insights-panel__item-file">
                        {insight.file}
                      </span>
                    )}
                  </button>
                ) : (
                  <>
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
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {!isDrawer && remaining > 0 && (
        <p className="insights-panel__more">+{remaining} more in CLI report</p>
      )}
    </div>
  );
}
