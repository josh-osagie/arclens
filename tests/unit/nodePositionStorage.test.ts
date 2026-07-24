import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Node } from "@xyflow/react";
import type { AtlasNodeData } from "../../viewer/src/buildFlowGraph";
import {
  loadNodePositions,
  mergeNodePositions,
  nodePositionStorageKey,
  nodePositionsFromNodes,
  saveNodePositions,
} from "../../viewer/src/nodePositionStorage";

const GRAPH_KEY = "42:10:src:last-node:last-edge|import";

function makeNode(id: string, x: number, y: number): Node<AtlasNodeData> {
  return {
    id,
    type: "atlas",
    position: { x, y },
    data: { label: id, nodeId: id, type: "component" },
  };
}

describe("nodePositionStorage", () => {
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

  it("loads null when storage is empty", () => {
    expect(loadNodePositions(GRAPH_KEY)).toBeNull();
  });

  it("persists and loads node positions keyed by graph signature", () => {
    const positions = {
      "node-a": { x: 10, y: 20 },
      "node-b": { x: 30, y: 40 },
    };

    saveNodePositions(GRAPH_KEY, positions);

    const key = nodePositionStorageKey(GRAPH_KEY);
    expect(store[key]).toBeTruthy();
    expect(loadNodePositions(GRAPH_KEY)).toEqual(positions);
  });

  it("ignores corrupt stored values", () => {
    store[nodePositionStorageKey(GRAPH_KEY)] = "{not-json";
    expect(loadNodePositions(GRAPH_KEY)).toBeNull();
  });

  it("extracts positions from flow nodes", () => {
    expect(
      nodePositionsFromNodes([makeNode("a", 1, 2), makeNode("b", 3, 4)]),
    ).toEqual({
      a: { x: 1, y: 2 },
      b: { x: 3, y: 4 },
    });
  });

  it("prefers in-memory positions over saved defaults", () => {
    const next = [makeNode("a", 0, 0), makeNode("b", 0, 0)];
    const current = [makeNode("a", 100, 200)];
    const saved = { b: { x: 50, y: 60 } };

    const merged = mergeNodePositions(next, current, saved);

    expect(merged[0].position).toEqual({ x: 100, y: 200 });
    expect(merged[1].position).toEqual({ x: 50, y: 60 });
  });

  it("falls back to layout positions when nothing is saved", () => {
    const next = [makeNode("a", 12, 34)];

    expect(mergeNodePositions(next, [], null)[0].position).toEqual({ x: 12, y: 34 });
  });
});
