import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";

type FitViewOptions = {
  padding?: number;
  duration?: number;
};

let fitViewHandler: ((options?: FitViewOptions) => void) | null = null;

export function registerFitViewHandler(
  handler: ((options?: FitViewOptions) => void) | null,
): void {
  fitViewHandler = handler;
}

export function triggerFitView(options?: FitViewOptions): void {
  fitViewHandler?.({
    padding: 0.22,
    duration: 280,
    ...options,
  });
}

export function FitViewBridge() {
  const { fitView } = useReactFlow();

  useEffect(() => {
    registerFitViewHandler(fitView);
    return () => registerFitViewHandler(null);
  }, [fitView]);

  return null;
}
