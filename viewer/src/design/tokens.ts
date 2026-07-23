import type { AtlasGraphNode } from "../types";

export const typeColors = {
  component: "#60a5fa",
  hook: "#c084fc",
  utility: "#34d399",
  context: "#fbbf24",
  entry: "#22d3ee",
  config: "#94a3b8",
} as const satisfies Record<AtlasGraphNode["type"], string>;

export const edgeColors = {
  imports: "#64748b",
  renders: "#3b82f6",
  uses: "#8b5cf6",
} as const;

export const typeLabels = {
  component: "Component",
  hook: "Hook",
  utility: "Utility",
  context: "Context",
  entry: "Entry",
  config: "Config",
} as const;

export const nodeTypes = Object.keys(typeColors) as Array<keyof typeof typeColors>;
