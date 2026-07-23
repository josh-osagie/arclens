import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export type ClusterNodeData = {
  label: string;
  folder: string;
  count: number;
  selected?: boolean;
};

function ClusterNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as ClusterNodeData & { selected?: boolean };
  const isSelected = selected || nodeData.selected;
  const showFolderPath = nodeData.folder !== nodeData.label;

  return (
    <div className={`atlas-cluster ${isSelected ? "atlas-cluster--selected" : ""}`}>
      <Handle type="target" position={Position.Top} className="atlas-handle" isConnectable={false} />
      <div className="atlas-cluster__count">{nodeData.count}</div>
      <div className="atlas-cluster__label">{nodeData.label}</div>
      {showFolderPath && (
        <div className="atlas-cluster__folder">{nodeData.folder}</div>
      )}
      <Handle type="source" position={Position.Bottom} className="atlas-handle" isConnectable={false} />
    </div>
  );
}

export const AtlasClusterNode = memo(ClusterNodeComponent);
