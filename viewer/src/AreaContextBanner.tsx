import { useMemo } from "react";
import { describeAreaForHumans } from "./humanSemantics";
import type { AtlasGraph, AtlasGraphNode } from "./types";

type Props = {
  domain: string;
  graph: AtlasGraph;
  onStartStory: (node: AtlasGraphNode) => void;
};

export function AreaContextBanner({ domain, graph, onStartStory }: Props) {
  const area = useMemo(
    () => describeAreaForHumans(domain, graph),
    [domain, graph]
  );

  return (
    <div className="area-context-banner" role="region" aria-label={`${area.title} overview`}>
      <div className="area-context-banner__info">
        <div className="area-context-banner__title-row">
          <span className="area-context-banner__title">{area.title}</span>
          <span className="area-context-banner__tag">{area.categoryLabel}</span>
        </div>
        <p className="area-context-banner__summary">{area.purposeSummary}</p>
      </div>

      {area.startingScreens.length > 0 && (
        <div className="area-context-banner__starts">
          <span className="area-context-banner__starts-label">
            {area.counts.screens > 0 ? "Explore feature:" : "Focus element:"}
          </span>
          <div className="area-context-banner__pills">
            {area.startingScreens.slice(0, 4).map((node) => (
              <button
                key={node.id}
                type="button"
                className="area-context-banner__pill"
                onClick={() => onStartStory(node)}
                title={`Follow how ${node.name} connects`}
              >
                <span>{node.name}</span>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
