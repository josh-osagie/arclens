import { describe, expect, it, vi } from "vitest";
import {
  buildExportFilename,
  createExportFilter,
  downloadDataUrl,
  EXPORT_EXCLUDE_CLASS_NAMES,
  isExcludedFromExport,
  slugifyExportSegment,
} from "../../viewer/src/exportGraphSnapshot";

function elementWithClass(className: string): Element {
  return {
    classList: {
      contains: (value: string) => value === className,
    },
  } as Element;
}

describe("exportGraphSnapshot", () => {
  it("slugifies export filename segments", () => {
    expect(slugifyExportSegment("My Cool App")).toBe("my-cool-app");
    expect(slugifyExportSegment("   ")).toBe("react-atlas");
  });

  it("builds filenames from project name and timestamp", () => {
    const filename = buildExportFilename({
      projectName: "Demo App",
      graphKey: "123:456",
      format: "png",
      now: new Date("2026-07-24T12:30:45.000Z"),
    });

    expect(filename).toBe("demo-app-graph-2026-07-24T12-30-45.png");
  });

  it("falls back to graph key when project name is missing", () => {
    const filename = buildExportFilename({
      graphKey: "42:99:node-a",
      format: "svg",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(filename).toBe("42-99-node-a-graph-2026-01-01T00-00-00.svg");
  });

  it("excludes overlay UI from export filter", () => {
    for (const className of EXPORT_EXCLUDE_CLASS_NAMES) {
      expect(isExcludedFromExport(elementWithClass(className))).toBe(true);
    }

    expect(isExcludedFromExport(elementWithClass("react-flow__node"))).toBe(false);
  });

  it("keeps non-element DOM nodes in export filter", () => {
    const filter = createExportFilter();
    const textNode = { nodeType: 3 } as unknown as HTMLElement;

    expect(() => filter(textNode)).not.toThrow();
    expect(filter(textNode)).toBe(true);
  });

  it("downloads via a temporary anchor in the document body", () => {
    const click = vi.fn();
    const remove = vi.fn();
    const link = {
      download: "",
      href: "",
      rel: "",
      style: { display: "" },
      click,
      remove,
    } as unknown as HTMLAnchorElement;

    const appendChild = vi.fn();
    const createElement = vi.fn(() => link);

    vi.stubGlobal("document", {
      createElement,
      body: { appendChild },
    });

    downloadDataUrl("data:image/png;base64,abc", "demo-graph.png");

    expect(createElement).toHaveBeenCalledWith("a");
    expect(link.download).toBe("demo-graph.png");
    expect(link.href).toBe("data:image/png;base64,abc");
    expect(appendChild).toHaveBeenCalledWith(link);
    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});
