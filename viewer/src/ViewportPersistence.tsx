import { useEffect } from "react";
import { useOnViewportChange, useReactFlow } from "@xyflow/react";
import { loadViewport, saveViewport } from "./viewportStorage";

type Props = {
  graphKey: string;
  enabled: boolean;
};

export function ViewportPersistence({ graphKey, enabled }: Props) {
  const { setViewport } = useReactFlow();

  useEffect(() => {
    if (!enabled || !graphKey) return;
    const saved = loadViewport(graphKey);
    if (saved) {
      setViewport(saved, { duration: 0 });
    }
  }, [graphKey, enabled, setViewport]);

  useOnViewportChange({
    onEnd: (viewport) => {
      if (enabled && graphKey) {
        saveViewport(graphKey, viewport);
      }
    },
  });

  return null;
}
