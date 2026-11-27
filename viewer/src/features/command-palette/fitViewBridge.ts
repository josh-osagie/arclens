import { useEffect } from "react";
import { useReactFlow, type Node } from "@xyflow/react";
import type { AtlasNodeData } from "../../buildFlowGraph";
import { fitViewportInSafeArea } from "../../fitViewSafeArea";

type FitViewOptions = {
  padding?: number;
  duration?: number;
};

let fitViewHandler: ((options?: FitViewOptions) => void) | null = null;

export function registerFitViewHandler(
  handler: ((options?: FitViewOptions) => void) | null
): void {
  fitViewHandler = handler;
}

export function triggerFitView(options?: FitViewOptions): void {
  fitViewHandler?.({
    padding: 0.18,
    duration: 280,
    ...options,
  });
}

export function FitViewBridge() {
  const rf = useReactFlow<Node<AtlasNodeData>>();

  useEffect(() => {
    registerFitViewHandler((options) => {
      void fitViewportInSafeArea(rf, options);
    });
    return () => registerFitViewHandler(null);
  }, [rf]);

  return null;
}
