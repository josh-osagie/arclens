import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { AtlasNodeData } from "./buildFlowGraph";
import { typeColors, typeLabels } from "./buildFlowGraph";

function AtlasNodeComponent({
  data,
  selected,
  dragging,
  sourcePosition,
  targetPosition,
}: NodeProps) {
  const nodeData = data as AtlasNodeData;
  const type = nodeData.type in typeLabels ? nodeData.type : "utility";
  const accent = typeColors[type];
  const isSelected = selected || nodeData.selected;
  const isBridge = Boolean(nodeData.linkedFrom);
  const targetPos = targetPosition ?? Position.Top;
  const sourcePos = sourcePosition ?? Position.Bottom;

  return (
    <div
      className={[
        "atlas-node",
        nodeData.compact ? "atlas-node--compact" : "",
        isSelected ? "atlas-node--selected" : "",
        isBridge ? "atlas-node--bridge" : "",
        nodeData.dimmed ? "atlas-node--dimmed" : "",
        dragging ? "atlas-node--dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--atlas-accent": accent } as React.CSSProperties}
    >
      <Handle
        type="target"
        position={targetPos}
        className="atlas-handle"
        isConnectable={false}
      />
      <div className="atlas-node__header">
        <span>{typeLabels[type].toLowerCase()}</span>
        {nodeData.linkedFrom && (
          <span
            className="atlas-node__bridge-badge"
            title={`Connected directly to ${nodeData.linkedFrom}`}
          >
            linked · {nodeData.linkedFrom}
          </span>
        )}
      </div>
      <div className="atlas-node__body">
        <span className="atlas-node__swatch" aria-hidden="true" />
        <div className="atlas-node__text">
          <div className="atlas-node__label">{nodeData.label}</div>
          {!nodeData.compact && nodeData.fileLabel && (
            <div className="atlas-node__file">{nodeData.fileLabel}</div>
          )}
        </div>
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

export const AtlasNode = memo(AtlasNodeComponent);
