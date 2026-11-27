import { Position, type Edge, type Node } from "@xyflow/react";
import type { AtlasNodeData } from "./buildFlowGraph";
import { folderKey } from "./clusterGraph";
import { edgeColors } from "./design/tokens";
import {
  classifyHumanRole,
  computeRenderConsumerDomainCounts,
  explainSymbolRelationship,
  humanizeAreaIdentity,
  type EvidenceCertainty,
  type HumanRoleInfo,
} from "./humanSemantics";
import type { AtlasGraph, AtlasGraphNode, GraphEdgeType } from "./types";

export const STORY_GROUP_TOGGLE_EVENT = "arclens:toggle-story-group";
export const STORY_INSPECT_CODE_EVENT = "arclens:toggle-technical-inspector";
export const STORY_OPEN_AREA_MAP_EVENT = "arclens:open-story-area-map";

export function dispatchStoryGroupToggle(groupKey: string): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<string>(STORY_GROUP_TOGGLE_EVENT, { detail: groupKey })
    );
  }
}

export function dispatchToggleTechnicalInspector(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(STORY_INSPECT_CODE_EVENT));
  }
}

export function dispatchOpenStoryAreaMap(area: string): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<string>(STORY_OPEN_AREA_MAP_EVENT, { detail: area })
    );
  }
}

export type StoryColumnHeaderData = {
  label: string;
  subtitle: string;
};

export type StoryAnchorNodeData = {
  nodeId: string;
  label: string;
  type: AtlasGraphNode["type"];
  roleInfo: HumanRoleInfo;
  areaDomain: string;
  areaTitle: string;
  summary: string;
  upstreamCount: number;
  downstreamCount: number;
  inspectorOpen: boolean;
};

export type StoryCardNodeData = {
  nodeId: string;
  label: string;
  type: AtlasGraphNode["type"];
  roleInfo: HumanRoleInfo;
  areaDomain: string;
  areaTitle: string;
  isCrossArea: boolean;
  direction: "upstream" | "downstream";
  relationLabel: string;
  relationSentence: string;
  certainty: EvidenceCertainty;
  certaintyBadge: string;
  isPreviousStep: boolean;
};

export type StoryGroupNodeData = {
  groupKey: string;
  title: string;
  count: number;
  previewText: string;
  explanation: string;
  expanded: boolean;
  direction: "upstream" | "downstream";
};

type NeighborItem = {
  node: AtlasGraphNode;
  roleInfo: HumanRoleInfo;
  edgeTypes: GraphEdgeType[];
  renderCount: number;
  areaDomain: string;
  areaTitle: string;
  isCrossArea: boolean;
};

const LEFT_COL_X = 48;
const CENTER_COL_X = 420;
const RIGHT_COL_X = 836;
const RIGHT_COL_2_X = 1106;

const STORY_CARD_H = 98;
const STORY_GROUP_H = 104;
const STORY_ANCHOR_H = 188;
const CARD_GAP_Y = 14;
const HEADER_Y = 16;
const FIRST_CARD_Y = 62;

const ROLE_PRIORITY: Record<HumanRoleInfo["role"], number> = {
  entry: 0,
  screen: 1,
  component: 2,
  hook: 3,
  context: 4,
  service: 5,
  helper: 6,
  config: 7,
  "shared-ui": 8,
};

function strokeForEdgeTypes(types: readonly GraphEdgeType[]): string {
  if (types.includes("renders")) return edgeColors.renders;
  if (types.includes("uses")) return edgeColors.uses;
  return edgeColors.imports;
}

function collectNeighbors(
  graph: AtlasGraph,
  focusNode: AtlasGraphNode,
  focusDomain: string,
  renderCounts: ReadonlyMap<string, number>
): {
  upstream: NeighborItem[];
  downstream: NeighborItem[];
} {
  const byId = new Map(graph.nodes.map((n) => [n.id, n] as const));
  const incomingMap = new Map<
    string,
    { types: Set<GraphEdgeType>; renderCount: number }
  >();
  const outgoingMap = new Map<
    string,
    { types: Set<GraphEdgeType>; renderCount: number }
  >();

  for (const edge of graph.edges) {
    if (edge.to === focusNode.id && edge.from !== focusNode.id) {
      const entry = incomingMap.get(edge.from) ?? {
        types: new Set<GraphEdgeType>(),
        renderCount: 0,
      };
      entry.types.add(edge.type);
      if (edge.type === "renders") entry.renderCount += 1;
      incomingMap.set(edge.from, entry);
    } else if (edge.from === focusNode.id && edge.to !== focusNode.id) {
      const entry = outgoingMap.get(edge.to) ?? {
        types: new Set<GraphEdgeType>(),
        renderCount: 0,
      };
      entry.types.add(edge.type);
      if (edge.type === "renders") entry.renderCount += 1;
      outgoingMap.set(edge.to, entry);
    }
  }

  const toItem = (
    id: string,
    meta: { types: Set<GraphEdgeType>; renderCount: number }
  ): NeighborItem | null => {
    const other = byId.get(id);
    if (!other) return null;
    const roleInfo = classifyHumanRole(other, renderCounts.get(other.id) ?? 0);
    const areaDomain =
      other.file === "external" ? "external" : folderKey(other.file);
    const areaTitle =
      other.file === "external"
        ? "External Library"
        : humanizeAreaIdentity(areaDomain).title;
    return {
      node: other,
      roleInfo,
      edgeTypes: [...meta.types],
      renderCount: Math.max(1, meta.renderCount),
      areaDomain,
      areaTitle,
      isCrossArea: areaDomain !== focusDomain,
    };
  };

  const sortItems = (items: NeighborItem[]) =>
    items.sort((a, b) => {
      if (a.isCrossArea !== b.isCrossArea) return a.isCrossArea ? 1 : -1;
      const roleDiff =
        ROLE_PRIORITY[a.roleInfo.role] - ROLE_PRIORITY[b.roleInfo.role];
      if (roleDiff !== 0) return roleDiff;
      if (b.renderCount !== a.renderCount) return b.renderCount - a.renderCount;
      return a.node.name.localeCompare(b.node.name);
    });

  const upstream: NeighborItem[] = [];
  for (const [id, meta] of incomingMap) {
    const item = toItem(id, meta);
    if (item) upstream.push(item);
  }

  const downstream: NeighborItem[] = [];
  for (const [id, meta] of outgoingMap) {
    const item = toItem(id, meta);
    if (item) downstream.push(item);
  }

  return {
    upstream: sortItems(upstream),
    downstream: sortItems(downstream),
  };
}

function buildFocusStorySummary(
  upstream: readonly NeighborItem[],
  downstream: readonly NeighborItem[]
): string {
  const upPart =
    upstream.length === 0
      ? "Starting point (nothing in the analyzed graph calls or renders this directly)."
      : upstream.length === 1
        ? `Used by ${upstream[0]!.node.name}.`
        : `Used by ${upstream.length} elements (${upstream
            .slice(0, 2)
            .map((u) => u.node.name)
            .join(", ")}${upstream.length > 2 ? ", …" : ""}).`;

  if (downstream.length === 0) {
    return `${upPart} Leaf element with no outgoing project dependencies.`;
  }

  let renderedFeatureUi = 0;
  let importedFeatureUi = 0;
  let renderedSharedUi = 0;
  let importedSharedUi = 0;
  let hooks = 0;
  let modules = 0;

  for (const item of downstream) {
    const r = item.roleInfo.role;
    const hasRenders = item.edgeTypes.includes("renders");
    if (r === "screen" || r === "component" || r === "entry") {
      if (hasRenders) renderedFeatureUi += 1;
      else importedFeatureUi += 1;
    } else if (r === "shared-ui") {
      if (hasRenders) renderedSharedUi += 1;
      else importedSharedUi += 1;
    } else if (r === "hook" || r === "context") {
      hooks += 1;
    } else {
      modules += 1;
    }
  }

  const downParts: string[] = [];
  if (renderedFeatureUi > 0 && importedFeatureUi > 0) {
    downParts.push(
      `renders ${renderedFeatureUi} and imports ${importedFeatureUi} feature components`
    );
  } else if (renderedFeatureUi > 0) {
    downParts.push(
      `renders ${renderedFeatureUi} feature ${renderedFeatureUi === 1 ? "component" : "components"}`
    );
  } else if (importedFeatureUi > 0) {
    downParts.push(
      `imports ${importedFeatureUi} feature ${importedFeatureUi === 1 ? "component" : "components"}`
    );
  }

  if (renderedSharedUi > 0 && importedSharedUi > 0) {
    downParts.push(
      `renders ${renderedSharedUi} and imports ${importedSharedUi} shared UI primitives`
    );
  } else if (renderedSharedUi > 0) {
    downParts.push(
      `renders ${renderedSharedUi} shared UI ${renderedSharedUi === 1 ? "primitive" : "primitives"}`
    );
  } else if (importedSharedUi > 0) {
    downParts.push(
      `imports ${importedSharedUi} shared UI ${importedSharedUi === 1 ? "primitive" : "primitives"}`
    );
  }

  if (hooks > 0) {
    downParts.push(
      `connects to ${hooks} state ${hooks === 1 ? "hook/context" : "hooks/contexts"}`
    );
  }
  if (modules > 0) {
    downParts.push(
      `imports ${modules} service/helper ${modules === 1 ? "module" : "modules"}`
    );
  }

  return `${upPart} Directly ${downParts.join(", ")}.`;
}

export type FeatureStoryBuildResult = {
  nodes: Node<AtlasNodeData>[];
  edges: Edge[];
  focusNode: AtlasGraphNode;
  focusDomain: string;
};

/**
 * Construct a clean 3-column Focused Feature Story (`Used By → Focus Anchor → What This Uses`)
 * with plain-language edge explanations and expandable noise-reduction groups
 * (`Shared UI components · N`, `Data, services & helpers · N`, `Other callers · +N`).
 */
export function buildFeatureStoryView(
  graph: AtlasGraph,
  focusNodeId: string,
  expandedGroups: ReadonlySet<string> = new Set(),
  options: {
    viaNodeId?: string | null;
    inspectorOpen?: boolean;
  } = {}
): FeatureStoryBuildResult | null {
  const focusNode = graph.nodes.find((n) => n.id === focusNodeId);
  if (!focusNode) return null;

  const renderCounts = computeRenderConsumerDomainCounts(graph);
  const focusRole = classifyHumanRole(
    focusNode,
    renderCounts.get(focusNode.id) ?? 0
  );
  const focusDomain =
    focusNode.file === "external" ? "external" : folderKey(focusNode.file);
  const focusAreaTitle =
    focusNode.file === "external"
      ? "External Library"
      : humanizeAreaIdentity(focusDomain).title;

  const { upstream, downstream } = collectNeighbors(
    graph,
    focusNode,
    focusDomain,
    renderCounts
  );

  // Promote `viaNodeId` to top of its column so the user's previous step stays anchored at the top
  const prioritizeVia = (list: NeighborItem[]): NeighborItem[] => {
    if (!options.viaNodeId) return [...list];
    const idx = list.findIndex((i) => i.node.id === options.viaNodeId);
    if (idx <= 0) return [...list];
    const copy = [...list];
    const [picked] = copy.splice(idx, 1);
    return [picked!, ...copy];
  };

  const orderedUpstream = prioritizeVia(upstream);
  const orderedDownstream = prioritizeVia(downstream);

  const flowNodes: Node<AtlasNodeData>[] = [];
  const flowEdges: Edge[] = [];

  // ── Column 1: Upstream ("Used by / Leads here") ──────────────────────────
  flowNodes.push({
    id: "story-header::upstream",
    type: "storyHeader",
    position: { x: LEFT_COL_X, y: HEADER_Y },
    selectable: false,
    draggable: false,
    focusable: false,
    data: {
      label:
        orderedUpstream.length > 0
          ? `← Used by (${orderedUpstream.length})`
          : "← Starting point",
      subtitle:
        orderedUpstream.length > 0
          ? "Click any caller to step upstream"
          : "No upstream callers in project",
      type: "utility",
      nodeId: "story-header::upstream",
    } as unknown as AtlasNodeData,
  });

  let leftY = FIRST_CARD_Y;
  const collapseUpstreamExtra =
    orderedUpstream.length > 6 && !expandedGroups.has("upstream-more");
  const visibleUpstream = collapseUpstreamExtra
    ? orderedUpstream.slice(0, 5)
    : orderedUpstream;

  for (const item of visibleUpstream) {
    const exp = explainSymbolRelationship({
      sourceNode: item.node,
      targetNode: focusNode,
      edgeTypes: item.edgeTypes,
      count: item.renderCount,
      perspective: "incoming",
    });

    flowNodes.push({
      id: item.node.id,
      type: "storyCard",
      position: { x: LEFT_COL_X, y: leftY },
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      draggable: false,
      data: {
        nodeId: item.node.id,
        label: item.node.name,
        type: item.node.type,
        roleInfo: item.roleInfo,
        areaDomain: item.areaDomain,
        areaTitle: item.areaTitle,
        isCrossArea: item.isCrossArea,
        direction: "upstream",
        relationLabel: exp.shortLabel,
        relationSentence: exp.sentence,
        certainty: exp.certainty,
        certaintyBadge: exp.certaintyBadge,
        isPreviousStep: options.viaNodeId === item.node.id,
      } as unknown as AtlasNodeData,
    });

    const stroke = strokeForEdgeTypes(item.edgeTypes);
    flowEdges.push({
      id: `story-in::${item.node.id}`,
      source: item.node.id,
      target: focusNode.id,
      type: "smoothstep",
      label: exp.shortLabel,
      labelStyle: { fill: "#e2e8f0", fontSize: 10.5, fontWeight: 600 },
      labelBgStyle: { fill: "#18181b", fillOpacity: 0.92 },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 4,
      style: { stroke, strokeWidth: 2, opacity: 0.92 },
      markerEnd: { type: "arrowclosed", color: stroke },
    });

    leftY += STORY_CARD_H + CARD_GAP_Y;
  }

  if (orderedUpstream.length > 6) {
    const hidden = orderedUpstream.slice(5);
    const groupId = "story-group::upstream-more";
    const isExpanded = expandedGroups.has("upstream-more");
    flowNodes.push({
      id: groupId,
      type: "storyGroup",
      position: { x: LEFT_COL_X, y: leftY },
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      draggable: false,
      data: {
        groupKey: "upstream-more",
        title: isExpanded
          ? "Fewer callers"
          : `Other callers · +${hidden.length}`,
        count: hidden.length,
        previewText: hidden
          .slice(0, 3)
          .map((h) => h.node.name)
          .join(", "),
        explanation: isExpanded
          ? "Click to collapse extra callers"
          : `Aggregated · ${hidden.length} additional components/modules reference ${focusNode.name}`,
        expanded: isExpanded,
        direction: "upstream",
        type: "utility",
        nodeId: groupId,
      } as unknown as AtlasNodeData,
    });

    if (!isExpanded) {
      flowEdges.push({
        id: "story-in::upstream-more",
        source: groupId,
        target: focusNode.id,
        type: "smoothstep",
        label: `+${hidden.length} callers`,
        labelStyle: { fill: "#cbd5e1", fontSize: 10.5, fontWeight: 600 },
        labelBgStyle: { fill: "#18181b", fillOpacity: 0.92 },
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 4,
        style: {
          stroke: edgeColors.imports,
          strokeWidth: 1.75,
          strokeDasharray: "4 3",
          opacity: 0.85,
        },
        markerEnd: { type: "arrowclosed", color: edgeColors.imports },
      });
    }
    leftY += STORY_GROUP_H + CARD_GAP_Y;
  }

  // ── Column 3: Downstream ("What this uses", grouped by meaningful role) ──
  flowNodes.push({
    id: "story-header::downstream",
    type: "storyHeader",
    position: { x: RIGHT_COL_X, y: HEADER_Y },
    selectable: false,
    draggable: false,
    focusable: false,
    data: {
      label:
        orderedDownstream.length > 0
          ? `What this uses → (${orderedDownstream.length})`
          : "No outgoing dependencies",
      subtitle:
        orderedDownstream.length > 0
          ? "Click any item to follow the story forward"
          : "Leaf symbol",
      type: "utility",
      nodeId: "story-header::downstream",
    } as unknown as AtlasNodeData,
  });

  const primaryComponents: NeighborItem[] = [];
  const stateAndHooks: NeighborItem[] = [];
  const servicesAndHelpers: NeighborItem[] = [];
  const sharedUiPrimitives: NeighborItem[] = [];

  for (const item of orderedDownstream) {
    // Keep `viaNodeId` ungrouped if the user walked up from a primitive/helper!
    if (options.viaNodeId && item.node.id === options.viaNodeId) {
      primaryComponents.unshift(item);
      continue;
    }
    const r = item.roleInfo.role;
    if (r === "shared-ui") {
      sharedUiPrimitives.push(item);
    } else if (r === "hook" || r === "context") {
      stateAndHooks.push(item);
    } else if (r === "service" || r === "helper" || r === "config") {
      servicesAndHelpers.push(item);
    } else {
      primaryComponents.push(item);
    }
  }

  let rightY = FIRST_CARD_Y;

  const pushDownstreamItem = (item: NeighborItem, xPos = RIGHT_COL_X, yPos?: number) => {
    const y = yPos ?? rightY;
    const exp = explainSymbolRelationship({
      sourceNode: focusNode,
      targetNode: item.node,
      edgeTypes: item.edgeTypes,
      count: item.renderCount,
      perspective: "outgoing",
      targetRole: item.roleInfo.role,
    });

    flowNodes.push({
      id: item.node.id,
      type: "storyCard",
      position: { x: xPos, y },
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      draggable: false,
      data: {
        nodeId: item.node.id,
        label: item.node.name,
        type: item.node.type,
        roleInfo: item.roleInfo,
        areaDomain: item.areaDomain,
        areaTitle: item.areaTitle,
        isCrossArea: item.isCrossArea,
        direction: "downstream",
        relationLabel: exp.shortLabel,
        relationSentence: exp.sentence,
        certainty: exp.certainty,
        certaintyBadge: exp.certaintyBadge,
        isPreviousStep: options.viaNodeId === item.node.id,
      } as unknown as AtlasNodeData,
    });

    const stroke = strokeForEdgeTypes(item.edgeTypes);
    flowEdges.push({
      id: `story-out::${item.node.id}`,
      source: focusNode.id,
      target: item.node.id,
      type: "smoothstep",
      label: xPos === RIGHT_COL_X ? exp.shortLabel : undefined,
      labelStyle: { fill: "#e2e8f0", fontSize: 10.5, fontWeight: 600 },
      labelBgStyle: { fill: "#18181b", fillOpacity: 0.92 },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 4,
      style: { stroke, strokeWidth: 2, opacity: 0.92 },
      markerEnd: { type: "arrowclosed", color: stroke },
    });

    if (yPos === undefined) {
      rightY += STORY_CARD_H + CARD_GAP_Y;
    }
  };

  // 1. Primary Screens & Feature Components
  const collapsePrimaryExtra =
    primaryComponents.length > 6 && !expandedGroups.has("components-more");
  const visiblePrimary = collapsePrimaryExtra
    ? primaryComponents.slice(0, 5)
    : primaryComponents;
  for (const item of visiblePrimary) {
    pushDownstreamItem(item);
  }
  if (primaryComponents.length > 6) {
    const hidden = primaryComponents.slice(5);
    const isExpanded = expandedGroups.has("components-more");
    const groupId = "story-group::components-more";
    flowNodes.push({
      id: groupId,
      type: "storyGroup",
      position: { x: RIGHT_COL_X, y: rightY },
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      draggable: false,
      data: {
        groupKey: "components-more",
        title: isExpanded
          ? "Collapse extra feature components"
          : `Feature components · +${hidden.length} more`,
        count: hidden.length,
        previewText: hidden
          .slice(0, 3)
          .map((h) => h.node.name)
          .join(", "),
        explanation: isExpanded
          ? "Click to fold back"
          : `Aggregated · ${hidden.length} additional feature components`,
        expanded: isExpanded,
        direction: "downstream",
        type: "component",
        nodeId: groupId,
      } as unknown as AtlasNodeData,
    });
    if (!isExpanded) {
      flowEdges.push({
        id: "story-out::components-more",
        source: focusNode.id,
        target: groupId,
        type: "smoothstep",
        label: `+${hidden.length} components`,
        labelStyle: { fill: "#cbd5e1", fontSize: 10.5, fontWeight: 600 },
        labelBgStyle: { fill: "#18181b", fillOpacity: 0.92 },
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 4,
        style: {
          stroke: edgeColors.renders,
          strokeWidth: 1.75,
          strokeDasharray: "4 3",
          opacity: 0.88,
        },
        markerEnd: { type: "arrowclosed", color: edgeColors.renders },
      });
    }
    rightY += STORY_GROUP_H + CARD_GAP_Y;
  }

  // 2. State, Context & Hooks
  for (const item of stateAndHooks) {
    pushDownstreamItem(item);
  }

  // 3. Data, Services & Helpers (collapse when >= 4)
  if (servicesAndHelpers.length >= 4) {
    const isExpanded = expandedGroups.has("services-helpers");
    const groupId = "story-group::services-helpers";
    const previewNames = servicesAndHelpers
      .slice(0, 3)
      .map((s) => s.node.name)
      .join(", ");

    flowNodes.push({
      id: groupId,
      type: "storyGroup",
      position: { x: RIGHT_COL_X, y: rightY },
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      draggable: false,
      data: {
        groupKey: "services-helpers",
        title: `Data, services & helpers · ${servicesAndHelpers.length}`,
        count: servicesAndHelpers.length,
        previewText:
          servicesAndHelpers.length > 3
            ? `${previewNames} + ${servicesAndHelpers.length - 3} more`
            : previewNames,
        explanation: isExpanded
          ? "Expanded · Click to collapse group"
          : "Aggregated static imports · Expand to inspect each module",
        expanded: isExpanded,
        direction: "downstream",
        type: "utility",
        nodeId: groupId,
      } as unknown as AtlasNodeData,
    });

    flowEdges.push({
      id: "story-out::services-helpers",
      source: focusNode.id,
      target: groupId,
      type: "smoothstep",
      label: `imports ${servicesAndHelpers.length} modules`,
      labelStyle: { fill: "#cbd5e1", fontSize: 10.5, fontWeight: 600 },
      labelBgStyle: { fill: "#18181b", fillOpacity: 0.92 },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 4,
      style: {
        stroke: edgeColors.imports,
        strokeWidth: 1.85,
        strokeDasharray: isExpanded ? undefined : "4 3",
        opacity: 0.9,
      },
      markerEnd: { type: "arrowclosed", color: edgeColors.imports },
    });

    rightY += STORY_GROUP_H + CARD_GAP_Y;

    if (isExpanded) {
      for (let i = 0; i < servicesAndHelpers.length; i += 2) {
        const first = servicesAndHelpers[i]!;
        const second = servicesAndHelpers[i + 1];
        pushDownstreamItem(first, RIGHT_COL_X, rightY);
        if (second) {
          pushDownstreamItem(second, RIGHT_COL_2_X, rightY);
        }
        rightY += STORY_CARD_H + CARD_GAP_Y;
      }
    }
  } else {
    for (const item of servicesAndHelpers) {
      pushDownstreamItem(item);
    }
  }

  // 4. Shared UI Components (Section 7 — collapse when >= 3 so primitives never drown business logic!)
  if (sharedUiPrimitives.length >= 3) {
    const isExpanded = expandedGroups.has("shared-ui");
    const groupId = "story-group::shared-ui";
    const previewNames = sharedUiPrimitives
      .slice(0, 3)
      .map((u) =>
        u.renderCount > 1 ? `${u.node.name} ×${u.renderCount}` : u.node.name
      )
      .join(" · ");

    flowNodes.push({
      id: groupId,
      type: "storyGroup",
      position: { x: RIGHT_COL_X, y: rightY },
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      draggable: false,
      data: {
        groupKey: "shared-ui",
        title: `Shared UI components · ${sharedUiPrimitives.length}`,
        count: sharedUiPrimitives.length,
        previewText:
          sharedUiPrimitives.length > 3
            ? `${previewNames} + ${sharedUiPrimitives.length - 3} more`
            : previewNames,
        explanation: isExpanded
          ? "Expanded · Click to collapse shared UI primitives"
          : "Aggregated · Reusable interface building blocks · Expand to inspect",
        expanded: isExpanded,
        direction: "downstream",
        type: "component",
        nodeId: groupId,
      } as unknown as AtlasNodeData,
    });

    const renderedSharedCount = sharedUiPrimitives.filter((u) =>
      u.edgeTypes.includes("renders")
    ).length;
    const sharedGroupStroke =
      renderedSharedCount > 0 ? edgeColors.renders : edgeColors.imports;
    const sharedGroupLabel =
      renderedSharedCount === sharedUiPrimitives.length
        ? `renders ${sharedUiPrimitives.length} shared UI`
        : renderedSharedCount === 0
          ? `imports ${sharedUiPrimitives.length} shared UI`
          : `renders ${renderedSharedCount} · imports ${sharedUiPrimitives.length - renderedSharedCount} shared UI`;

    flowEdges.push({
      id: "story-out::shared-ui",
      source: focusNode.id,
      target: groupId,
      type: "smoothstep",
      label: sharedGroupLabel,
      labelStyle: {
        fill: renderedSharedCount > 0 ? "#bae6fd" : "#cbd5e1",
        fontSize: 10.5,
        fontWeight: 600,
      },
      labelBgStyle: { fill: "#18181b", fillOpacity: 0.92 },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 4,
      style: {
        stroke: sharedGroupStroke,
        strokeWidth: 1.85,
        strokeDasharray: isExpanded ? undefined : "4 3",
        opacity: 0.9,
      },
      markerEnd: { type: "arrowclosed", color: sharedGroupStroke },
    });

    rightY += STORY_GROUP_H + CARD_GAP_Y;

    if (isExpanded) {
      for (let i = 0; i < sharedUiPrimitives.length; i += 2) {
        const first = sharedUiPrimitives[i]!;
        const second = sharedUiPrimitives[i + 1];
        pushDownstreamItem(first, RIGHT_COL_X, rightY);
        if (second) {
          pushDownstreamItem(second, RIGHT_COL_2_X, rightY);
        }
        rightY += STORY_CARD_H + CARD_GAP_Y;
      }
    }
  } else {
    for (const item of sharedUiPrimitives) {
      pushDownstreamItem(item);
    }
  }

  // ── Column 2: Visual Focus Anchor (vertically centered against columns) ──
  const maxColumnBottom = Math.max(
    leftY - CARD_GAP_Y,
    rightY - CARD_GAP_Y,
    FIRST_CARD_Y + STORY_ANCHOR_H
  );
  const centerSpanMid = (FIRST_CARD_Y + maxColumnBottom) / 2;
  const anchorY = Math.max(
    FIRST_CARD_Y,
    Math.round(Math.min(260, centerSpanMid - STORY_ANCHOR_H / 2))
  );

  flowNodes.push({
    id: focusNode.id,
    type: "storyAnchor",
    position: { x: CENTER_COL_X, y: anchorY },
    targetPosition: Position.Left,
    sourcePosition: Position.Right,
    draggable: false,
    selected: true,
    data: {
      nodeId: focusNode.id,
      label: focusNode.name,
      type: focusNode.type,
      roleInfo: focusRole,
      areaDomain: focusDomain,
      areaTitle: focusAreaTitle,
      summary: buildFocusStorySummary(upstream, downstream),
      upstreamCount: upstream.length,
      downstreamCount: downstream.length,
      inspectorOpen: Boolean(options.inspectorOpen),
    } as unknown as AtlasNodeData,
  });

  return {
    nodes: flowNodes,
    edges: flowEdges,
    focusNode,
    focusDomain,
  };
}
