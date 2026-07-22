import { Handle, Position, type NodeProps } from "@xyflow/react";

type AtlasNodeData = {
  label: string;
  type: "component" | "hook" | "service";
};

const typeLabels = {
  component: "Component",
  hook: "Hook",
  service: "Service",
} as const;

export function AtlasNode({ data }: NodeProps) {
  const nodeData = data as AtlasNodeData;

  return (
    <div className={`atlas-node atlas-node--${nodeData.type}`}>
      <Handle type="target" position={Position.Top} className="atlas-handle" />
      <div className="atlas-node__badge">{typeLabels[nodeData.type]}</div>
      <div className="atlas-node__label">{nodeData.label}</div>
      <Handle type="source" position={Position.Bottom} className="atlas-handle" />
    </div>
  );
}
