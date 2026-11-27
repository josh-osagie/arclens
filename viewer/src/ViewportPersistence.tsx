import { useEffect } from "react";
import { useOnViewportChange, useReactFlow } from "@xyflow/react";
import { loadViewport, saveViewport } from "./viewportStorage";

type Props = {
  graphKey: string;
  enabled: boolean;
  restoreOnKeyChange?: boolean;
};

export function ViewportPersistence({
  graphKey,
  enabled,
  restoreOnKeyChange = true,
}: Props) {
  const { setViewport } = useReactFlow();

  useEffect(() => {
    if (!restoreOnKeyChange || !enabled || !graphKey) return;
    const saved = loadViewport(graphKey);
    if (!saved) return;
    if (graphKey.endsWith("::overview") && saved.zoom < 0.5) return;
    void setViewport(saved, { duration: 0 });
  }, [graphKey, enabled, restoreOnKeyChange, setViewport]);

  useOnViewportChange({
    onEnd: (viewport) => {
      if (enabled && graphKey) {
        saveViewport(graphKey, viewport);
      }
    },
  });

  return null;
}
