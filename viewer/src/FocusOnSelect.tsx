import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";

type Props = {
  nodeId: string | null;
  nodeIds?: string[] | null;
  enabled?: boolean;
};

export function FocusOnSelect({ nodeId, nodeIds, enabled = true }: Props) {
  const { fitView, getNode } = useReactFlow();

  useEffect(() => {
    if (!enabled) return;

    const ids =
      nodeIds && nodeIds.length > 0
        ? nodeIds.filter((id) => Boolean(getNode(id)))
        : nodeId && getNode(nodeId)
          ? [nodeId]
          : [];

    if (ids.length === 0) return;

    const timer = window.setTimeout(() => {
      fitView({
        nodes: ids.map((id) => ({ id })),
        padding: ids.length > 1 ? 0.28 : 0.55,
        duration: 350,
        maxZoom: ids.length > 1 ? 1.2 : 1.4,
      });
    }, 40);

    return () => window.clearTimeout(timer);
  }, [nodeId, nodeIds, enabled, fitView, getNode]);

  return null;
}
