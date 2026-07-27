import { describe, expect, it, vi } from "vitest";
import {
  buildCommandActions,
  COMMAND_SHORTCUTS,
  filterJumpNodes,
  findBoundCommandAction,
  formatCommandShortcut,
  groupCommandActions,
  matchesCommandShortcut,
  shouldOpenCommandPalette,
} from "../../viewer/src/features/command-palette/commandRegistry";
import type { AtlasGraphNode } from "../../viewer/src/types";

const sampleNodes: AtlasGraphNode[] = [
  { id: "a", name: "App", file: "src/App.tsx", type: "component" },
  { id: "b", name: "useAuth", file: "src/hooks/useAuth.ts", type: "hook" },
  {
    id: "c",
    name: "Cluster",
    file: "src/components",
    type: "component",
    cluster: { folder: "src/components", count: 3 },
  },
];

const paletteActions = {
  onJumpToNode: vi.fn(),
  onShowFromEntry: vi.fn(),
  onApplyLayout: vi.fn(),
  onCycleLayout: vi.fn(),
  onToggleClusterMode: vi.fn(),
  onToggleNeighborhoodFocus: vi.fn(),
  onFitView: vi.fn(),
  onExportPng: vi.fn(),
  onExportSvg: vi.fn(),
  onFocusSelected: vi.fn(),
  onCopySelectedName: vi.fn(),
  onCopySelectedPath: vi.fn(),
  onHideEdgeType: vi.fn(),
  onShowAllEdges: vi.fn(),
};

const paletteState = {
  nodes: sampleNodes,
  clusterMode: false,
  neighborhoodFocus: true,
  layoutDisabled: false,
  layoutPreset: "dagre-tb" as const,
  selected: sampleNodes[0]!,
  hasEntryNodes: true,
  edgeVisibility: {
    imports: true,
    renders: true,
    uses: true,
  },
};

describe("commandRegistry", () => {
  it("filters jump nodes by name and file", () => {
    expect(filterJumpNodes(sampleNodes, "")).toHaveLength(2);
    expect(filterJumpNodes(sampleNodes, "auth")).toEqual([sampleNodes[1]]);
    expect(filterJumpNodes(sampleNodes, "app.tsx")).toEqual([sampleNodes[0]]);
  });

  it("builds grouped graph and selection actions", () => {
    const built = buildCommandActions(paletteState, paletteActions);

    const grouped = groupCommandActions(built);
    expect(grouped.get("navigate")).toHaveLength(1);
    expect(grouped.get("graph")).toHaveLength(12);
    expect(grouped.get("selection")).toHaveLength(3);

    const dimAction = built.find((action) => action.id === "toggle-dim-distant");
    expect(dimAction?.label).toContain("Disable");

    const hideImports = built.find((action) => action.id === "hide-imports");
    expect(hideImports?.label).toBe("Hide imports");
  });

  it("assigns shortcut labels when a binding exists", () => {
    const built = buildCommandActions(paletteState, paletteActions);

    for (const action of built) {
      const spec = COMMAND_SHORTCUTS[action.id];
      if (!spec) continue;
      expect(action.shortcut).toBe(formatCommandShortcut(spec));
      expect(action.shortcutBinding).toEqual(spec);
    }
  });

  it("matches global shortcut bindings", () => {
    const fitView = matchesCommandShortcut(
      { key: "f", metaKey: false, ctrlKey: false, shiftKey: true, altKey: false },
      COMMAND_SHORTCUTS["fit-view"]!,
    );
    const focusSelected = matchesCommandShortcut(
      { key: "f", metaKey: false, ctrlKey: false, shiftKey: false, altKey: false },
      COMMAND_SHORTCUTS["focus-selected"]!,
    );

    expect(fitView).toBe(true);
    expect(focusSelected).toBe(true);
  });

  it("finds the first enabled global command for a key event", () => {
    const built = buildCommandActions(paletteState, paletteActions);
    const fitView = findBoundCommandAction(
      {
        key: "f",
        metaKey: false,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
        target: null,
      } as KeyboardEvent,
      built,
    );

    expect(fitView?.id).toBe("fit-view");
  });

  it("detects Cmd/Ctrl+K shortcut", () => {
    expect(shouldOpenCommandPalette({ key: "k", metaKey: true, ctrlKey: false })).toBe(true);
    expect(shouldOpenCommandPalette({ key: "k", metaKey: false, ctrlKey: true })).toBe(true);
    expect(shouldOpenCommandPalette({ key: "j", metaKey: true, ctrlKey: false })).toBe(false);
  });
});
