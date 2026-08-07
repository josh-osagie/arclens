import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  buildExportFilename,
  captureGraphSnapshot,
  downloadDataUrl,
  type ExportFormat,
} from "./exportGraphSnapshot";
import { loadExportScope, type ExportScope } from "./exportPrefs";

type ExportMeta = {
  projectName?: string;
  graphKey?: string;
};

export type ExportOptions = {
  scope?: ExportScope;
};

let exportHandler:
  ((format: ExportFormat, options?: ExportOptions) => Promise<void>) | null =
  null;

export function registerExportHandler(
  handler:
    ((format: ExportFormat, options?: ExportOptions) => Promise<void>) | null
): void {
  exportHandler = handler;
}

export async function triggerExport(
  format: ExportFormat,
  options?: ExportOptions
): Promise<void> {
  await exportHandler?.(format, options);
}

/** Visible React Flow pane — respects current pan/zoom framing. */
export function resolveGraphCaptureRoot(): HTMLElement | null {
  const renderer = document.querySelector(".graph-shell .react-flow__renderer");
  if (renderer instanceof HTMLElement) return renderer;

  const viewport = document.querySelector(".graph-shell .react-flow__viewport");
  if (viewport instanceof HTMLElement) return viewport;

  const root = document.querySelector(".graph-shell .react-flow");
  return root instanceof HTMLElement ? root : null;
}

async function waitForViewportSettled(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function ExportBridge({
  projectName,
  graphKey,
}: ExportMeta & { graphKey: string }) {
  const { fitView, getViewport, setViewport } = useReactFlow();

  useEffect(() => {
    registerExportHandler(async (format, options) => {
      const root = resolveGraphCaptureRoot();
      if (!root) return;

      const scope = options?.scope ?? loadExportScope();
      const previousViewport = scope === "full" ? getViewport() : null;

      try {
        if (scope === "full") {
          fitView({ padding: 0.18, duration: 0 });
          await waitForViewportSettled();
        }

        const dataUrl = await captureGraphSnapshot(root, format);
        const filename = buildExportFilename({ projectName, graphKey, format });
        downloadDataUrl(dataUrl, filename);
      } finally {
        if (previousViewport) {
          setViewport(previousViewport);
        }
      }
    });

    return () => registerExportHandler(null);
  }, [projectName, graphKey, fitView, getViewport, setViewport]);

  return null;
}
