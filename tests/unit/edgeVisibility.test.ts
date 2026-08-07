import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Edge } from "@xyflow/react";
import {
  filterEdgesByVisibility,
  getFlowEdgeType,
  getFlowEdgeTypes,
} from "../../viewer/src/edgeVisibility";
import {
  DEFAULT_EDGE_VISIBILITY,
  loadEdgeVisibility,
  saveEdgeVisibility,
  setEdgeTypeVisible,
} from "../../viewer/src/edgeVisibilityPrefs";

const STORAGE_KEY = "arclens-edge-visibility";

function edge(
  id: string,
  type: "imports" | "renders" | "uses",
  label?: string
): Edge {
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

  it("reads merged edge types from data.edgeTypes", () => {
    const merged = {
      id: "e1",
      source: "a",
      target: "b",
      data: { edgeType: "renders", edgeTypes: ["renders", "imports"] },
      label: "renders · imports",
    } as Edge;

    expect(getFlowEdgeTypes(merged)).toEqual(["renders", "imports"]);
  });

  it("falls back to label when data is missing", () => {
    expect(
      getFlowEdgeType({ id: "e1", source: "a", target: "b", label: "renders" })
    ).toBe("renders");
  });

  it("keeps edges whose type is enabled", () => {
    const filtered = filterEdgesByVisibility(sampleEdges, {
      imports: true,
      renders: false,
      uses: true,
    });

    expect(filtered.map((edge) => edge.id)).toEqual(["e1", "e3"]);
    expect(filtered[0]?.data?.edgeTypes).toEqual(["imports"]);
    expect(filtered[1]?.data?.edgeTypes).toEqual(["uses"]);
  });

  it("returns no edges when every type is hidden", () => {
    expect(
      filterEdgesByVisibility(sampleEdges, {
        imports: false,
        renders: false,
        uses: false,
      })
    ).toEqual([]);
  });

  it("keeps unknown edge types when any visibility is on", () => {
    const unknown = { id: "e4", source: "a", target: "b" } as Edge;
    expect(filterEdgesByVisibility([unknown], DEFAULT_EDGE_VISIBILITY)).toEqual(
      [unknown]
    );
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
