import { afterEach, describe, expect, it, vi } from "vitest";
import {
  registerExportHandler,
  triggerExport,
} from "../../viewer/src/exportGraphBridge";

describe("exportGraphBridge", () => {
  afterEach(() => {
    registerExportHandler(null);
  });

  it("delegates export to the registered handler", async () => {
    const handler = vi.fn(async () => undefined);
    registerExportHandler(handler);

    await triggerExport("png");

    expect(handler).toHaveBeenCalledWith("png");
  });

  it("no-ops when no handler is registered", async () => {
    await expect(triggerExport("svg")).resolves.toBeUndefined();
  });
});
