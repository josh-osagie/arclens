import { describe, expect, it, vi } from "vitest";
import type { Node, ReactFlowInstance, Viewport } from "@xyflow/react";
import type { AtlasNodeData } from "../../viewer/src/buildFlowGraph";
import { fitViewportInSafeArea } from "../../viewer/src/fitViewSafeArea";

describe("fitViewSafeArea", () => {
  it("clamps top screen clearance relative to bounds.y * zoom instead of forcing positive viewport.y", async () => {
    let capturedViewport: Viewport | null = null;
    const targetNode = {
      id: "n1",
      type: "atlas",
      position: { x: 200, y: 900 },
      measured: { width: 220, height: 80 },
      data: { label: "DeepNode", type: "component" } as AtlasNodeData,
    } as Node<AtlasNodeData>;

    const mockRf = {
      getNodes: () => [targetNode],
      getNode: (id: string) => (id === "n1" ? targetNode : undefined),
      getNodesBounds: () => ({ x: 200, y: 900, width: 220, height: 80 }),
      fitView: vi.fn(async () => true),
      setViewport: vi.fn(async (vp: Viewport) => {
        capturedViewport = vp;
        return true;
      }),
    } as unknown as ReactFlowInstance<Node<AtlasNodeData>>;

    await fitViewportInSafeArea(mockRf, {
      nodeIds: ["n1"],
      padding: 0.24,
      minZoom: 0.68,
      maxZoom: 0.9,
      enforceReadableFloor: true,
    });

    expect(capturedViewport).not.toBeNull();
    // With bounds.y = 900 and zoom ~0.9, viewport.y must be negative (~ -466) to center
    // the node on screen rather than being clamped to +12 (which pushes screenY > 820px).
    const screenTop = 900 * capturedViewport!.zoom + capturedViewport!.y;
    expect(capturedViewport!.y).toBeLessThan(0);
    expect(screenTop).toBeGreaterThanOrEqual(12);
    expect(screenTop).toBeLessThan(600);
  });
});
