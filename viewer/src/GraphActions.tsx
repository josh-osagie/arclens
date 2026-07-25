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
  focusOnSelect: boolean;
  onFocusOnSelectChange: (enabled: boolean) => void;
  edgeVisibility: EdgeVisibilityPrefs;
  onEdgeVisibilityChange: (type: keyof EdgeVisibilityPrefs, visible: boolean) => void;
  expandedFolders: string[];
  onShowFromEntry: () => void;
  onCollapseFolders: () => void;
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
  focusOnSelect,
  onFocusOnSelectChange,
  edgeVisibility,
  onEdgeVisibilityChange,
  expandedFolders,
  onShowFromEntry,
  onCollapseFolders,
  layoutPreset,
  onLayoutPresetChange,
  layoutDisabled,
}: Props) {
  const [sectionPrefs, setSectionPrefs] = useState<SidebarSectionPrefs>(loadSidebarSections);
  const expanded = sectionPrefs.graphControls;

  const onToggleSection = useCallback(() => {
    setSectionPrefs((prev) => {
      const next = toggleSidebarSection(prev, "graphControls");
      saveSidebarSections(next);
      return next;
    });
  }, []);

  const collapseLabel =
    expandedFolders.length === 1
      ? `Collapse ${expandedFolders[0]!.split("/").pop() ?? expandedFolders[0]}`
      : `Collapse ${expandedFolders.length} folders`;

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
            <span className="overview-shortcuts__heading-label">Graph controls</span>
            <InfoTip
              text="Layout, entry navigation, view options, and edge visibility."
              nested
            />
          </span>
        </button>
      </div>

      {expanded && (
        <div className="graph-actions__body">
          <div className="graph-controls__field">
            <label className="graph-controls__field-label" htmlFor="layout-preset">
              <span className="field-label">
                <span className="field-label__text">Layout</span>
                <InfoTip text="Choose how nodes are arranged on the canvas. Fit view runs automatically after changing layout." />
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
            <button type="button" className="graph-actions__btn" onClick={onShowFromEntry}>
              From entry
            </button>
            {expandedFolders.length > 0 && (
              <button
                type="button"
                className="graph-actions__btn"
                onClick={onCollapseFolders}
              >
                {collapseLabel}
              </button>
            )}
          </div>

          <div className="graph-toggles">
            <div className="graph-toggle">
              <span className="graph-toggle__label">
                <span className="field-label">
                  <span className="field-label__text">Cluster folders</span>
                  <InfoTip text="Group nodes by file folder into collapsible clusters. Useful on large graphs." />
                </span>
              </span>
              <ToggleSwitch
                checked={clusterMode}
                onChange={onClusterModeChange}
                ariaLabel="Cluster folders"
              />
            </div>

            <div className={`graph-toggle${neighborhoodFocus ? " graph-toggle--expanded" : ""}`}>
              <div className="graph-toggle__main">
                <span className="graph-toggle__label">
                  <span className="field-label">
                    <span className="field-label__text">Dim distant nodes</span>
                    <InfoTip text="When a node is selected, keep it and nearby connections in focus. Everything outside that range is dimmed." />
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
                  <span className="graph-toggle__sub-label">Connection depth</span>
                  <div className="graph-toggle__chips" role="group" aria-label="Connection depth">
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
                  <span className="field-label__text">Pan to selection</span>
                  <InfoTip text="Automatically pan and zoom the canvas when you select a node." />
                </span>
              </span>
              <ToggleSwitch
                checked={focusOnSelect}
                onChange={onFocusOnSelectChange}
                ariaLabel="Pan to selection"
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
                  <span className="graph-toggle__label">{EDGE_VISIBILITY_LABELS[type]}</span>
                  <ToggleSwitch
                    checked={edgeVisibility[type]}
                    onChange={(visible) => onEdgeVisibilityChange(type, visible)}
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
