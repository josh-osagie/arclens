import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, useReactFlow, useViewport } from "@xyflow/react";
import { triggerExport } from "./exportGraphBridge";
import {
  loadExportScope,
  saveExportScope,
  type ExportScope,
} from "./exportPrefs";

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

function ExportIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M8 2.25v7.5M5.25 6.75 8 9.5l2.75-2.75M3.5 11.75v1.25c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25v-1.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const percent = Math.round(zoom * 100);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope>(() =>
    loadExportScope()
  );
  const wrapRef = useRef<HTMLDivElement>(null);

  const runExport = useCallback(
    async (format: "png" | "svg") => {
      setExporting(true);
      try {
        await triggerExport(format, { scope: exportScope });
      } catch (error) {
        console.error("Graph export failed", error);
      } finally {
        setExporting(false);
        setMenuOpen(false);
      }
    },
    [exportScope]
  );

  const onScopeChange = useCallback((fullGraph: boolean) => {
    const scope: ExportScope = fullGraph ? "full" : "viewport";
    setExportScope(scope);
    saveExportScope(scope);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  return (
    <Panel position="bottom-left" className="zoom-controls-wrap">
      <div ref={wrapRef} className="export-controls">
        {menuOpen && (
          <div
            className="export-controls__menu"
            role="menu"
            aria-label="Export graph"
          >
            <label className="export-controls__scope">
              <input
                type="checkbox"
                checked={exportScope === "full"}
                disabled={exporting}
                onChange={(event) => onScopeChange(event.target.checked)}
                onPointerDown={(event) => event.stopPropagation()}
              />
              <span className="export-controls__scope-text">
                <span className="export-controls__scope-label">
                  Export full graph
                </span>
                <span className="export-controls__scope-hint">
                  {exportScope === "full"
                    ? "Fits all nodes, then captures"
                    : "Captures current view (default)"}
                </span>
              </span>
            </label>
            <div className="export-controls__divider" aria-hidden="true" />
            <button
              type="button"
              className="export-controls__item"
              role="menuitem"
              disabled={exporting}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => void runExport("png")}
            >
              Export PNG
            </button>
            <button
              type="button"
              className="export-controls__item"
              role="menuitem"
              disabled={exporting}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => void runExport("svg")}
            >
              Export SVG
            </button>
          </div>
        )}

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
          <button
            type="button"
            className="zoom-controls__btn"
            aria-label="Export graph"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            disabled={exporting}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <ExportIcon />
          </button>
          <span className="zoom-controls__label">{percent}%</span>
        </div>
      </div>
    </Panel>
  );
}
