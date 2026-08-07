import { useEffect, useMemo, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import type { AtlasGraphNode } from "@/types";
import {
  buildCommandActions,
  COMMAND_GROUP_LABELS,
  filterJumpNodes,
  findBoundCommandAction,
  groupCommandActions,
  shouldOpenCommandPalette,
  type CommandPaletteActions,
  type CommandPaletteState,
} from "./commandRegistry";

type Props = {
  state: CommandPaletteState;
  actions: CommandPaletteActions;
};

export function CommandPalette({ state, actions }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const jumpNodes = useMemo(
    () => filterJumpNodes(state.nodes, query),
    [state.nodes, query]
  );

  const commandActions = useMemo(
    () => buildCommandActions(state, actions),
    [state, actions]
  );

  const groupedActions = useMemo(
    () => groupCommandActions(commandActions),
    [commandActions]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (shouldOpenCommandPalette(event)) {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }

      const bound = findBoundCommandAction(event, commandActions);
      if (bound) {
        event.preventDefault();
        bound.run();
        if (open) setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandActions, open]);

  const runAndClose = (run: () => void) => {
    run();
    setOpen(false);
  };

  const onSelectNode = (node: AtlasGraphNode) => {
    runAndClose(() => actions.onJumpToNode(node));
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search nodes and commands…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {jumpNodes.length > 0 && (
          <CommandGroup heading="Jump to node">
            {jumpNodes.map((node) => (
              <CommandItem
                key={node.id}
                value={`${node.name} ${node.file} ${node.type}`}
                onSelect={() => onSelectNode(node)}
              >
                <span className="truncate">{node.name}</span>
                <span className="ml-2 truncate text-xs text-muted-foreground">
                  {node.file}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {jumpNodes.length > 0 && groupedActions.size > 0 && (
          <CommandSeparator />
        )}

        {(["navigate", "graph", "selection"] as const).map((groupId) => {
          const items = groupedActions.get(groupId);
          if (!items?.length) return null;

          return (
            <CommandGroup key={groupId} heading={COMMAND_GROUP_LABELS[groupId]}>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={[item.label, ...(item.keywords ?? [])].join(" ")}
                  disabled={item.disabled}
                  onSelect={() => runAndClose(item.run)}
                >
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.shortcut ? (
                    <CommandShortcut>{item.shortcut}</CommandShortcut>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
