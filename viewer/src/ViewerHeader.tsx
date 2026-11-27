import { folderKey } from "./clusterGraph";
import { openCommandPalette } from "./CanvasGuideBar";
import { InsightsBadge } from "./InsightsBadge";
import type { AtlasGraphNode, GraphInsight } from "./types";

type BridgeInfo = {
  fromDomain: string;
  count: number;
};

type Props = {
  projectName?: string;
  totalNodes: number;
  totalEdges: number;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  isBuilding: boolean;
  activeDomain: string | null;
  domainTrail: readonly string[];
  selectedDomain: string | null;
  selectedNode: AtlasGraphNode | null;
  bridgeInfo: BridgeInfo | null;
  onClearBridge: () => void;
  searchLower: string;
  matchCount: number;
  primaryEntry: { name: string; fileLabel: string } | null;
  insights?: GraphInsight[];
  allNodes: AtlasGraphNode[];
  onInsightClick: (insight: GraphInsight) => void;
  onTraceFromEntry: () => void;
  onStepBack: () => void;
  onBackToOverview: () => void;
  onSelectTrailDomain: (domain: string, index: number) => void;
};

function SidebarToggleIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <rect
        x="2"
        y="2.5"
        width="12"
        height="11"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path d="M6 2.5v11" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

export function ViewerHeader({
  projectName,
  totalNodes,
  totalEdges,
  sidebarOpen,
  onToggleSidebar,
  isBuilding,
  activeDomain,
  domainTrail,
  selectedDomain,
  selectedNode,
  bridgeInfo,
  onClearBridge,
  searchLower,
  matchCount,
  primaryEntry,
  insights,
  allNodes,
  onInsightClick,
  onTraceFromEntry,
  onStepBack,
  onBackToOverview,
  onSelectTrailDomain,
}: Props) {
  const effectiveTrail: string[] =
    domainTrail.length > 0
      ? [...domainTrail]
      : activeDomain
        ? [activeDomain]
        : selectedDomain
          ? [selectedDomain]
          : selectedNode &&
              !selectedNode.cluster &&
              selectedNode.file !== "external"
            ? [folderKey(selectedNode.file)]
            : [];

  const canStepBack = Boolean(activeDomain || searchLower);
  const hasCrumbs =
    canStepBack || effectiveTrail.length > 0 || Boolean(selectedNode);
  const hasSelectedSymbol = Boolean(selectedNode && !selectedNode.cluster);

  return (
    <header className="viewer-header">
      <div className="viewer-header__left">
        <button
          type="button"
          className={`viewer-header__icon-btn${sidebarOpen ? " viewer-header__icon-btn--active" : ""}`}
          onClick={onToggleSidebar}
          aria-label={
            sidebarOpen ? "Hide explorer sidebar" : "Show explorer sidebar"
          }
          title={
            sidebarOpen ? "Hide explorer sidebar" : "Show explorer sidebar"
          }
        >
          <SidebarToggleIcon />
        </button>

        <div className="viewer-header__project">
          <span className="viewer-header__project-name">
            {projectName ?? "arclens"}
          </span>
          <span className="viewer-header__project-stats">
            {totalNodes} nodes · {totalEdges} edges
          </span>
        </div>
      </div>

      <div className="viewer-header__center">
        {hasCrumbs ? (
          <nav className="viewer-header__crumbs" aria-label="Explorer breadcrumb">
            {canStepBack && (
              <button
                type="button"
                className="viewer-header__back-btn"
                onClick={onStepBack}
                title="Step back to previous view (Esc)"
              >
                ← Back
              </button>
            )}

            <button
              type="button"
              className={`viewer-header__crumb${effectiveTrail.length === 0 && !hasSelectedSymbol && !searchLower ? " viewer-header__crumb--current" : ""}`}
              onClick={onBackToOverview}
              title="Return to system overview"
            >
              Overview
            </button>

            {effectiveTrail.map((crumbDomain, idx) => {
              const isLastDomain = idx === effectiveTrail.length - 1;
              const isCurrent = isLastDomain && !hasSelectedSymbol;

              return (
                <span key={`${crumbDomain}-${idx}`} className="viewer-header__crumb-group">
                  <span className="viewer-header__sep" aria-hidden="true">
                    ›
                  </span>
                  {isCurrent ? (
                    <span className="viewer-header__crumb viewer-header__crumb--current">
                      {crumbDomain}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="viewer-header__crumb"
                      onClick={() => onSelectTrailDomain(crumbDomain, idx)}
                      title={`Jump back to ${crumbDomain}`}
                    >
                      {crumbDomain}
                    </button>
                  )}
                </span>
              );
            })}

            {hasSelectedSymbol && selectedNode && (
              <span className="viewer-header__crumb-group">
                <span className="viewer-header__sep" aria-hidden="true">
                  ›
                </span>
                <span className="viewer-header__crumb viewer-header__crumb--current">
                  {selectedNode.name}
                </span>
              </span>
            )}

            {bridgeInfo && (
              <button
                type="button"
                className="viewer-header__bridge-chip"
                onClick={onClearBridge}
                title="Click to show all symbols in this domain"
              >
                <span>
                  {bridgeInfo.count} linked from {bridgeInfo.fromDomain}
                </span>
                <span className="viewer-header__bridge-clear" aria-hidden="true">
                  · Show all ×
                </span>
              </button>
            )}

            {searchLower && (
              <>
                <span className="viewer-header__sep" aria-hidden="true">
                  ·
                </span>
                <span className="viewer-header__hint">
                  {matchCount} match{matchCount === 1 ? "" : "es"}
                </span>
              </>
            )}
          </nav>
        ) : (
          <div className="viewer-header__quickstart">
            {primaryEntry && (
              <button
                type="button"
                className="viewer-header__pill viewer-header__pill--primary"
                onClick={onTraceFromEntry}
                title={`Open entry point (${primaryEntry.fileLabel})`}
              >
                Trace from entry
                <span className="viewer-header__pill-sub">
                  {primaryEntry.fileLabel}
                </span>
              </button>
            )}
            <span className="viewer-header__hint">
              Hover or click a domain to trace links · Double-click to open
            </span>
          </div>
        )}
      </div>

      <div className="viewer-header__right">
        {isBuilding && (
          <span className="viewer-header__building">updating…</span>
        )}

        <button
          type="button"
          className="viewer-header__pill"
          onClick={openCommandPalette}
          title="Search symbols & commands (⌘K)"
        >
          Search <kbd className="viewer-header__kbd">⌘K</kbd>
        </button>

        {insights && insights.length > 0 && (
          <InsightsBadge
            insights={insights}
            nodes={allNodes}
            onInsightClick={onInsightClick}
            placement="header"
          />
        )}
      </div>
    </header>
  );
}
