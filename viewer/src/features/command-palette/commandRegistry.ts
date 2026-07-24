import type { AtlasGraphNode } from "@/types";

export type CommandGroupId = "navigate" | "graph" | "selection";

export type CommandShortcutSpec = {
  mod?: boolean;
  shift?: boolean;
  key: string;
  /** When true, fires even when the palette is closed. */
  global?: boolean;
};

export type CommandAction = {
  id: string;
  group: CommandGroupId;
  label: string;
  keywords?: string[];
  shortcut?: string;
  shortcutBinding?: CommandShortcutSpec;
  disabled?: boolean;
  run: () => void;
};

const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.userAgent);

export const COMMAND_SHORTCUTS: Record<string, CommandShortcutSpec> = {
  "show-from-entry": { key: "E" },
  "fit-view": { shift: true, key: "F", global: true },
  "compact-layout": { shift: true, key: "L", global: true },
  "toggle-cluster-folders": { shift: true, key: "C", global: true },
  "toggle-dim-distant": { shift: true, key: "D", global: true },
  "focus-selected": { key: "F", global: true },
  "copy-selected-name": { mod: true, key: "C" },
  "copy-selected-path": { mod: true, shift: true, key: "C" },
};

export function formatCommandShortcut(spec: CommandShortcutSpec): string {
  const tokens: string[] = [];
  if (spec.mod) tokens.push(IS_MAC ? "⌘" : "Ctrl");
  if (spec.shift) tokens.push(IS_MAC ? "⇧" : "Shift");
  tokens.push(spec.key.length === 1 ? spec.key.toUpperCase() : spec.key);
  return IS_MAC ? tokens.join("") : tokens.join("+");
}

export function matchesCommandShortcut(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">,
  spec: CommandShortcutSpec,
): boolean {
  if (event.altKey) return false;
  if (Boolean(spec.mod) !== isModKey(event)) return false;
  if (Boolean(spec.shift) !== event.shiftKey) return false;
  return event.key.toLowerCase() === spec.key.toLowerCase();
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export function findBoundCommandAction(
  event: KeyboardEvent,
  actions: CommandAction[],
): CommandAction | undefined {
  if (isEditableTarget(event.target)) return undefined;

  return actions.find((action) => {
    const binding = action.shortcutBinding;
    if (!binding?.global || action.disabled) return false;
    return matchesCommandShortcut(event, binding);
  });
}

export type CommandPaletteActions = {
  onJumpToNode: (node: AtlasGraphNode) => void;
  onShowFromEntry: () => void;
  onCompactLayout: () => void;
  onToggleClusterMode: () => void;
  onToggleNeighborhoodFocus: () => void;
  onFitView: () => void;
  onFocusSelected: () => void;
  onCopySelectedName: () => void;
  onCopySelectedPath: () => void;
};

export type CommandPaletteState = {
  nodes: AtlasGraphNode[];
  clusterMode: boolean;
  neighborhoodFocus: boolean;
  compactLayoutDisabled: boolean;
  selected: AtlasGraphNode | null;
  hasEntryNodes: boolean;
};

export const COMMAND_GROUP_LABELS: Record<CommandGroupId, string> = {
  navigate: "Navigate",
  graph: "Graph",
  selection: "Selection",
};

export function filterJumpNodes(
  nodes: AtlasGraphNode[],
  query: string,
  limit = 12,
): AtlasGraphNode[] {
  const trimmed = query.trim().toLowerCase();
  const candidates = nodes.filter((node) => !node.cluster);

  if (!trimmed) {
    return candidates.slice(0, limit);
  }

  return candidates
    .filter((node) => {
      const haystack = `${node.name} ${node.file} ${node.type}`.toLowerCase();
      return haystack.includes(trimmed);
    })
    .slice(0, limit);
}

export function buildCommandActions(
  state: CommandPaletteState,
  actions: CommandPaletteActions,
): CommandAction[] {
  const hasSelection = Boolean(state.selected && !state.selected.cluster);

  const withShortcut = (
    action: Omit<CommandAction, "shortcut" | "shortcutBinding">,
  ): CommandAction => {
    const binding = COMMAND_SHORTCUTS[action.id];
    if (!binding) return action;
    return {
      ...action,
      shortcut: formatCommandShortcut(binding),
      shortcutBinding: binding,
    };
  };

  return [
    withShortcut({
      id: "show-from-entry",
      group: "navigate",
      label: "From entry",
      keywords: ["entry", "boot", "start"],
      disabled: !state.hasEntryNodes,
      run: actions.onShowFromEntry,
    }),
    withShortcut({
      id: "fit-view",
      group: "graph",
      label: "Fit view",
      keywords: ["zoom", "reset", "frame"],
      run: actions.onFitView,
    }),
    withShortcut({
      id: "compact-layout",
      group: "graph",
      label: "Compact layout",
      keywords: ["relayout", "dagre"],
      disabled: state.compactLayoutDisabled,
      run: actions.onCompactLayout,
    }),
    withShortcut({
      id: "toggle-cluster-folders",
      group: "graph",
      label: state.clusterMode ? "Disable cluster folders" : "Enable cluster folders",
      keywords: ["cluster", "folders", "group"],
      run: actions.onToggleClusterMode,
    }),
    withShortcut({
      id: "toggle-dim-distant",
      group: "graph",
      label: state.neighborhoodFocus
        ? "Disable dim distant nodes"
        : "Enable dim distant nodes",
      keywords: ["neighborhood", "focus", "dim"],
      run: actions.onToggleNeighborhoodFocus,
    }),
    withShortcut({
      id: "focus-selected",
      group: "selection",
      label: "Focus selected node",
      keywords: ["pan", "zoom", "camera"],
      disabled: !hasSelection,
      run: actions.onFocusSelected,
    }),
    withShortcut({
      id: "copy-selected-name",
      group: "selection",
      label: "Copy selected node name",
      keywords: ["clipboard", "name"],
      disabled: !hasSelection,
      run: actions.onCopySelectedName,
    }),
    withShortcut({
      id: "copy-selected-path",
      group: "selection",
      label: "Copy selected file path",
      keywords: ["clipboard", "file", "path"],
      disabled: !hasSelection || state.selected?.file === "external",
      run: actions.onCopySelectedPath,
    }),
  ];
}

export function groupCommandActions(actions: CommandAction[]): Map<CommandGroupId, CommandAction[]> {
  const groups = new Map<CommandGroupId, CommandAction[]>();
  for (const action of actions) {
    const bucket = groups.get(action.group) ?? [];
    bucket.push(action);
    groups.set(action.group, bucket);
  }
  return groups;
}

export function isModKey(event: Pick<KeyboardEvent, "metaKey" | "ctrlKey">): boolean {
  return event.metaKey || event.ctrlKey;
}

export function shouldOpenCommandPalette(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey">,
): boolean {
  return isModKey(event) && event.key.toLowerCase() === "k";
}
