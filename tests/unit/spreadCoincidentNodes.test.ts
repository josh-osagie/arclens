import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import { spreadCoincidentNodes } from "../../viewer/src/layoutPresets";
import type { AtlasNodeData } from "../../viewer/src/buildFlowGraph";

function node(id: string, x: number, y: number): Node<AtlasNodeData> {
  return {
    id,
    type: "cluster",
    position: { x, y },
    data: { label: id, nodeId: id, type: "utility" },
  } as Node<AtlasNodeData>;
}

describe("spreadCoincidentNodes", () => {
  it("separates nodes placed at the same coordinates", () => {
    const spread = spreadCoincidentNodes([
      node("a", 10, 10),
      node("b", 10, 10),
      node("c", 10, 10),
    ]);

    const ys = spread.map((entry) => entry.position.y);
    expect(new Set(ys).size).toBe(3);
  });
});
