import { useCallback, useEffect, useRef, useState } from "react";
import { insightBadgeSummary } from "./insightHelpers";
import { InsightsPanel } from "./InsightsPanel";
import type { GraphInsight } from "./types";

type Props = {
  insights: GraphInsight[];
};

export function InsightsBadge({ insights }: Props) {
  const summary = insightBadgeSummary(insights);
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (drawerRef.current?.contains(target)) return;
      close();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, close]);

  if (!summary) return null;

  return (
    <div className="insights-badge" ref={drawerRef}>
      {open && (
        <div
          className="insights-badge__drawer"
          role="dialog"
          aria-label="Architecture insights"
        >
          <div className="insights-badge__drawer-header">
            <h2 className="insights-badge__drawer-title">Insights</h2>
            <button
              type="button"
              className="insights-badge__close"
              onClick={close}
              aria-label="Close insights"
            >
              ×
            </button>
          </div>
          <InsightsPanel insights={insights} variant="drawer" />
        </div>
      )}

      <button
        type="button"
        className={`insights-badge__pill insights-badge__pill--${summary.tone}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={
          summary.alertCount > 0
            ? `${summary.alertCount} architecture alerts`
            : `${summary.totalCount} architecture insights`
        }
      >
        {summary.label}
      </button>
    </div>
  );
}
