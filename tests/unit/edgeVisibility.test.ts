import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Edge } from "@xyflow/react";
import {
  filterEdgesByVisibility,
  getFlowEdgeType,
} from "../../viewer/src/edgeVisibility";
import {
  DEFAULT_EDGE_VISIBILITY,
  loadEdgeVisibility,
  saveEdgeVisibility,
  setEdgeTypeVisible,
} from "../../viewer/src/edgeVisibilityPrefs";

const STORAGE_KEY = "react-atlas-edge-visibility";

function edge(id: string, type: "imports" | "renders" | "uses", label?: string): Edge {
  return {
    id,
    source: "a",
    target: "b",
    data: { edgeType: type },
    label,
  };
}

describe("edgeVisibility", () => {
  const sampleEdges = [
    edge("e1", "imports"),
    edge("e2", "renders"),
    edge("e3", "uses"),
  ];

  it("reads edge type from data.edgeType", () => {
    expect(getFlowEdgeType(edge("e1", "imports"))).toBe("imports");
  });

  it("falls back to label when data is missing", () => {
    expect(getFlowEdgeType({ id: "e1", source: "a", target: "b", label: "renders" })).toBe(
      "renders",
    );
  });

  it("keeps edges whose type is enabled", () => {
    expect(
      filterEdgesByVisibility(sampleEdges, {
        imports: true,
        renders: false,
        uses: true,
      }),
    ).toEqual([sampleEdges[0], sampleEdges[2]]);
  });

  it("returns no edges when every type is hidden", () => {
    expect(
      filterEdgesByVisibility(sampleEdges, {
        imports: false,
        renders: false,
        uses: false,
      }),
    ).toEqual([]);
  });

  it("keeps unknown edge types when any visibility is on", () => {
    const unknown = { id: "e4", source: "a", target: "b" } as Edge;
    expect(filterEdgesByVisibility([unknown], DEFAULT_EDGE_VISIBILITY)).toEqual([unknown]);
  });
});

describe("edgeVisibilityPrefs", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads all edge types visible by default", () => {
    expect(loadEdgeVisibility()).toEqual(DEFAULT_EDGE_VISIBILITY);
  });

  it("persists visibility preferences", () => {
    const prefs = setEdgeTypeVisible(DEFAULT_EDGE_VISIBILITY, "imports", false);
    saveEdgeVisibility(prefs);
    expect(JSON.parse(store[STORAGE_KEY]!)).toEqual({
      imports: false,
      renders: true,
      uses: true,
    });
    expect(loadEdgeVisibility().imports).toBe(false);
  });
});
