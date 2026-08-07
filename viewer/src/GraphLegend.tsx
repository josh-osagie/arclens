import { useCallback, useState } from "react";
import { InfoTip } from "./InfoTip";
import {
  loadSidebarSections,
  saveSidebarSections,
  toggleSidebarSection,
  type SidebarSectionPrefs,
} from "./sidebarPrefs";
import type { GraphNodeType } from "./types";

type Props = {
  types: readonly GraphNodeType[];
  typeColors: Record<GraphNodeType, string>;
};

export function GraphLegend({ types, typeColors }: Props) {
  const [sectionPrefs, setSectionPrefs] =
    useState<SidebarSectionPrefs>(loadSidebarSections);
  const expanded = sectionPrefs.legend;

  const onToggleSection = useCallback(() => {
    setSectionPrefs((prev) => {
      const next = toggleSidebarSection(prev, "legend");
      saveSidebarSections(next);
      return next;
    });
  }, []);

  return (
    <section className="graph-legend-section overview-shortcuts__section">
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
            <span className="overview-shortcuts__heading-label">Legend</span>
            <InfoTip text="Node colors by type on the canvas." nested />
          </span>
        </button>
      </div>

      {expanded && (
        <div className="graph-legend">
          {types.map((type) => (
            <span key={type} className="graph-legend__item">
              <span
                className="graph-legend__swatch"
                style={{ background: typeColors[type] }}
              />
              {type}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
