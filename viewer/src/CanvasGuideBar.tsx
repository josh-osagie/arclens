import { useState } from "react";
import { folderKey } from "./clusterGraph";
import { readLocalStorage, writeLocalStorage } from "./storageCompat";
import type { AtlasGraphNode } from "./types";

const GUIDE_DISMISSED_KEY = "arclens-guide-dismissed";

export function openCommandPalette(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("arclens:open-command-palette"));
  }
}

type Props = {
  isBuilding: boolean;
  activeDomain: string | null;
  selectedNode: AtlasGraphNode | null;
  searchLower: string;
  matchCount: number;
  clusterMode: boolean;
  primaryEntry: { name: string; fileLabel: string } | null;
  topDomain: string | null;
  onTraceFromEntry: () => void;
  onOpenTopDomain: () => void;
  onBackToOverview: () => void;
  onSelectDomainCrumb: (domain: string) => void;
};

function loadGuideDismissed(): boolean {
  try {
    return readLocalStorage(GUIDE_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function CanvasGuideBar({
  isBuilding,
  activeDomain,
  selectedNode,
  searchLower,
  matchCount,
  clusterMode,
  primaryEntry,
  topDomain,
  onTraceFromEntry,
  onOpenTopDomain,
  onBackToOverview,
  onSelectDomainCrumb,
}: Props) {
  const [dismissed, setDismissed] = useState<boolean>(loadGuideDismissed);

  const setGuideDismissed = (next: boolean) => {
    setDismissed(next);
    try {
      writeLocalStorage(GUIDE_DISMISSED_KEY, next ? "1" : "0");
    } catch {
      // ignore storage failures
    }
  };

  if (isBuilding) {
    return (
      <div className="canvas-guide-wrap">
        <div className="canvas-guide-bar canvas-guide-bar--status">
          <span className="canvas-guide-bar__status-text">Building view…</span>
        </div>
      </div>
    );
  }

  const derivedDomain =
    activeDomain ??
    (selectedNode && !selectedNode.cluster && selectedNode.file !== "external"
      ? folderKey(selectedNode.file)
      : null);

  const inFocusedView = Boolean(activeDomain || selectedNode || searchLower);

  if (inFocusedView) {
    return (
      <div className="canvas-guide-wrap">
        <nav className="canvas-guide-bar" aria-label="Explorer breadcrumb">
          <div className="canvas-guide-bar__crumbs">
            <button
              type="button"
              className="canvas-guide-bar__crumb"
              onClick={onBackToOverview}
            >
              Overview
            </button>

            {derivedDomain && (
              <>
                <span className="canvas-guide-bar__sep" aria-hidden="true">
                  ›
                </span>
                {selectedNode && !selectedNode.cluster ? (
                  <button
                    type="button"
                    className="canvas-guide-bar__crumb"
                    onClick={() => onSelectDomainCrumb(derivedDomain)}
                    title={`Show all of ${derivedDomain}`}
                  >
                    {derivedDomain}
                  </button>
                ) : (
                  <span className="canvas-guide-bar__crumb canvas-guide-bar__crumb--current">
                    {derivedDomain}
                  </span>
                )}
              </>
            )}

            {selectedNode && !selectedNode.cluster && (
              <>
                <span className="canvas-guide-bar__sep" aria-hidden="true">
                  ›
                </span>
                <span className="canvas-guide-bar__crumb canvas-guide-bar__crumb--current">
                  {selectedNode.name}
                </span>
              </>
            )}

            {searchLower && (
              <>
                <span className="canvas-guide-bar__sep" aria-hidden="true">
                  ·
                </span>
                <span className="canvas-guide-bar__meta">
                  {matchCount} match{matchCount === 1 ? "" : "es"}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            className="canvas-guide-bar__btn canvas-guide-bar__btn--back"
            onClick={onBackToOverview}
          >
            ← Overview
          </button>
        </nav>
      </div>
    );
  }

  if (dismissed) {
    return (
      <div className="canvas-guide-wrap canvas-guide-wrap--compact">
        <button
          type="button"
          className="canvas-guide-restore"
          onClick={() => setGuideDismissed(false)}
          title="Show quick start guide"
          aria-label="Show quick start guide"
        >
          ? Guide
        </button>
      </div>
    );
  }

  return (
    <div className="canvas-guide-wrap">
      <div className="canvas-guide-bar" role="region" aria-label="Quick start">
        <span className="canvas-guide-bar__label">Start here</span>

        {primaryEntry && (
          <button
            type="button"
            className="canvas-guide-bar__btn canvas-guide-bar__btn--primary"
            onClick={onTraceFromEntry}
            title={`Jump to ${primaryEntry.fileLabel}`}
          >
            Trace from entry
            <span className="canvas-guide-bar__hint-chip">
              {primaryEntry.fileLabel}
            </span>
          </button>
        )}

        {clusterMode && topDomain ? (
          <button
            type="button"
            className="canvas-guide-bar__btn"
            onClick={onOpenTopDomain}
            title={`Drill into ${topDomain}`}
          >
            Click a domain
            <span className="canvas-guide-bar__hint-chip">{topDomain}</span>
          </button>
        ) : (
          <span className="canvas-guide-bar__meta">
            Click a node to inspect connections
          </span>
        )}

        <button
          type="button"
          className="canvas-guide-bar__btn"
          onClick={openCommandPalette}
          title="Open command palette"
        >
          Search <kbd className="canvas-guide-bar__kbd">⌘K</kbd>
        </button>

        <button
          type="button"
          className="canvas-guide-bar__dismiss"
          onClick={() => setGuideDismissed(true)}
          aria-label="Dismiss guide"
          title="Dismiss guide"
        >
          ×
        </button>
      </div>
    </div>
  );
}
