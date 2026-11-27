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
  isSubcluster?: boolean;
  isExternalNeighbor?: boolean;
  isBridgeOrigin?: boolean;
  selected?: boolean;
  dimmed?: boolean;
};

const BREAKDOWN_ORDER: Array<{ type: GraphNodeType; short: string }> = [
  { type: "entry", short: "entry" },
  { type: "component", short: "comp" },
  { type: "hook", short: "hooks" },
  { type: "context", short: "ctx" },
  { type: "utility", short: "utils" },
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
  const showFolderPath = nodeData.folder !== nodeData.label;
  const breakdownText = formatBreakdown(nodeData.breakdown);
  const targetPos = targetPosition ?? Position.Top;
  const sourcePos = sourcePosition ?? Position.Bottom;

  const actionLabel = nodeData.isSubcluster
    ? "expand +"
    : nodeData.isBridgeOrigin
      ? "← back"
      : nodeData.isExternalNeighbor
        ? "switch →"
        : "open →";

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
      title={`Click to preview connections · Double-click or click "${actionLabel}" for ${nodeData.folder}`}
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
          aria-label={`Open ${nodeData.folder}`}
        >
          {actionLabel}
        </button>
      </div>
      <div className="atlas-cluster__label">{nodeData.label}</div>
      {showFolderPath && (
        <div className="atlas-cluster__folder">{nodeData.folder}</div>
      )}
      {breakdownText && (
        <div className="atlas-cluster__breakdown">{breakdownText}</div>
      )}
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
