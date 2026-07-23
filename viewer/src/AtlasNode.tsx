import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { AtlasNodeData } from "./buildFlowGraph";
import { typeColors, typeLabels } from "./buildFlowGraph";

export function AtlasNode({ data, selected, dragging }: NodeProps) {
  const nodeData = data as AtlasNodeData & { selected?: boolean; dimmed?: boolean };
  const type = nodeData.type in typeLabels ? nodeData.type : "utility";
  const accent = typeColors[type];

  return (
    <div
      className={[
        "atlas-node",
        selected || nodeData.selected ? "atlas-node--selected" : "",
        nodeData.dimmed ? "atlas-node--dimmed" : "",
        dragging ? "atlas-node--dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--atlas-accent": accent } as React.CSSProperties}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="atlas-handle"
        isConnectable={false}
      />
      <div className="atlas-node__header">{typeLabels[type].toLowerCase()}</div>
      <div className="atlas-node__body">
        <span className="atlas-node__swatch" aria-hidden="true" />
        <div className="atlas-node__text">
          <div className="atlas-node__label">{nodeData.label}</div>
          {nodeData.fileLabel && (
            <div className="atlas-node__file">{nodeData.fileLabel}</div>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="atlas-handle"
        isConnectable={false}
      />
    </div>
  );
}
