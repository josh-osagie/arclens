import { useEffect } from "react";
import {
  buildExportFilename,
  captureGraphSnapshot,
  downloadDataUrl,
  type ExportFormat,
} from "./exportGraphSnapshot";

type ExportMeta = {
  projectName?: string;
  graphKey?: string;
};

let exportHandler: ((format: ExportFormat) => Promise<void>) | null = null;

export function registerExportHandler(
  handler: ((format: ExportFormat) => Promise<void>) | null,
): void {
  exportHandler = handler;
}

export async function triggerExport(format: ExportFormat): Promise<void> {
  await exportHandler?.(format);
}

function resolveGraphRoot(): HTMLElement | null {
  const viewport = document.querySelector(".graph-shell .react-flow__viewport");
  if (viewport instanceof HTMLElement) return viewport;

  const root = document.querySelector(".graph-shell .react-flow");
  return root instanceof HTMLElement ? root : null;
}

export function ExportBridge({ projectName, graphKey }: ExportMeta & { graphKey: string }) {
  useEffect(() => {
    registerExportHandler(async (format) => {
      const root = resolveGraphRoot();
      if (!root) return;

      const dataUrl = await captureGraphSnapshot(root, format);
      const filename = buildExportFilename({ projectName, graphKey, format });
      downloadDataUrl(dataUrl, filename);
    });

    return () => registerExportHandler(null);
  }, [projectName, graphKey]);

  return null;
}
