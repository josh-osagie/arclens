import { memo, type MouseEvent } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { GraphNodeType } from "./types";

export const OPEN_CLUSTER_EVENT = "arclens:open-cluster";

export function dispatchOpenCluster(folder: string): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<string>(OPEN_CLUSTER_EVENT, { detail: folder })
    );
  }
}

export type ClusterNodeData = {
  label: string;
  folder: string;
  count: number;
  breakdown?: Partial<Record<GraphNodeType, number>>;
  humanTitle?: string;
  humanSubtitle?: string;
  isNeutralFallback?: boolean;
  isSubcluster?: boolean;
  isExternalNeighbor?: boolean;
  isBridgeOrigin?: boolean;
  selected?: boolean;
  dimmed?: boolean;
};

const BREAKDOWN_ORDER: Array<{ type: GraphNodeType; short: string }> = [
  { type: "entry", short: "startup" },
  { type: "component", short: "UI" },
  { type: "hook", short: "hooks" },
  { type: "context", short: "state" },
  { type: "utility", short: "helpers" },
];

function formatBreakdown(
  breakdown?: Partial<Record<GraphNodeType, number>>
): string | null {
  if (!breakdown) return null;
  const parts: string[] = [];
  for (const { type, short } of BREAKDOWN_ORDER) {
    const count = breakdown[type];
    if (count && count > 0) {
      parts.push(`${count} ${short}`);
    }
    if (parts.length >= 3) break;
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function ClusterNodeComponent({
  data,
  selected,
  sourcePosition,
  targetPosition,
}: NodeProps) {
  const nodeData = data as ClusterNodeData;
  const isSelected = selected || nodeData.selected;
  const displayTitle = nodeData.humanTitle ?? nodeData.label;
  const subtitleText =
    nodeData.humanSubtitle ?? formatBreakdown(nodeData.breakdown);
  const targetPos = targetPosition ?? Position.Top;
  const sourcePos = sourcePosition ?? Position.Bottom;

  const actionLabel = nodeData.isSubcluster
    ? "expand +"
    : nodeData.isBridgeOrigin
      ? "← back"
      : "explore →";

  const onOpenClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    dispatchOpenCluster(nodeData.folder);
  };

  return (
    <div
      className={[
        "atlas-cluster",
        isSelected ? "atlas-cluster--selected" : "",
        nodeData.isSubcluster ? "atlas-cluster--subcluster" : "",
        nodeData.isExternalNeighbor ? "atlas-cluster--neighbor" : "",
        nodeData.isBridgeOrigin ? "atlas-cluster--bridge-origin" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      title={`Click to preview ${displayTitle} (${nodeData.folder}) · Double-click or click "${actionLabel}" to explore`}
    >
      <Handle
        type="target"
        position={targetPos}
        className="atlas-handle"
        isConnectable={false}
      />
      <div className="atlas-cluster__top">
        <span className="atlas-cluster__count">{nodeData.count}</span>
        <button
          type="button"
          className="atlas-cluster__open-btn"
          onClick={onOpenClick}
          aria-label={`Explore ${displayTitle}`}
        >
          {actionLabel}
        </button>
      </div>
      <div className="atlas-cluster__label atlas-cluster__label--human">
        {displayTitle}
      </div>
      {subtitleText && (
        <div className="atlas-cluster__breakdown">{subtitleText}</div>
      )}
      <div className="atlas-cluster__folder">
        {nodeData.isNeutralFallback
          ? `folder · ${nodeData.folder}`
          : nodeData.folder}
      </div>
      <Handle
        type="source"
        position={sourcePos}
        className="atlas-handle"
        isConnectable={false}
      />
    </div>
  );
}

export const AtlasClusterNode = memo(ClusterNodeComponent);
