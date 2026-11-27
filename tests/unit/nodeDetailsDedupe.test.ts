import { describe, expect, it } from "vitest";
import { dedupeConnections } from "../../viewer/src/NodeDetails";
import type { GraphConnection } from "../../viewer/src/types";

describe("dedupeConnections", () => {
  it("groups repeated connections by nodeId + edgeType and counts occurrences", () => {
    const items: GraphConnection[] = [
      {
        nodeId: "ui-input",
        name: "Input",
        file: "src/components/ui/input.tsx",
        edgeType: "renders",
      },
      {
        nodeId: "ui-input",
        name: "Input",
        file: "src/components/ui/input.tsx",
        edgeType: "renders",
      },
      {
        nodeId: "ui-button",
        name: "Button",
        file: "src/components/ui/button.tsx",
        edgeType: "renders",
      },
      {
        nodeId: "ui-input",
        name: "Input",
        file: "src/components/ui/input.tsx",
        edgeType: "imports",
      },
    ];

    const deduped = dedupeConnections(items);
    expect(deduped).toHaveLength(3);
    expect(deduped[0]).toMatchObject({
      nodeId: "ui-input",
      edgeType: "renders",
      count: 2,
    });
    expect(deduped[1]).toMatchObject({
      nodeId: "ui-button",
      edgeType: "renders",
      count: 1,
    });
    expect(deduped[2]).toMatchObject({
      nodeId: "ui-input",
      edgeType: "imports",
      count: 1,
    });
  });
});
