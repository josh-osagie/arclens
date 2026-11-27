import { useCallback, useEffect, useRef, useState } from "react";
import { insightBadgeSummary } from "./insightHelpers";
import { InsightsPanel } from "./InsightsPanel";
import type { AtlasGraphNode, GraphInsight } from "./types";

type Props = {
  insights: GraphInsight[];
  nodes?: AtlasGraphNode[];
  onInsightClick?: (insight: GraphInsight) => void;
  placement?: "floating" | "header";
};

export function InsightsBadge({
  insights,
  nodes,
  onInsightClick,
  placement = "floating",
}: Props) {
  const summary = insightBadgeSummary(insights);
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (drawerRef.current?.contains(target)) return;
      close();
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, close]);

  const handleInsightClick = useCallback(
    (insight: GraphInsight) => {
      onInsightClick?.(insight);
      close();
    },
    [onInsightClick, close]
  );

  if (!summary) return null;

  return (
    <div
      className={`insights-badge ${placement === "header" ? "insights-badge--header" : ""}`.trim()}
      ref={drawerRef}
    >
      <button
        type="button"
        className={`insights-badge__pill insights-badge__pill--${summary.tone}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={
          summary.alertCount > 0
            ? `${summary.alertCount} architecture alerts (${summary.totalCount} total insights)`
            : `${summary.totalCount} architecture insights`
        }
      >
        {summary.label}
      </button>

      {open && (
        <div
          className="insights-badge__drawer"
          role="dialog"
          aria-label="Architecture insights"
        >
          <div className="insights-badge__drawer-header">
            <h2 className="insights-badge__drawer-title">
              Insights ({insights.length})
            </h2>
            <button
              type="button"
              className="insights-badge__close"
              onClick={close}
              aria-label="Close insights"
            >
              ×
            </button>
          </div>
          <InsightsPanel
            insights={insights}
            nodes={nodes}
            onInsightClick={onInsightClick ? handleInsightClick : undefined}
            variant="drawer"
          />
        </div>
      )}
    </div>
  );
}
