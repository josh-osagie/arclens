import { memo, type MouseEvent } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { typeColors } from "./design/tokens";
import {
  dispatchOpenStoryAreaMap,
  dispatchStoryGroupToggle,
  dispatchToggleTechnicalInspector,
  type StoryAnchorNodeData,
  type StoryCardNodeData,
  type StoryColumnHeaderData,
  type StoryGroupNodeData,
} from "./storyGraph";

function StoryHeaderComponent({ data }: NodeProps) {
  const header = data as unknown as StoryColumnHeaderData;
  return (
    <div className="atlas-story-col-header" aria-hidden="true">
      <div className="atlas-story-col-header__title">{header.label}</div>
      <div className="atlas-story-col-header__sub">{header.subtitle}</div>
    </div>
  );
}

function StoryAnchorComponent({ data }: NodeProps) {
  const anchor = data as unknown as StoryAnchorNodeData;
  const accent = typeColors[anchor.type] ?? typeColors.component;

  const onInspectClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    dispatchToggleTechnicalInspector();
  };

  const onAreaMapClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    dispatchOpenStoryAreaMap(anchor.areaDomain);
  };

  return (
    <div
      className="atlas-story-anchor"
      style={{ "--atlas-accent": accent } as React.CSSProperties}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="atlas-handle"
        isConnectable={false}
      />

      <div className="atlas-story-anchor__eyebrow">
        <span className="atlas-story-anchor__role">
          <span className="atlas-story-anchor__dot" aria-hidden="true" />
          {anchor.roleInfo.label}
          {anchor.roleInfo.certainty === "inferred" && (
            <span
              className="atlas-story-badge atlas-story-badge--inferred"
              title={anchor.roleInfo.reason}
            >
              inferred
            </span>
          )}
        </span>
        <span className="atlas-story-anchor__area" title={anchor.areaDomain}>
          in {anchor.areaTitle}
        </span>
      </div>

      <div className="atlas-story-anchor__title">{anchor.label}</div>

      <p className="atlas-story-anchor__summary">{anchor.summary}</p>

      <div className="atlas-story-anchor__actions">
        <button
          type="button"
          className={`atlas-story-anchor__btn atlas-story-anchor__btn--primary${anchor.inspectorOpen ? " atlas-story-anchor__btn--active" : ""}`}
          onClick={onInspectClick}
        >
          {anchor.inspectorOpen
            ? "Hide code & details"
            : "Inspect code & details"}
        </button>
        {anchor.areaDomain !== "external" && (
          <button
            type="button"
            className="atlas-story-anchor__btn"
            onClick={onAreaMapClick}
            title={`View all items in ${anchor.areaTitle} (${anchor.areaDomain})`}
          >
            Area map
          </button>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="atlas-handle"
        isConnectable={false}
      />
    </div>
  );
}

function StoryCardComponent({ data }: NodeProps) {
  const card = data as unknown as StoryCardNodeData;
  const accent = typeColors[card.type] ?? typeColors.utility;

  return (
    <div
      className={[
        "atlas-story-card",
        card.isCrossArea ? "atlas-story-card--cross" : "",
        card.isPreviousStep ? "atlas-story-card--prev" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--atlas-accent": accent } as React.CSSProperties}
      title={`${card.relationSentence}\nClick to focus ${card.label}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="atlas-handle"
        isConnectable={false}
      />

      <div className="atlas-story-card__top">
        <span className="atlas-story-card__role">
          <span className="atlas-story-card__swatch" aria-hidden="true" />
          {card.roleInfo.shortLabel}
          {card.roleInfo.certainty === "inferred" && (
            <span className="atlas-story-card__inferred">· inferred</span>
          )}
        </span>
        <span className="atlas-story-card__step-cue">
          {card.direction === "upstream" ? "← focus" : "focus →"}
        </span>
      </div>

      <div className="atlas-story-card__title">{card.label}</div>

      <div className="atlas-story-card__footer">
        <span
          className={`atlas-story-card__rel atlas-story-card__rel--${card.certainty}`}
        >
          {card.relationLabel}
        </span>
        {card.isPreviousStep ? (
          <span className="atlas-story-badge atlas-story-badge--prev">
            previous step
          </span>
        ) : card.isCrossArea ? (
          <span
            className="atlas-story-card__area-tag"
            title={`Located in ${card.areaDomain}`}
          >
            in {card.areaTitle}
          </span>
        ) : (
          <span className="atlas-story-card__certainty">
            {card.certaintyBadge}
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="atlas-handle"
        isConnectable={false}
      />
    </div>
  );
}

function StoryGroupComponent({ data }: NodeProps) {
  const group = data as unknown as StoryGroupNodeData;

  const onToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    dispatchStoryGroupToggle(group.groupKey);
  };

  return (
    <div
      className={`atlas-story-group${group.expanded ? " atlas-story-group--expanded" : ""}`}
      title={group.explanation}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="atlas-handle"
        isConnectable={false}
      />

      <div className="atlas-story-group__top">
        <span className="atlas-story-group__badge">Aggregated</span>
        <button
          type="button"
          className="atlas-story-group__btn"
          onClick={onToggle}
        >
          {group.expanded ? "Collapse −" : `Expand ${group.count} +`}
        </button>
      </div>

      <div className="atlas-story-group__title">{group.title}</div>
      <div className="atlas-story-group__preview">{group.previewText}</div>

      <Handle
        type="source"
        position={Position.Right}
        className="atlas-handle"
        isConnectable={false}
      />
    </div>
  );
}

export const AtlasStoryHeaderNode = memo(StoryHeaderComponent);
export const AtlasStoryAnchorNode = memo(StoryAnchorComponent);
export const AtlasStoryCardNode = memo(StoryCardComponent);
export const AtlasStoryGroupNode = memo(StoryGroupComponent);
