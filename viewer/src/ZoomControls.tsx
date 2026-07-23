import { Panel, useReactFlow, useViewport } from "@xyflow/react";

function FitViewIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <rect
        x="2.5"
        y="2.5"
        width="11"
        height="11"
        rx="1.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <circle cx="8" cy="8" r="1.35" fill="currentColor" />
    </svg>
  );
}

export function ZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const percent = Math.round(zoom * 100);

  return (
    <Panel position="bottom-left" className="zoom-controls-wrap">
      <div className="zoom-controls">
        <button
          type="button"
          className="zoom-controls__btn"
          onClick={() => zoomIn({ duration: 180 })}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="zoom-controls__btn"
          onClick={() => zoomOut({ duration: 180 })}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className="zoom-controls__btn"
          onClick={() => fitView({ padding: 0.22, duration: 280 })}
          aria-label="Fit view"
        >
          <FitViewIcon />
        </button>
        <span className="zoom-controls__label">{percent}%</span>
      </div>
    </Panel>
  );
}
