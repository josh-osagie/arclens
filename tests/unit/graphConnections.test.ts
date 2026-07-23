import { describe, expect, it } from "vitest";
import {
  buildNodeById,
  buildNodeConnections,
  enrichNodeForDetails,
  getConnectedNodeIdsFromEdges,
} from "../../viewer/src/graphConnections";
import type { AtlasGraph } from "../../viewer/src/types";

const sampleGraph: AtlasGraph = {
  nodes: [
    { id: "a::App", name: "App", file: "/a/App.tsx", type: "component", stats: { incoming: 1, outgoing: 1 } },
    { id: "b::Button", name: "Button", file: "/b/Button.tsx", type: "component", stats: { incoming: 1, outgoing: 0 } },
  ],
  edges: [
    { from: "a::App", to: "b::Button", type: "renders" },
  ],
};

describe("graphConnections", () => {
  it("builds incoming and outgoing from edges", () => {
    const nodeById = buildNodeById(sampleGraph);
    const appConnections = buildNodeConnections("a::App", sampleGraph.edges, nodeById);

    expect(appConnections.outgoing).toHaveLength(1);
    expect(appConnections.outgoing[0]?.name).toBe("Button");
    expect(appConnections.incoming).toHaveLength(0);
  });

  it("enriches a slim node on demand", () => {
    const nodeById = buildNodeById(sampleGraph);
    const button = nodeById.get("b::Button")!;
    const enriched = enrichNodeForDetails(button, sampleGraph, nodeById);

    expect(enriched.connections?.incoming).toHaveLength(1);
    expect(enriched.connections?.incoming[0]?.name).toBe("App");
  });

  it("finds connected ids from edges", () => {
    const ids = getConnectedNodeIdsFromEdges("a::App", sampleGraph.edges);
    expect([...ids].sort()).toEqual(["a::App", "b::Button"]);
  });
});
