import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";

type Props = {
  nodeId: string | null;
  enabled?: boolean;
};

export function FocusOnSelect({ nodeId, enabled = true }: Props) {
  const { fitView, getNode } = useReactFlow();

  useEffect(() => {
    if (!enabled || !nodeId) return;
    const node = getNode(nodeId);
    if (!node) return;

    const timer = window.setTimeout(() => {
      fitView({
        nodes: [{ id: nodeId }],
        padding: 0.55,
        duration: 350,
        maxZoom: 1.4,
      });
    }, 40);

    return () => window.clearTimeout(timer);
  }, [nodeId, enabled, fitView, getNode]);

  return null;
}
