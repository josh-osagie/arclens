import { openCommandPalette } from "./features/command-palette/CommandPalette";
import { humanizeAreaIdentity } from "./humanSemantics";
import { InsightsBadge } from "./InsightsBadge";
import type { AtlasGraphNode, GraphInsight } from "./types";

export type BreadcrumbTrailItem = {
  scopeKey: string;
  label: string;
  sublabel?: string;
  isCurrent: boolean;
};

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
  canStepBack: boolean;
  trailItems: readonly BreadcrumbTrailItem[];
  hasFocusedStory: boolean;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
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
  onSelectTrailItem: (scopeKey: string) => void;
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
  canStepBack,
  trailItems,
  hasFocusedStory,
  inspectorOpen,
  onToggleInspector,
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
  onSelectTrailItem,
}: Props) {
  const showBreadcrumbs =
    canStepBack || trailItems.length > 1 || Boolean(searchLower);

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
          <span
            className="viewer-header__project-stats"
            title={`${totalNodes} analyzed elements · ${totalEdges} relationships`}
          >
            {totalNodes} elements
          </span>
        </div>
      </div>

      <div className="viewer-header__center">
        {showBreadcrumbs ? (
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

            {trailItems.map((item, idx) => (
              <span key={`${item.scopeKey}-${idx}`} className="viewer-header__crumb-group">
                {idx > 0 && (
                  <span className="viewer-header__sep" aria-hidden="true">
                    ›
                  </span>
                )}
                {item.isCurrent ? (
                  <span className="viewer-header__crumb viewer-header__crumb--current">
                    {item.label}
                    {item.sublabel && (
                      <span className="viewer-header__crumb-sub">
                        {" "}
                        · {item.sublabel}
                      </span>
                    )}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="viewer-header__crumb"
                    onClick={() => onSelectTrailItem(item.scopeKey)}
                    title={`Return to ${item.label}`}
                  >
                    {item.label}
                  </button>
                )}
              </span>
            ))}

            {bridgeInfo && (
              <button
                type="button"
                className="viewer-header__bridge-chip"
                onClick={onClearBridge}
                title="Click to show all items in this area"
              >
                <span>
                  {bridgeInfo.count} connected from{" "}
                  {humanizeAreaIdentity(bridgeInfo.fromDomain).title}
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
                title={`Start exploring from ${primaryEntry.name} (${primaryEntry.fileLabel})`}
              >
                Start from app entry
              </button>
            )}
            <span className="viewer-header__hint">
              Click an area to see what it does · Double-click or click Explore to step inside
            </span>
          </div>
        )}
      </div>

      <div className="viewer-header__right">
        {isBuilding && (
          <span className="viewer-header__building">updating…</span>
        )}

        {hasFocusedStory && (
          <button
            type="button"
            className={`viewer-header__pill${inspectorOpen ? " viewer-header__pill--primary" : ""}`}
            onClick={onToggleInspector}
            title="Show or hide code snippet, props, and technical metadata"
          >
            {inspectorOpen ? "Hide code" : "Technical details"}
          </button>
        )}

        <button
          type="button"
          className="viewer-header__pill"
          onClick={openCommandPalette}
          title="Search features, screens, & commands (⌘K)"
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
