import { toPng, toSvg } from "html-to-image";

export type ExportFormat = "png" | "svg";

/** UI layers excluded from canvas snapshots (minimap, zoom bar, notices). */
export const EXPORT_EXCLUDE_CLASS_NAMES = [
  "react-flow__minimap",
  "zoom-controls-wrap",
  "graph-canvas-notice",
  "export-controls",
] as const;

const DEFAULT_CANVAS_BACKGROUND = "#111111";
const DEFAULT_PNG_PIXEL_RATIO = 2;

export function slugifyExportSegment(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "arclens";
}

export function buildExportFilename(options: {
  projectName?: string;
  graphKey?: string;
  format: ExportFormat;
  now?: Date;
}): string {
  const label =
    options.projectName?.trim() || options.graphKey?.trim() || "arclens";
  const stamp = (options.now ?? new Date())
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  return `${slugifyExportSegment(label)}-graph-${stamp}.${options.format}`;
}

export function isExcludedFromExport(node: Element): boolean {
  return EXPORT_EXCLUDE_CLASS_NAMES.some((className) =>
    node.classList.contains(className)
  );
}

export function createExportFilter(): (node: HTMLElement) => boolean {
  return (node) => {
    // html-to-image invokes filter on text/comment nodes too; they have no classList.
    if (!("classList" in node)) return true;
    return !isExcludedFromExport(node);
  };
}

export async function captureGraphSnapshot(
  root: HTMLElement,
  format: ExportFormat,
  options?: { pixelRatio?: number; backgroundColor?: string }
): Promise<string> {
  const filter = createExportFilter();
  const backgroundColor = options?.backgroundColor ?? DEFAULT_CANVAS_BACKGROUND;
  const common = {
    filter,
    backgroundColor,
    cacheBust: true,
    skipFonts: true,
  };

  if (format === "png") {
    return toPng(root, {
      ...common,
      pixelRatio: options?.pixelRatio ?? DEFAULT_PNG_PIXEL_RATIO,
    });
  }

  return toSvg(root, common);
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
