import { useCallback, useState } from "react";
import { InfoTip } from "./InfoTip";
import {
  EDGE_TYPES,
  EDGE_VISIBILITY_LABELS,
  type EdgeVisibilityPrefs,
} from "./edgeVisibilityPrefs";
import { LAYOUT_PRESETS, type LayoutPreset } from "./layoutPresets";
import {
  loadSidebarSections,
  saveSidebarSections,
  toggleSidebarSection,
  type SidebarSectionPrefs,
} from "./sidebarPrefs";
import { ToggleSwitch } from "./ToggleSwitch";

type Props = {
  clusterMode: boolean;
  onClusterModeChange: (enabled: boolean) => void;
  neighborhoodFocus: boolean;
  onNeighborhoodFocusChange: (enabled: boolean) => void;
  neighborhoodHops: number;
  onNeighborhoodHopsChange: (hops: number) => void;
  showOverviewEdges: boolean;
  onShowOverviewEdgesChange: (enabled: boolean) => void;
  edgeVisibility: EdgeVisibilityPrefs;
  onEdgeVisibilityChange: (
    type: keyof EdgeVisibilityPrefs,
    visible: boolean
  ) => void;
  showExternalHooks: boolean;
  onShowExternalHooksChange: (enabled: boolean) => void;
  activeDomain: string | null;
  onBackToOverview: () => void;
  expandedSubfolderCount: number;
  onCollapseSubfolders: () => void;
  onShowFromEntry: () => void;
  layoutPreset: LayoutPreset;
  onLayoutPresetChange: (preset: LayoutPreset) => void;
  layoutDisabled: boolean;
};

export function GraphActions({
  clusterMode,
  onClusterModeChange,
  neighborhoodFocus,
  onNeighborhoodFocusChange,
  neighborhoodHops,
  onNeighborhoodHopsChange,
  showOverviewEdges,
  onShowOverviewEdgesChange,
  edgeVisibility,
  onEdgeVisibilityChange,
  showExternalHooks,
  onShowExternalHooksChange,
  activeDomain,
  onBackToOverview,
  expandedSubfolderCount,
  onCollapseSubfolders,
  onShowFromEntry,
  layoutPreset,
  onLayoutPresetChange,
  layoutDisabled,
}: Props) {
  const [sectionPrefs, setSectionPrefs] =
    useState<SidebarSectionPrefs>(loadSidebarSections);
  const expanded = sectionPrefs.graphControls;

  const onToggleSection = useCallback(() => {
    setSectionPrefs((prev) => {
      const next = toggleSidebarSection(prev, "graphControls");
      saveSidebarSections(next);
      return next;
    });
  }, []);

  return (
    <section className="graph-actions overview-shortcuts__section">
      <div className="overview-shortcuts__heading">
        <button
          type="button"
          className="overview-shortcuts__heading-toggle"
          onClick={onToggleSection}
          aria-expanded={expanded}
        >
          <span className="overview-shortcuts__chevron" aria-hidden="true">
            {expanded ? "▾" : "▸"}
          </span>
          <span className="field-label">
            <span className="overview-shortcuts__heading-label">
              Graph controls
            </span>
            <InfoTip
              text="Layout direction, domain grouping, focus depth, and edge visibility."
              nested
            />
          </span>
        </button>
      </div>

      {expanded && (
        <div className="graph-actions__body">
          <div className="graph-controls__field">
            <label
              className="graph-controls__field-label"
              htmlFor="layout-preset"
            >
              <span className="field-label">
                <span className="field-label__text">Layout</span>
                <InfoTip text="Tree direction used when viewing inside a domain or unclustered graph." />
              </span>
            </label>
            <select
              id="layout-preset"
              className="graph-select"
              value={layoutPreset}
              disabled={layoutDisabled}
              onChange={(event) =>
                onLayoutPresetChange(event.target.value as LayoutPreset)
              }
            >
              {LAYOUT_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          <div className="graph-actions__buttons">
            <button
              type="button"
              className="graph-actions__btn"
              onClick={onShowFromEntry}
            >
              From entry
            </button>
            {activeDomain && (
              <button
                type="button"
                className="graph-actions__btn"
                onClick={onBackToOverview}
              >
                Back to overview
              </button>
            )}
            {activeDomain && expandedSubfolderCount > 0 && (
              <button
                type="button"
                className="graph-actions__btn"
                onClick={onCollapseSubfolders}
              >
                Collapse sub-groups
              </button>
            )}
          </div>

          <div className="graph-toggles">
            <div className="graph-toggle">
              <span className="graph-toggle__label">
                <span className="field-label">
                  <span className="field-label__text">Cluster folders</span>
                  <InfoTip text="Group symbols into architectural domains on the system overview." />
                </span>
              </span>
              <ToggleSwitch
                checked={clusterMode}
                onChange={onClusterModeChange}
                ariaLabel="Cluster folders"
              />
            </div>

            <div className="graph-toggle">
              <span className="graph-toggle__label">
                <span className="field-label">
                  <span className="field-label__text">Overview lines</span>
                  <InfoTip text="Always show all cross-domain lines on the overview map. When off, lines appear cleanly as you hover or select a domain." />
                </span>
              </span>
              <ToggleSwitch
                checked={showOverviewEdges}
                onChange={onShowOverviewEdgesChange}
                ariaLabel="Overview lines"
              />
            </div>

            <div
              className={`graph-toggle${neighborhoodFocus ? " graph-toggle--expanded" : ""}`}
            >
              <div className="graph-toggle__main">
                <span className="graph-toggle__label">
                  <span className="field-label">
                    <span className="field-label__text">Dim distant nodes</span>
                    <InfoTip text="When a symbol is selected, keep it and nearby connections in focus while dimming unrelated nodes." />
                  </span>
                </span>
                <ToggleSwitch
                  checked={neighborhoodFocus}
                  onChange={onNeighborhoodFocusChange}
                  ariaLabel="Dim distant nodes"
                />
              </div>
              {neighborhoodFocus && (
                <div className="graph-toggle__sub">
                  <span className="graph-toggle__sub-label">
                    Connection depth
                  </span>
                  <div
                    className="graph-toggle__chips"
                    role="group"
                    aria-label="Connection depth"
                  >
                    {[1, 2].map((hops) => (
                      <button
                        key={hops}
                        type="button"
                        className="graph-toggle__chip"
                        aria-pressed={neighborhoodHops === hops}
                        onClick={() => onNeighborhoodHopsChange(hops)}
                      >
                        {hops} hop{hops === 1 ? "" : "s"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="graph-toggle">
              <span className="graph-toggle__label">
                <span className="field-label">
                  <span className="field-label__text">External hooks</span>
                  <InfoTip text="Show external library hooks (e.g. useState, useEffect) on the canvas. Hooks are always visible in Node Details." />
                </span>
              </span>
              <ToggleSwitch
                checked={showExternalHooks}
                onChange={onShowExternalHooksChange}
                ariaLabel="External hooks"
              />
            </div>

            <div className="graph-controls__subheading">
              <span className="field-label">
                <span className="field-label__text">Edges</span>
                <InfoTip text="Show or hide relationship lines on the canvas by type." />
              </span>
            </div>

            <div className="graph-toggle__sub graph-toggle__sub--stacked">
              {EDGE_TYPES.map((type) => (
                <div key={type} className="graph-toggle graph-toggle--nested">
                  <span className="graph-toggle__label">
                    {EDGE_VISIBILITY_LABELS[type]}
                  </span>
                  <ToggleSwitch
                    checked={edgeVisibility[type]}
                    onChange={(visible) =>
                      onEdgeVisibilityChange(type, visible)
                    }
                    ariaLabel={`Show ${EDGE_VISIBILITY_LABELS[type].toLowerCase()} edges`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
