import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";

type Props = {
  nodeId: string | null;
  nodeIds?: string[] | null;
  enabled?: boolean;
  /** Wait until the graph finished rebuilding before fitting (cluster expand, etc.). */
  layoutReady?: boolean;
  /** Called after a successful fit — use to clear one-shot expand focus state. */
  onFocused?: () => void;
};

export function FocusOnSelect({
  nodeId,
  nodeIds,
  enabled = true,
  layoutReady = true,
  onFocused,
}: Props) {
  const { fitView, getNode } = useReactFlow();

  useEffect(() => {
    if (!enabled || !layoutReady) return;

    const ids =
      nodeIds && nodeIds.length > 0
        ? nodeIds.filter((id) => Boolean(getNode(id)))
        : nodeId && getNode(nodeId)
          ? [nodeId]
          : [];

    if (ids.length === 0) return;

    const timer = window.setTimeout(() => {
      const resolved = ids.filter((id) => Boolean(getNode(id)));
      if (resolved.length === 0) return;

      void fitView({
        nodes: resolved.map((id) => ({ id })),
        padding: resolved.length > 1 ? 0.28 : 0.55,
        duration: 350,
        maxZoom: resolved.length > 1 ? 1.2 : 1.4,
      }).then(() => {
        onFocused?.();
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [nodeId, nodeIds, enabled, layoutReady, fitView, getNode, onFocused]);

  return null;
}
