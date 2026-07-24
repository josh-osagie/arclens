import { InfoTip } from "./InfoTip";
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
  expandedFolders: string[];
  onShowFromEntry: () => void;
  onCollapseFolders: () => void;
  onCompactLayout: () => void;
  compactLayoutDisabled: boolean;
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
  expandedFolders,
  onShowFromEntry,
  onCollapseFolders,
  onCompactLayout,
  compactLayoutDisabled,
}: Props) {
  const collapseLabel =
    expandedFolders.length === 1
      ? `Collapse ${expandedFolders[0]!.split("/").pop() ?? expandedFolders[0]}`
      : `Collapse ${expandedFolders.length} folders`;

  return (
    <div className="graph-actions">
      <div className="graph-actions__buttons">
        <button type="button" className="graph-actions__btn" onClick={onShowFromEntry}>
          From entry
        </button>
        {expandedFolders.length > 0 && (
          <button type="button" className="graph-actions__btn" onClick={onCollapseFolders}>
            {collapseLabel}
          </button>
        )}
        <button
          type="button"
          className="graph-actions__btn"
          onClick={onCompactLayout}
          disabled={compactLayoutDisabled}
        >
          Compact layout
        </button>
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
      </div>
    </div>
  );
}
