import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node as FlowNode,
  type OnNodeDrag,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AreaContextBanner } from "./AreaContextBanner";
import {
  AtlasClusterNode,
  OPEN_CLUSTER_EVENT,
  type ClusterNodeData,
} from "./AtlasClusterNode";
import { AtlasNode } from "./AtlasNode";
import {
  AtlasStoryAnchorNode,
  AtlasStoryCardNode,
  AtlasStoryGroupNode,
  AtlasStoryHeaderNode,
} from "./AtlasStoryNodes";
import { AtlasTierHeaderNode } from "./AtlasTierHeaderNode";
import {
  buildFlowGraph,
  formatRelativePath,
  layoutFlowGraphNodesAsync,
  nodeTypes as legendTypes,
  relayoutFlowNodesAsync,
  type AtlasNodeData,
  typeColors,
} from "./buildFlowGraph";
import {
  applyClusterView,
  buildDomainDrilldownGraph,
  clusterNodeId,
  computeSearchHighlightIds,
  filterExternalNodes,
  findDomainBridgeNodes,
  findEntryNodes,
  folderFromClusterId,
  folderKey,
  groupNodesByFolder,
  isClusterId,
  mergeSearchPartialReveals,
} from "./clusterGraph";
import { DomainSummaryPanel } from "./DomainSummaryPanel";
import { filterEdgesByVisibility } from "./edgeVisibility";
import {
  DEFAULT_EDGE_VISIBILITY,
  loadEdgeVisibility,
  saveEdgeVisibility,
  setEdgeTypeVisible,
  type EdgeVisibilityPrefs,
} from "./edgeVisibilityPrefs";
import { ExportBridge, triggerExport } from "./exportGraphBridge";
import type { CommandPaletteActions } from "./features/command-palette/commandRegistry";
import { CommandPalette } from "./features/command-palette/CommandPalette";
import {
  FitViewBridge,
  triggerFitView,
} from "./features/command-palette/fitViewBridge";
import { MobileBanner } from "./features/mobile-banner/MobileBanner";
import {
  ensureNodeComfortablyVisible,
  fitViewportInSafeArea,
} from "./fitViewSafeArea";
import { GraphActions } from "./GraphActions";
import {
  buildNodeById,
  enrichNodeForDetails,
  getConnectedNodeIdsFromEdges,
  graphSignature,
} from "./graphConnections";
import { GraphLegend } from "./GraphLegend";
import {
  computeEntryPoints,
  computeHubNodes,
  computeTopFolders,
  type FolderOverview,
} from "./graphOverview";
import {
  emptyGraphPresentation,
  validateGraphData,
  type EmptyGraphPresentation,
} from "./graphValidation";
import {
  computeHelperLines,
  HelperLinesOverlay,
  type HelperLine,
} from "./HelperLines";
import {
  explainCrossAreaRelationship,
  humanizeAreaIdentity,
} from "./humanSemantics";
import { InfoTip } from "./InfoTip";
import { findNodeForInsight } from "./insightHelpers";
import {
  LayoutCancelledError,
  loadLayoutPreset,
  nextLayoutPreset,
  saveLayoutPreset,
  spreadCoincidentNodes,
  type LayoutPreset,
} from "./layoutPresets";
import { layoutTieredOverviewNodes } from "./layoutTieredOverview";
import { formatEdgeTypeLabel } from "./mergeFlowEdges";
import {
  DEFAULT_NEIGHBORHOOD_HOPS,
  defaultNeighborhoodFocusEnabled,
  resolveHighlightIds,
} from "./neighborhoodFocus";
import { NodeDetails } from "./NodeDetails";
import {
  loadNodePositions,
  mergeNodePositions,
  nodePositionsFromNodes,
  saveNodePositions,
} from "./nodePositionStorage";
import { computeNodeSpotlightIds } from "./nodeSpotlight";
import { NodeToolbarActions } from "./NodeToolbarActions";
import { OverviewShortcuts } from "./OverviewShortcuts";
import { findPathFromEntries, pathEdgeKeys } from "./pathHighlight";
import {
  buildFeatureStoryView,
  STORY_GROUP_TOGGLE_EVENT,
  STORY_INSPECT_CODE_EVENT,
  STORY_OPEN_AREA_MAP_EVENT,
  type StoryCardNodeData,
  type StoryGroupNodeData,
} from "./storyGraph";
import type { AtlasGraph, AtlasGraphNode, GraphInsight } from "./types";
import { selectVisibleGraph, type ViewGraphMode } from "./viewGraph";
import {
  CLUSTER_OVERVIEW_THRESHOLD,
  GRAPH_POLL_MS,
  GRAPH_POLL_MS_LARGE,
  LARGE_GRAPH_THRESHOLD,
  OVERVIEW_HUB_NODES,
  OVERVIEW_TOP_FOLDERS,
  VIRTUALIZE_THRESHOLD,
} from "./viewerConfig";
import { ViewerHeader, type BreadcrumbTrailItem } from "./ViewerHeader";
import { ViewportPersistence } from "./ViewportPersistence";
import { loadViewport } from "./viewportStorage";
import { ZoomControls } from "./ZoomControls";
import "./graph.css";

const flowNodeTypes = {
  atlas: AtlasNode,
  cluster: AtlasClusterNode,
  tierHeader: AtlasTierHeaderNode,
  storyHeader: AtlasStoryHeaderNode,
  storyAnchor: AtlasStoryAnchorNode,
  storyCard: AtlasStoryCardNode,
  storyGroup: AtlasStoryGroupNode,
};

const PRO_OPTIONS = { hideAttribution: true } as const;
const COMPACT_EDGE_DEFAULTS = {
  animated: false,
  type: "smoothstep" as const,
  pathOptions: { borderRadius: 6, offset: 22 },
} as const;

const DENSE_DOMAIN_EDGE_LABEL_THRESHOLD = 20;

type BridgeFocusState = {
  fromDomain: string;
  toDomain: string;
  targetNodeIds: string[];
  originClusterId: string;
};

type NavigationSnapshot = {
  scopeKey: string;
  crumbLabel: string;
  crumbSublabel?: string;
  activeDomain: string | null;
  storyFocusId: string | null;
  storyViaId: string | null;
  bridgeFocus: BridgeFocusState | null;
  expandedSubfolders: string[];
  storyExpandedGroups: string[];
  viewport: Viewport;
};

type CameraCommand =
  | {
      id: number;
      kind: "fit-readable";
      duration?: number;
    }
  | {
      id: number;
      kind: "fit-story";
      duration?: number;
    }
  | {
      id: number;
      kind: "fit-nodes";
      primaryNodeIds: string[];
      originNodeId?: string;
      duration?: number;
    }
  | {
      id: number;
      kind: "restore";
      viewport: Viewport;
      duration?: number;
    }
  | {
      id: number;
      kind: "ensure-node";
      nodeId: string;
    };

function scopeStorageKey(
  graphKey: string,
  activeDomain: string | null,
  storyFocusId: string | null
): string {
  if (!graphKey) return "";
  if (storyFocusId) return `${graphKey}::v4::story::${storyFocusId}`;
  return `${graphKey}::v4::${activeDomain ?? "overview"}`;
}

function nodeOpacity(
  node: FlowNode<AtlasNodeData>,
  searchLower: string,
  highlightIds: Set<string> | null
): number {
  if (
    node.type === "tierHeader" ||
    node.type === "storyHeader" ||
    node.type === "storyAnchor" ||
    node.type === "storyCard" ||
    node.type === "storyGroup"
  ) {
    return node.type === "tierHeader" && highlightIds && highlightIds.size > 0
      ? 0.72
      : 1;
  }

  const label = String(node.data.label ?? "");
  const matchesSearch =
    !searchLower || label.toLowerCase().includes(searchLower);

  if (highlightIds && highlightIds.size > 0) {
    return highlightIds.has(node.id) ? 1 : 0.22;
  }

  if (searchLower && !matchesSearch) return 0.24;
  return 1;
}

function patchNodePresentation(
  nodes: FlowNode<AtlasNodeData>[],
  searchLower: string,
  selectedId: string | null,
  highlightIds: Set<string> | null,
  bridgeFocus: BridgeFocusState | null
): FlowNode<AtlasNodeData>[] {
  const bridgeTargets = bridgeFocus ? new Set(bridgeFocus.targetNodeIds) : null;
  const bridgeFromTitle = bridgeFocus
    ? humanizeAreaIdentity(bridgeFocus.fromDomain).title
    : undefined;
  let changed = false;

  const next = nodes.map((node) => {
    if (
      node.type === "storyHeader" ||
      node.type === "storyAnchor" ||
      node.type === "storyCard" ||
      node.type === "storyGroup"
    ) {
      return node;
    }

    if (node.type === "tierHeader") {
      const opacity = nodeOpacity(node, searchLower, highlightIds);
      const prevOpacity = node.style?.opacity ?? 1;
      if (prevOpacity === opacity) return node;
      changed = true;
      return {
        ...node,
        style: { ...node.style, opacity },
      };
    }

    const opacity = nodeOpacity(node, searchLower, highlightIds);
    const isSelected = selectedId === node.id;
    const dimmed = opacity < 1;
    const prevOpacity = node.style?.opacity ?? 1;

    if (node.type === "cluster") {
      const clusterData = node.data as unknown as ClusterNodeData;
      const isBridgeOrigin = Boolean(
        bridgeFocus && node.id === bridgeFocus.originClusterId
      );
      if (
        node.selected === isSelected &&
        clusterData.selected === isSelected &&
        clusterData.dimmed === dimmed &&
        clusterData.isBridgeOrigin === isBridgeOrigin &&
        prevOpacity === opacity
      ) {
        return node;
      }

      changed = true;
      return {
        ...node,
        selected: isSelected,
        style: { ...node.style, opacity },
        data: {
          ...node.data,
          selected: isSelected,
          dimmed,
          isBridgeOrigin,
        } as AtlasNodeData,
      };
    }

    const linkedFrom =
      bridgeTargets && bridgeTargets.has(node.id) ? bridgeFromTitle : undefined;

    if (
      node.selected === isSelected &&
      node.data.selected === isSelected &&
      node.data.dimmed === dimmed &&
      node.data.linkedFrom === linkedFrom &&
      prevOpacity === opacity
    ) {
      return node;
    }

    changed = true;
    return {
      ...node,
      selected: isSelected,
      style: { ...node.style, opacity },
      data: {
        ...node.data,
        selected: isSelected,
        dimmed,
        linkedFrom,
      },
    };
  });

  return changed ? next : nodes;
}

function presentEdges(
  edges: Edge[],
  visibility: EdgeVisibilityPrefs,
  highlightIds: Set<string> | null,
  pathEdges: Set<string>,
  highlight: boolean,
  options: {
    isStoryView: boolean;
    isOverviewMap: boolean;
    showOverviewEdges: boolean;
    focusClusterId: string | null;
    crossAreaLabels: ReadonlyMap<string, string>;
    isDenseDomain: boolean;
    hoveredNodeId: string | null;
  }
): Edge[] {
  if (options.isStoryView) {
    return edges;
  }

  const visible = filterEdgesByVisibility(edges, visibility);

  if (options.isOverviewMap && !options.showOverviewEdges) {
    const focusId = options.focusClusterId;
    if (!focusId) return [];

    return visible
      .filter((edge) => edge.source === focusId || edge.target === focusId)
      .map((edge) => {
        const label =
          options.crossAreaLabels.get(`${edge.source}|${edge.target}`) ??
          "connected";
        return {
          ...edge,
          animated: false,
          label,
          labelStyle: {
            fill: "#e2e8f0",
            fontSize: 11,
            fontWeight: 600,
          },
          labelBgStyle: {
            fill: "#18181b",
            fillOpacity: 0.92,
          },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 4,
          style: {
            ...edge.style,
            strokeWidth: 2,
            opacity: 0.95,
          },
        };
      });
  }

  return visible.map((edge) => {
    let onPath = true;
    if (highlight && highlightIds) {
      if (pathEdges.size > 0) {
        onPath = false;
        for (const key of pathEdges) {
          const [from, to] = key.split("|");
          if (from === edge.source && to === edge.target) {
            onPath = true;
            break;
          }
        }
      } else {
        onPath =
          highlightIds.has(edge.source) && highlightIds.has(edge.target);
      }
    }

    const isHoveredEdge = Boolean(
      options.hoveredNodeId &&
        (edge.source === options.hoveredNodeId ||
          edge.target === options.hoveredNodeId)
    );

    const opacity = highlight && highlightIds ? (onPath ? 1 : 0.1) : 0.72;
    const showEdgeLabel = options.isDenseDomain
      ? (highlight && highlightIds && onPath) || isHoveredEdge
      : !highlight || onPath;

    const edgeTypes = edge.data?.edgeTypes as
      | Parameters<typeof formatEdgeTypeLabel>[0]
      | undefined;
    const computedLabel = showEdgeLabel
      ? (edge.label ??
        (edgeTypes ? formatEdgeTypeLabel(edgeTypes) : undefined))
      : undefined;

    return {
      ...edge,
      animated: false,
      label: computedLabel,
      style: {
        ...edge.style,
        strokeWidth: onPath && highlight ? 2.25 : 1.65,
        opacity,
      },
    };
  });
}

function CameraController({
  command,
  layoutReady,
  nodeCount,
  onHandled,
}: {
  command: CameraCommand | null;
  layoutReady: boolean;
  nodeCount: number;
  onHandled: (id: number) => void;
}) {
  const rf = useReactFlow<FlowNode<AtlasNodeData>>();
  const handledIdRef = useRef<number>(0);

  useEffect(() => {
    if (!command || !layoutReady || nodeCount === 0) return;
    if (handledIdRef.current === command.id) return;

    let cancelled = false;
    let raf2 = 0;

    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        if (cancelled) return;
        handledIdRef.current = command.id;

        if (command.kind === "fit-readable") {
          void fitViewportInSafeArea(rf, {
            padding: 0.06,
            duration: command.duration ?? 220,
            enforceReadableFloor: true,
          }).finally(() => {
            if (!cancelled) onHandled(command.id);
          });
          return;
        }

        if (command.kind === "fit-story") {
          void fitViewportInSafeArea(rf, {
            padding: 0.08,
            minZoom: 0.68,
            maxZoom: 0.94,
            duration: command.duration ?? 220,
            enforceReadableFloor: true,
          }).finally(() => {
            if (!cancelled) onHandled(command.id);
          });
          return;
        }

        if (command.kind === "fit-nodes") {
          const combinedIds = command.originNodeId
            ? [...command.primaryNodeIds, command.originNodeId]
            : command.primaryNodeIds;
          const combinedNodes = combinedIds
            .map((id) => rf.getNode(id))
            .filter((n): n is FlowNode<AtlasNodeData> => Boolean(n));
          const bounds =
            combinedNodes.length > 0 ? rf.getNodesBounds(combinedNodes) : null;
          const targetIds =
            bounds && bounds.width <= 960 && bounds.height <= 620
              ? combinedIds
              : command.primaryNodeIds.slice(0, 4);

          void fitViewportInSafeArea(rf, {
            nodeIds: targetIds,
            padding: 0.24,
            minZoom: 0.68,
            maxZoom: 0.9,
            duration: command.duration ?? 240,
            enforceReadableFloor: true,
          }).finally(() => {
            if (!cancelled) onHandled(command.id);
          });
          return;
        }

        if (command.kind === "restore") {
          void rf
            .setViewport(command.viewport, {
              duration: command.duration ?? 240,
            })
            .finally(() => {
              if (!cancelled) onHandled(command.id);
            });
          return;
        }

        if (command.kind === "ensure-node") {
          void ensureNodeComfortablyVisible(rf, command.nodeId, 240).finally(
            () => {
              if (!cancelled) onHandled(command.id);
            }
          );
        }
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, [command, layoutReady, nodeCount, rf, onHandled]);

  return null;
}

function EmptyGraphPanel({
  presentation,
}: {
  presentation: EmptyGraphPresentation;
}) {
  return (
    <div className="graph-shell graph-shell--empty">
      <div className="graph-panel graph-panel--empty">
        <p className="graph-panel__eyebrow">Arclens</p>
        <h1>{presentation.title}</h1>
        <p>{presentation.body}</p>
        <p className="graph-panel__detail">{presentation.detail}</p>
      </div>
    </div>
  );
}

export default function App() {
  const [graph, setGraph] = useState<AtlasGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emptyGraph, setEmptyGraph] = useState<EmptyGraphPresentation | null>(
    null
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [clusterMode, setClusterMode] = useState(false);

  // Canonical progressive exploration state (Overview → Area → Story)
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const [storyFocusId, setStoryFocusId] = useState<string | null>(null);
  const [storyViaId, setStoryViaId] = useState<string | null>(null);
  const [storyExpandedGroups, setStoryExpandedGroups] = useState<Set<string>>(
    () => new Set()
  );
  const [technicalInspectorOpen, setTechnicalInspectorOpen] = useState(false);
  const [selectedUnclusteredNodeId, setSelectedUnclusteredNodeId] = useState<
    string | null
  >(null);
  const [historyStack, setHistoryStack] = useState<NavigationSnapshot[]>([]);
  const [bridgeFocus, setBridgeFocus] = useState<BridgeFocusState | null>(null);

  const [expandedSubfolders, setExpandedSubfolders] = useState<Set<string>>(
    () => new Set()
  );
  const [showOverviewEdges, setShowOverviewEdges] = useState(false);
  const [showExternalHooks, setShowExternalHooks] = useState(false);
  const [fullyExpandedFolders, setFullyExpandedFolders] = useState<Set<string>>(
    () => new Set()
  );
  const [partialReveals, setPartialReveals] = useState<
    Map<string, Set<string>>
  >(() => new Map());
  const [helperLines, setHelperLines] = useState<HelperLine[]>([]);
  const [neighborhoodFocus, setNeighborhoodFocus] = useState(false);
  const [neighborhoodHops, setNeighborhoodHops] = useState(
    DEFAULT_NEIGHBORHOOD_HOPS
  );
  const [spotlightNodeId, setSpotlightNodeId] = useState<string | null>(null);
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>(() =>
    loadLayoutPreset()
  );
  const [edgeVisibility, setEdgeVisibility] = useState<EdgeVisibilityPrefs>(
    () => loadEdgeVisibility()
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<
    FlowNode<AtlasNodeData>
  >([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [renderedViewKey, setRenderedViewKey] = useState("");
  const [cameraCommand, setCameraCommand] = useState<CameraCommand | null>(
    null
  );

  const rfInstanceRef = useRef<ReactFlowInstance<
    FlowNode<AtlasNodeData>
  > | null>(null);
  const historyStackRef = useRef<NavigationSnapshot[]>([]);
  historyStackRef.current = historyStack;

  const cameraSeqRef = useRef(0);
  const buildSigRef = useRef<string>("");
  const buildingGenRef = useRef(0);
  const baseEdgesRef = useRef<Edge[]>([]);
  const savedNodePositionsRef =
    useRef<ReturnType<typeof loadNodePositions>>(null);
  const applySavedLayoutRef = useRef(true);
  const draggedNodeIdsRef = useRef<Set<string>>(new Set());
  const neighborhoodFocusTouchedRef = useRef(false);

  const queueCamera = useCallback(
    (
      spec:
        | { kind: "fit-readable"; duration?: number }
        | { kind: "fit-story"; duration?: number }
        | {
            kind: "fit-nodes";
            primaryNodeIds: string[];
            originNodeId?: string;
            duration?: number;
          }
        | { kind: "restore"; viewport: Viewport; duration?: number }
        | { kind: "ensure-node"; nodeId: string }
    ) => {
      const id = ++cameraSeqRef.current;
      setCameraCommand({ ...spec, id } as CameraCommand);
    },
    []
  );

  const handleCameraHandled = useCallback((id: number) => {
    setCameraCommand((current) => (current?.id === id ? null : current));
  }, []);

  const deferredSearch = useDeferredValue(search);
  const searchLower = deferredSearch.trim().toLowerCase();

  const canvasBaseGraph = useMemo(
    () => (graph ? filterExternalNodes(graph, showExternalHooks) : null),
    [graph, showExternalHooks]
  );

  const nodeById = useMemo(
    () => (graph ? buildNodeById(graph) : new Map<string, AtlasGraphNode>()),
    [graph]
  );

  const activeFocusNode = useMemo(() => {
    const id = storyFocusId ?? selectedUnclusteredNodeId;
    if (!id || !graph) return null;
    const base = nodeById.get(id);
    return base ? enrichNodeForDetails(base, graph, nodeById) : null;
  }, [storyFocusId, selectedUnclusteredNodeId, graph, nodeById]);

  const isLargeGraph =
    (canvasBaseGraph?.nodes.length ?? 0) > LARGE_GRAPH_THRESHOLD;
  const shouldVirtualize = nodes.length > VIRTUALIZE_THRESHOLD;
  const graphKey = graph ? graphSignature(graph) : "";
  const persistenceKey = scopeStorageKey(graphKey, activeDomain, storyFocusId);

  const isStoryView = Boolean(storyFocusId && !searchLower && canvasBaseGraph);
  const isOverviewMap =
    clusterMode &&
    !activeDomain &&
    !storyFocusId &&
    !searchLower &&
    fullyExpandedFolders.size === 0;
  const isAreaMapView = Boolean(
    activeDomain && !storyFocusId && !searchLower && canvasBaseGraph
  );

  useEffect(() => {
    if (!graph) return;
    neighborhoodFocusTouchedRef.current = false;
    setHistoryStack([]);
    const nonExternal = graph.nodes.filter((node) => node.file !== "external");
    const large = nonExternal.length > LARGE_GRAPH_THRESHOLD;
    const shouldCluster =
      nonExternal.length > CLUSTER_OVERVIEW_THRESHOLD &&
      groupNodesByFolder(nonExternal).size >= 2;
    setClusterMode(shouldCluster);
    setActiveDomain(null);
    setStoryFocusId(null);
    setStoryViaId(null);
    setStoryExpandedGroups(new Set());
    setTechnicalInspectorOpen(false);
    setSelectedUnclusteredNodeId(null);
    setBridgeFocus(null);
    setSelectedDomain(null);
    setHoveredNodeId(null);
    setExpandedSubfolders(new Set());
    setFullyExpandedFolders(new Set());
    setPartialReveals(new Map());
    setSpotlightNodeId(null);
    setNeighborhoodFocus(defaultNeighborhoodFocusEnabled(large));

    const overviewKey = scopeStorageKey(graphKey, null, null);
    const saved = overviewKey ? loadViewport(overviewKey) : null;
    if (saved && saved.zoom >= 0.5) {
      queueCamera({ kind: "restore", viewport: saved, duration: 0 });
    } else {
      queueCamera({ kind: "fit-readable", duration: 0 });
    }
  }, [graphKey, queueCamera]);

  const viewSelection = useMemo(() => {
    if (!canvasBaseGraph) {
      return {
        graph: { nodes: [], edges: [] } as AtlasGraph,
        mode: "full" as ViewGraphMode,
        matchCount: 0,
      };
    }
    return selectVisibleGraph(canvasBaseGraph, searchLower, isLargeGraph);
  }, [canvasBaseGraph, searchLower, isLargeGraph]);

  const effectivePartialReveals = useMemo(() => {
    if (!canvasBaseGraph || !searchLower || !isLargeGraph || !clusterMode) {
      return partialReveals;
    }
    return mergeSearchPartialReveals(
      canvasBaseGraph,
      searchLower,
      partialReveals
    );
  }, [canvasBaseGraph, searchLower, isLargeGraph, clusterMode, partialReveals]);

  const clusteredGraph = useMemo(() => {
    if (!canvasBaseGraph) return viewSelection.graph;
    if (activeDomain && !storyFocusId && !searchLower) {
      return buildDomainDrilldownGraph(
        canvasBaseGraph,
        activeDomain,
        expandedSubfolders
      );
    }
    return applyClusterView(
      viewSelection.graph,
      clusterMode,
      fullyExpandedFolders,
      effectivePartialReveals
    );
  }, [
    canvasBaseGraph,
    viewSelection.graph,
    activeDomain,
    storyFocusId,
    expandedSubfolders,
    searchLower,
    clusterMode,
    fullyExpandedFolders,
    effectivePartialReveals,
  ]);

  const isDenseDomain =
    !isOverviewMap &&
    !isStoryView &&
    clusteredGraph.nodes.length > DENSE_DOMAIN_EDGE_LABEL_THRESHOLD;

  const crossAreaLabels = useMemo(() => {
    const labels = new Map<string, string>();
    if (!canvasBaseGraph || !isOverviewMap) return labels;
    for (const edge of clusteredGraph.edges) {
      if (!isClusterId(edge.from) || !isClusterId(edge.to)) continue;
      const key = `${edge.from}|${edge.to}`;
      if (labels.has(key)) continue;
      const fromDomain = folderFromClusterId(edge.from);
      const toDomain = folderFromClusterId(edge.to);
      const exp = explainCrossAreaRelationship(
        fromDomain,
        toDomain,
        canvasBaseGraph,
        edgeVisibility
      );
      labels.set(key, exp.shortLabel);
    }
    return labels;
  }, [canvasBaseGraph, isOverviewMap, clusteredGraph.edges, edgeVisibility]);

  const partialRevealKey = [...effectivePartialReveals.entries()]
    .map(([folder, ids]) => `${folder}:${[...ids].sort().join(",")}`)
    .sort()
    .join("|");
  const expandedSubKey = [...expandedSubfolders].sort().join(",");
  const storyExpandedKey = [...storyExpandedGroups].sort().join(",");

  const viewKey = isStoryView
    ? `story:${storyFocusId}:${storyViaId ?? ""}:${storyExpandedKey}:${technicalInspectorOpen ? "insp" : ""}:${showExternalHooks}`
    : `${graphSignature(clusteredGraph)}:${searchLower}:${clusterMode}:${activeDomain ?? ""}:${expandedSubKey}:${showExternalHooks}:${[...fullyExpandedFolders].sort().join(",")}:${partialRevealKey}`;

  const entryIds = useMemo(
    () => (graph ? findEntryNodes(graph).map((node) => node.id) : []),
    [graph]
  );

  const pathIds = useMemo(() => {
    if (!activeFocusNode || !graph) return [] as string[];
    return findPathFromEntries(graph, activeFocusNode.id, entryIds);
  }, [activeFocusNode, graph, entryIds]);

  const connectedIds = useMemo(() => {
    if (!activeFocusNode || !graph) return null;
    return getConnectedNodeIdsFromEdges(activeFocusNode.id, graph.edges);
  }, [activeFocusNode, graph]);

  const pathEdges = useMemo(
    () =>
      graph && pathIds.length > 0
        ? pathEdgeKeys(pathIds, graph)
        : new Set<string>(),
    [graph, pathIds]
  );

  const nodeSpotlightIds = useMemo(() => {
    if (!spotlightNodeId || !graph || isStoryView) return null;
    return computeNodeSpotlightIds(
      spotlightNodeId,
      graph.nodes,
      clusteredGraph.nodes,
      graph.edges
    );
  }, [spotlightNodeId, graph, isStoryView, clusteredGraph.nodes]);

  const searchHighlightIds = useMemo(() => {
    if (!searchLower || !graph) return null;
    return computeSearchHighlightIds(
      graph,
      viewSelection.graph,
      searchLower,
      clusterMode,
      fullyExpandedFolders
    );
  }, [
    searchLower,
    graph,
    viewSelection.graph,
    clusterMode,
    fullyExpandedFolders,
  ]);

  const selectionHighlightIds = useMemo(() => {
    if (isStoryView) return null;
    return resolveHighlightIds(
      pathIds,
      selectedUnclusteredNodeId,
      graph?.edges ?? [],
      connectedIds,
      { neighborhoodFocus, neighborhoodHops }
    );
  }, [
    isStoryView,
    pathIds,
    selectedUnclusteredNodeId,
    graph?.edges,
    connectedIds,
    neighborhoodFocus,
    neighborhoodHops,
  ]);

  const activeBridgeFocus = useMemo(
    () =>
      !isStoryView && bridgeFocus && bridgeFocus.toDomain === activeDomain
        ? bridgeFocus
        : null,
    [isStoryView, bridgeFocus, activeDomain]
  );

  const bridgeHighlightIds = useMemo(() => {
    if (!activeBridgeFocus || activeBridgeFocus.targetNodeIds.length === 0) {
      return null;
    }
    return new Set<string>([
      activeBridgeFocus.originClusterId,
      ...activeBridgeFocus.targetNodeIds,
    ]);
  }, [activeBridgeFocus]);

  const overviewFocusClusterId = useMemo(() => {
    if (!isOverviewMap) return null;
    if (hoveredNodeId && isClusterId(hoveredNodeId)) return hoveredNodeId;
    if (selectedDomain) return clusterNodeId(selectedDomain);
    return null;
  }, [isOverviewMap, hoveredNodeId, selectedDomain]);

  const overviewFocusHighlightIds = useMemo(() => {
    if (!overviewFocusClusterId) return null;
    const ids = new Set<string>([overviewFocusClusterId]);
    for (const edge of clusteredGraph.edges) {
      if (!edgeVisibility[edge.type]) continue;
      if (edge.from === overviewFocusClusterId) ids.add(edge.to);
      if (edge.to === overviewFocusClusterId) ids.add(edge.from);
    }
    return ids;
  }, [overviewFocusClusterId, clusteredGraph.edges, edgeVisibility]);

  const highlightIds = useMemo(() => {
    if (isStoryView) return null;
    if (selectionHighlightIds && selectionHighlightIds.size > 0) {
      return selectionHighlightIds;
    }
    if (nodeSpotlightIds && nodeSpotlightIds.size > 0) {
      return nodeSpotlightIds;
    }
    if (bridgeHighlightIds && bridgeHighlightIds.size > 0) {
      return bridgeHighlightIds;
    }
    if (overviewFocusHighlightIds && overviewFocusHighlightIds.size > 0) {
      return overviewFocusHighlightIds;
    }
    if (searchHighlightIds && searchHighlightIds.size > 0) {
      return searchHighlightIds;
    }
    return selectionHighlightIds;
  }, [
    isStoryView,
    selectionHighlightIds,
    nodeSpotlightIds,
    bridgeHighlightIds,
    overviewFocusHighlightIds,
    searchHighlightIds,
  ]);

  const shouldHighlightEdges =
    !isStoryView &&
    (Boolean(selectedUnclusteredNodeId) ||
      Boolean(spotlightNodeId) ||
      Boolean(bridgeHighlightIds) ||
      Boolean(overviewFocusHighlightIds) ||
      Boolean(searchLower && searchHighlightIds && searchHighlightIds.size > 0));

  const selectedCanvasNodeId = useMemo(() => {
    if (storyFocusId) return storyFocusId;
    if (selectedUnclusteredNodeId) return selectedUnclusteredNodeId;
    if (selectedDomain) return clusterNodeId(selectedDomain);
    return null;
  }, [storyFocusId, selectedUnclusteredNodeId, selectedDomain]);

  // Single-source-of-truth Breadcrumb Trail derived from historyStack + current state
  const trailItems = useMemo<BreadcrumbTrailItem[]>(() => {
    const items: BreadcrumbTrailItem[] = [];
    const seenKeys = new Set<string>();

    const pushItem = (item: BreadcrumbTrailItem) => {
      if (seenKeys.has(item.scopeKey)) return;
      seenKeys.add(item.scopeKey);
      items.push(item);
    };

    const isAtOverviewRoot =
      !activeDomain &&
      !storyFocusId &&
      !selectedDomain &&
      !selectedUnclusteredNodeId;

    pushItem({
      scopeKey: "overview",
      label: "Overview",
      isCurrent: isAtOverviewRoot,
    });

    for (const snap of historyStack) {
      if (snap.scopeKey === "overview") continue;
      pushItem({
        scopeKey: snap.scopeKey,
        label: snap.crumbLabel,
        sublabel: snap.crumbSublabel,
        isCurrent: false,
      });
    }

    if (storyFocusId) {
      const focusNode = nodeById.get(storyFocusId);
      const focusDom =
        focusNode && focusNode.file !== "external"
          ? folderKey(focusNode.file)
          : activeDomain;
      if (focusDom) {
        const areaKey = `area:${focusDom}`;
        if (!seenKeys.has(areaKey)) {
          // Ensure home area appears in trail when jumping directly from Overview into a Story
          const prevWasDifferentArea = historyStack.some(
            (s) => s.activeDomain && s.activeDomain !== focusDom
          );
          if (!prevWasDifferentArea) {
            pushItem({
              scopeKey: areaKey,
              label: humanizeAreaIdentity(focusDom).title,
              isCurrent: false,
            });
          }
        }
      }
      if (focusNode) {
        const prevSnap = historyStack[historyStack.length - 1];
        const crossedArea =
          prevSnap?.activeDomain &&
          focusDom &&
          prevSnap.activeDomain !== focusDom;
        pushItem({
          scopeKey: `story:${focusNode.id}`,
          label: focusNode.name,
          sublabel: crossedArea
            ? humanizeAreaIdentity(focusDom).title
            : undefined,
          isCurrent: true,
        });
      }
    } else if (activeDomain) {
      pushItem({
        scopeKey: `area:${activeDomain}`,
        label: humanizeAreaIdentity(activeDomain).title,
        isCurrent: !selectedUnclusteredNodeId,
      });
      if (selectedUnclusteredNodeId) {
        const n = nodeById.get(selectedUnclusteredNodeId);
        if (n) {
          pushItem({
            scopeKey: `node:${n.id}`,
            label: n.name,
            isCurrent: true,
          });
        }
      }
    } else if (selectedDomain) {
      pushItem({
        scopeKey: `preview:${selectedDomain}`,
        label: humanizeAreaIdentity(selectedDomain).title,
        isCurrent: true,
      });
    } else if (selectedUnclusteredNodeId) {
      const n = nodeById.get(selectedUnclusteredNodeId);
      if (n) {
        pushItem({
          scopeKey: `node:${n.id}`,
          label: n.name,
          isCurrent: true,
        });
      }
    }

    // Keep last 5 crumbs if a user walks 10+ steps deep so header stays compact
    if (items.length > 6) {
      return [items[0]!, ...items.slice(items.length - 4)];
    }
    return items;
  }, [
    historyStack,
    activeDomain,
    storyFocusId,
    selectedDomain,
    selectedUnclusteredNodeId,
    nodeById,
  ]);

  const overviewEntries = useMemo(
    () => (graph ? computeEntryPoints(graph) : []),
    [graph]
  );

  const overviewFolders = useMemo(
    () =>
      canvasBaseGraph
        ? computeTopFolders(canvasBaseGraph, OVERVIEW_TOP_FOLDERS)
        : [],
    [canvasBaseGraph]
  );

  const overviewHubs = useMemo(
    () =>
      canvasBaseGraph
        ? computeHubNodes(canvasBaseGraph, OVERVIEW_HUB_NODES)
        : [],
    [canvasBaseGraph]
  );

  const primaryEntry = useMemo(() => {
    const first = overviewEntries[0];
    if (!first) return null;
    return {
      name: first.node.name,
      fileLabel: formatRelativePath(first.file, graph?.meta?.targetDir),
    };
  }, [overviewEntries, graph?.meta?.targetDir]);

  const loadGraph = useCallback(async () => {
    try {
      const res = await fetch(`/graph.json?_=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok)
        throw new Error("graph.json not found. Run `pnpm analyze` first.");
      const data: unknown = await res.json();
      const validated = validateGraphData(data);
      if (!validated.ok) {
        setGraph(null);
        setEmptyGraph(emptyGraphPresentation(validated.detail));
        setError(null);
        return;
      }
      setGraph(validated.graph);
      setEmptyGraph(null);
      setError(null);
    } catch (err) {
      setGraph(null);
      setEmptyGraph(null);
      setError(
        err instanceof Error ? err.message : "Failed to load graph.json"
      );
    }
  }, []);

  useEffect(() => {
    savedNodePositionsRef.current = graphKey
      ? loadNodePositions(graphKey)
      : null;
    applySavedLayoutRef.current = true;
    draggedNodeIdsRef.current = new Set();
  }, [graphKey]);

  useEffect(() => {
    void loadGraph();
    const pollMs = isLargeGraph ? GRAPH_POLL_MS_LARGE : GRAPH_POLL_MS;
    const interval = window.setInterval(loadGraph, pollMs);
    return () => window.clearInterval(interval);
  }, [loadGraph, isLargeGraph]);

  // Build & layout effect (Story View, Overview 4-Tier Map, or Domain/Full Dagre)
  useEffect(() => {
    if (!graph || !canvasBaseGraph) return;
    if (buildSigRef.current === viewKey) return;

    let cancelled = false;
    const buildingGen = ++buildingGenRef.current;
    setIsBuilding(true);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          if (isStoryView && storyFocusId) {
            const storyBuilt = buildFeatureStoryView(
              canvasBaseGraph,
              storyFocusId,
              storyExpandedGroups,
              {
                viaNodeId: storyViaId,
                inspectorOpen: technicalInspectorOpen,
              }
            );
            if (cancelled || !storyBuilt) return;

            buildSigRef.current = viewKey;
            baseEdgesRef.current = storyBuilt.edges;
            setNodes(storyBuilt.nodes);
            setEdges(storyBuilt.edges);
            setRenderedViewKey(viewKey);
            return;
          }

          const built = buildFlowGraph(clusteredGraph, {
            compact: isLargeGraph && !activeDomain && !isOverviewMap,
            entryIds,
            skipLayout: true,
          });

          const positionedNodes = isOverviewMap
            ? layoutTieredOverviewNodes(built.nodes)
            : spreadCoincidentNodes(
                mergeNodePositions(
                  await layoutFlowGraphNodesAsync(
                    clusteredGraph,
                    built.nodes,
                    built.edges,
                    entryIds
                  ),
                  [],
                  applySavedLayoutRef.current
                    ? savedNodePositionsRef.current
                    : null,
                  draggedNodeIdsRef.current
                )
              );

          if (cancelled) return;

          buildSigRef.current = viewKey;
          baseEdgesRef.current = built.edges;
          applySavedLayoutRef.current = false;

          setNodes(
            patchNodePresentation(
              positionedNodes,
              searchLower,
              selectedCanvasNodeId,
              highlightIds,
              activeBridgeFocus
            )
          );
          setEdges(
            presentEdges(
              built.edges,
              edgeVisibility,
              highlightIds,
              pathEdges,
              shouldHighlightEdges,
              {
                isStoryView: false,
                isOverviewMap,
                showOverviewEdges,
                focusClusterId: overviewFocusClusterId,
                crossAreaLabels,
                isDenseDomain,
                hoveredNodeId,
              }
            )
          );
          setRenderedViewKey(viewKey);
        } catch (err) {
          if (cancelled || err instanceof LayoutCancelledError) return;
          console.error("Failed to layout graph view", err);
        } finally {
          if (!cancelled && buildingGen === buildingGenRef.current) {
            setIsBuilding(false);
          }
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    graph,
    canvasBaseGraph,
    clusteredGraph,
    viewKey,
    isStoryView,
    storyFocusId,
    storyViaId,
    storyExpandedGroups,
    technicalInspectorOpen,
    isLargeGraph,
    isOverviewMap,
    isDenseDomain,
    activeDomain,
    entryIds,
    searchLower,
    selectedCanvasNodeId,
    highlightIds,
    activeBridgeFocus,
    edgeVisibility,
    pathEdges,
    shouldHighlightEdges,
    showOverviewEdges,
    overviewFocusClusterId,
    crossAreaLabels,
    hoveredNodeId,
    setNodes,
    setEdges,
  ]);

  useEffect(() => {
    if (isStoryView) return;
    setNodes((current) =>
      patchNodePresentation(
        current,
        searchLower,
        selectedCanvasNodeId,
        highlightIds,
        activeBridgeFocus
      )
    );
    setEdges((current) =>
      presentEdges(
        baseEdgesRef.current.length > 0 ? baseEdgesRef.current : current,
        edgeVisibility,
        highlightIds,
        pathEdges,
        shouldHighlightEdges,
        {
          isStoryView: false,
          isOverviewMap,
          showOverviewEdges,
          focusClusterId: overviewFocusClusterId,
          crossAreaLabels,
          isDenseDomain,
          hoveredNodeId,
        }
      )
    );
  }, [
    isStoryView,
    searchLower,
    selectedCanvasNodeId,
    highlightIds,
    activeBridgeFocus,
    pathEdges,
    shouldHighlightEdges,
    edgeVisibility,
    isOverviewMap,
    isDenseDomain,
    showOverviewEdges,
    overviewFocusClusterId,
    crossAreaLabels,
    hoveredNodeId,
    setNodes,
    setEdges,
  ]);

  const captureCurrentSnapshot = useCallback((): NavigationSnapshot | null => {
    const inst = rfInstanceRef.current;
    if (!inst) return null;

    if (storyFocusId) {
      const n = nodeById.get(storyFocusId);
      return {
        scopeKey: `story:${storyFocusId}`,
        crumbLabel: n?.name ?? "Feature",
        activeDomain,
        storyFocusId,
        storyViaId,
        bridgeFocus,
        expandedSubfolders: [...expandedSubfolders],
        storyExpandedGroups: [...storyExpandedGroups],
        viewport: inst.getViewport(),
      };
    }

    if (activeDomain) {
      return {
        scopeKey: `area:${activeDomain}`,
        crumbLabel: humanizeAreaIdentity(activeDomain).title,
        activeDomain,
        storyFocusId: null,
        storyViaId: null,
        bridgeFocus,
        expandedSubfolders: [...expandedSubfolders],
        storyExpandedGroups: [],
        viewport: inst.getViewport(),
      };
    }

    return {
      scopeKey: "overview",
      crumbLabel: "Overview",
      activeDomain: null,
      storyFocusId: null,
      storyViaId: null,
      bridgeFocus: null,
      expandedSubfolders: [],
      storyExpandedGroups: [],
      viewport: inst.getViewport(),
    };
  }, [
    storyFocusId,
    storyViaId,
    activeDomain,
    bridgeFocus,
    expandedSubfolders,
    storyExpandedGroups,
    nodeById,
  ]);

  const pushSnapshot = useCallback(
    (snap: NavigationSnapshot | null) => {
      if (!snap) return;
      setHistoryStack((prev) => {
        const copy = [...prev];
        const top = copy[copy.length - 1];
        if (top && top.scopeKey === snap.scopeKey) {
          copy[copy.length - 1] = snap;
          return copy;
        }
        copy.push(snap);
        return copy.length > 20 ? copy.slice(copy.length - 20) : copy;
      });
    },
    []
  );

  const restoreSnapshot = useCallback(
    (snap: NavigationSnapshot) => {
      setActiveDomain(snap.activeDomain);
      setStoryFocusId(snap.storyFocusId);
      setStoryViaId(snap.storyViaId);
      setBridgeFocus(snap.bridgeFocus);
      setExpandedSubfolders(new Set(snap.expandedSubfolders));
      setStoryExpandedGroups(new Set(snap.storyExpandedGroups));
      setSearch("");
      setSelectedDomain(null);
      setSelectedUnclusteredNodeId(null);
      setHoveredNodeId(null);
      setSpotlightNodeId(null);
      if (!snap.storyFocusId) {
        setTechnicalInspectorOpen(false);
      }
      queueCamera({ kind: "restore", viewport: snap.viewport, duration: 240 });
    },
    [queueCamera]
  );

  const unwindToOverview = useCallback(() => {
    const stack = historyStackRef.current;
    const overviewSnap = stack.find((s) => s.scopeKey === "overview") ?? null;
    setHistoryStack([]);
    setActiveDomain(null);
    setStoryFocusId(null);
    setStoryViaId(null);
    setStoryExpandedGroups(new Set());
    setTechnicalInspectorOpen(false);
    setSelectedUnclusteredNodeId(null);
    setBridgeFocus(null);
    setExpandedSubfolders(new Set());
    setSearch("");
    setSelectedDomain(null);
    setHoveredNodeId(null);
    setSpotlightNodeId(null);
    setFullyExpandedFolders(new Set());
    setPartialReveals(new Map());

    if (overviewSnap) {
      queueCamera({
        kind: "restore",
        viewport: overviewSnap.viewport,
        duration: 240,
      });
    } else {
      queueCamera({ kind: "fit-readable", duration: 220 });
    }
  }, [queueCamera]);

  const stepBackOne = useCallback(() => {
    if (searchLower && !activeDomain && !storyFocusId) {
      setSearch("");
      return;
    }

    const stack = historyStackRef.current;
    if (stack.length === 0) {
      unwindToOverview();
      return;
    }

    const target = stack[stack.length - 1]!;
    setHistoryStack(stack.slice(0, -1));
    restoreSnapshot(target);
  }, [searchLower, activeDomain, storyFocusId, unwindToOverview, restoreSnapshot]);

  const selectTrailItem = useCallback(
    (targetScopeKey: string) => {
      if (targetScopeKey === "overview") {
        unwindToOverview();
        return;
      }

      const stack = historyStackRef.current;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]!.scopeKey === targetScopeKey) {
          const snap = stack[i]!;
          setHistoryStack(stack.slice(0, i));
          restoreSnapshot(snap);
          return;
        }
      }

      // Synthetic area crumb when user jumped directly from Overview into a Feature Story
      if (targetScopeKey.startsWith("area:")) {
        const domain = targetScopeKey.slice("area:".length);
        setActiveDomain(domain);
        setStoryFocusId(null);
        setStoryViaId(null);
        setStoryExpandedGroups(new Set());
        setTechnicalInspectorOpen(false);
        setSelectedDomain(null);
        setSelectedUnclusteredNodeId(null);
        queueCamera({ kind: "fit-readable", duration: 220 });
      }
    },
    [unwindToOverview, restoreSnapshot, queueCamera]
  );

  /**
   * Enter Focused Feature Story for `node` (works from Overview, Area Map, Sidebar,
   * Command Palette, Insights, or when walking parent ↔ child inside Story View).
   */
  const focusSymbolStory = useCallback(
    (node: AtlasGraphNode) => {
      if (!graph) return;
      if (storyFocusId === node.id && !searchLower) return;

      if (node.file === "external" && !showExternalHooks) {
        setShowExternalHooks(true);
      }

      const existingIdx = historyStackRef.current.findIndex(
        (s) => s.scopeKey === `story:${node.id}`
      );
      if (existingIdx >= 0) {
        const snap = historyStackRef.current[existingIdx]!;
        setHistoryStack(historyStackRef.current.slice(0, existingIdx));
        restoreSnapshot(snap);
        return;
      }

      pushSnapshot(captureCurrentSnapshot());

      const nextDomain =
        node.file === "external" ? activeDomain : folderKey(node.file);
      setStoryViaId(storyFocusId);
      setStoryFocusId(node.id);
      setStoryExpandedGroups(new Set());
      setActiveDomain(nextDomain);
      setBridgeFocus(null);
      setSearch("");
      setSelectedDomain(null);
      setSelectedUnclusteredNodeId(null);
      setHoveredNodeId(null);
      setSpotlightNodeId(null);

      queueCamera({ kind: "fit-story", duration: 220 });
    },
    [
      graph,
      storyFocusId,
      searchLower,
      showExternalHooks,
      activeDomain,
      restoreSnapshot,
      pushSnapshot,
      captureCurrentSnapshot,
      queueCamera,
    ]
  );

  const openRootDomain = useCallback(
    (domain: string) => {
      if (domain === activeDomain && !storyFocusId && !searchLower) {
        setSelectedDomain(null);
        setBridgeFocus(null);
        return;
      }

      if (!activeDomain && !storyFocusId) {
        pushSnapshot(captureCurrentSnapshot());
      } else {
        const overviewEntry = historyStackRef.current.find(
          (item) => item.scopeKey === "overview"
        );
        const inst = rfInstanceRef.current;
        setHistoryStack(
          overviewEntry
            ? [overviewEntry]
            : inst
              ? [
                  {
                    scopeKey: "overview",
                    crumbLabel: "Overview",
                    activeDomain: null,
                    storyFocusId: null,
                    storyViaId: null,
                    bridgeFocus: null,
                    expandedSubfolders: [],
                    storyExpandedGroups: [],
                    viewport: inst.getViewport(),
                  },
                ]
              : []
        );
      }

      setActiveDomain(domain);
      setStoryFocusId(null);
      setStoryViaId(null);
      setStoryExpandedGroups(new Set());
      setTechnicalInspectorOpen(false);
      setSelectedUnclusteredNodeId(null);
      setBridgeFocus(null);
      setExpandedSubfolders(new Set());
      setClusterMode(true);
      setSearch("");
      setSelectedDomain(null);
      setHoveredNodeId(null);
      setSpotlightNodeId(null);
      queueCamera({ kind: "fit-readable", duration: 220 });
    },
    [
      activeDomain,
      storyFocusId,
      searchLower,
      pushSnapshot,
      captureCurrentSnapshot,
      queueCamera,
    ]
  );

  const switchDomain = useCallback(
    (targetDomain: string) => {
      if (!activeDomain || !canvasBaseGraph) {
        openRootDomain(targetDomain);
        return;
      }

      const existingKey = `area:${targetDomain}`;
      const existingIdx = historyStackRef.current.findIndex(
        (s) => s.scopeKey === existingKey
      );
      if (existingIdx >= 0) {
        selectTrailItem(existingKey);
        return;
      }

      const fromDomain = activeDomain;
      const bridge = findDomainBridgeNodes(
        canvasBaseGraph,
        fromDomain,
        targetDomain
      );

      pushSnapshot(captureCurrentSnapshot());

      setActiveDomain(targetDomain);
      setStoryFocusId(null);
      setStoryViaId(null);
      setStoryExpandedGroups(new Set());
      setTechnicalInspectorOpen(false);
      setSelectedUnclusteredNodeId(null);
      setExpandedSubfolders(new Set(bridge.requiredSubfolders));
      setClusterMode(true);
      setSearch("");
      setSelectedDomain(null);
      setHoveredNodeId(null);
      setSpotlightNodeId(null);

      if (bridge.targetNodeIds.length > 0) {
        setBridgeFocus({
          fromDomain,
          toDomain: targetDomain,
          targetNodeIds: bridge.targetNodeIds,
          originClusterId: bridge.originClusterId,
        });
        queueCamera({
          kind: "fit-nodes",
          primaryNodeIds: bridge.targetNodeIds,
          originNodeId: bridge.originClusterId,
          duration: 240,
        });
      } else {
        setBridgeFocus(null);
        queueCamera({ kind: "fit-readable", duration: 220 });
      }
    },
    [
      activeDomain,
      canvasBaseGraph,
      openRootDomain,
      selectTrailItem,
      pushSnapshot,
      captureCurrentSnapshot,
      queueCamera,
    ]
  );

  const expandSubcluster = useCallback((subKey: string) => {
    setExpandedSubfolders((prev) => {
      const next = new Set(prev);
      next.add(subKey);
      return next;
    });
    setHoveredNodeId(null);
  }, []);

  const toggleStoryGroup = useCallback(
    (groupKey: string) => {
      setStoryExpandedGroups((prev) => {
        const next = new Set(prev);
        if (next.has(groupKey)) {
          next.delete(groupKey);
        } else {
          next.add(groupKey);
        }
        return next;
      });
      queueCamera({ kind: "fit-story", duration: 200 });
    },
    [queueCamera]
  );

  useEffect(() => {
    const onOpenCluster = (event: Event) => {
      const folder = (event as CustomEvent<string>).detail;
      if (!folder) return;
      if (activeDomain && !storyFocusId && folder.startsWith(`${activeDomain}/`)) {
        expandSubcluster(folder);
        return;
      }
      if (activeDomain && !storyFocusId) {
        switchDomain(folder);
        return;
      }
      openRootDomain(folder);
    };

    const onStoryGroupToggle = (event: Event) => {
      const groupKey = (event as CustomEvent<string>).detail;
      if (groupKey) toggleStoryGroup(groupKey);
    };

    const onToggleInspector = () => {
      setTechnicalInspectorOpen((open) => !open);
    };

    const onOpenStoryAreaMap = (event: Event) => {
      const domain = (event as CustomEvent<string>).detail;
      if (!domain) return;
      pushSnapshot(captureCurrentSnapshot());
      setActiveDomain(domain);
      setStoryFocusId(null);
      setStoryViaId(null);
      setStoryExpandedGroups(new Set());
      setTechnicalInspectorOpen(false);
      queueCamera({ kind: "fit-readable", duration: 220 });
    };

    window.addEventListener(OPEN_CLUSTER_EVENT, onOpenCluster);
    window.addEventListener(STORY_GROUP_TOGGLE_EVENT, onStoryGroupToggle);
    window.addEventListener(STORY_INSPECT_CODE_EVENT, onToggleInspector);
    window.addEventListener(STORY_OPEN_AREA_MAP_EVENT, onOpenStoryAreaMap);

    return () => {
      window.removeEventListener(OPEN_CLUSTER_EVENT, onOpenCluster);
      window.removeEventListener(STORY_GROUP_TOGGLE_EVENT, onStoryGroupToggle);
      window.removeEventListener(STORY_INSPECT_CODE_EVENT, onToggleInspector);
      window.removeEventListener(STORY_OPEN_AREA_MAP_EVENT, onOpenStoryAreaMap);
    };
  }, [
    activeDomain,
    storyFocusId,
    expandSubcluster,
    switchDomain,
    openRootDomain,
    toggleStoryGroup,
    pushSnapshot,
    captureCurrentSnapshot,
    queueCamera,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]')) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        if (search) {
          setSearch("");
          target.blur();
        }
        return;
      }

      if (technicalInspectorOpen) {
        event.preventDefault();
        setTechnicalInspectorOpen(false);
        return;
      }

      if (storyFocusId || activeDomain) {
        event.preventDefault();
        stepBackOne();
        return;
      }

      if (search) {
        event.preventDefault();
        setSearch("");
        return;
      }

      if (
        selectedDomain ||
        selectedUnclusteredNodeId ||
        spotlightNodeId ||
        bridgeFocus
      ) {
        event.preventDefault();
        setSelectedDomain(null);
        setSelectedUnclusteredNodeId(null);
        setSpotlightNodeId(null);
        setBridgeFocus(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    technicalInspectorOpen,
    storyFocusId,
    activeDomain,
    search,
    selectedDomain,
    selectedUnclusteredNodeId,
    spotlightNodeId,
    bridgeFocus,
    stepBackOne,
  ]);

  const onSelectConnectionById = useCallback(
    (targetId: string) => {
      const target = nodeById.get(targetId);
      if (target) {
        focusSymbolStory(target);
      }
    },
    [nodeById, focusSymbolStory]
  );

  const onInsightClick = useCallback(
    (insight: GraphInsight) => {
      if (!graph) return;
      const match = findNodeForInsight(insight, graph.nodes);
      if (!match) return;
      setTechnicalInspectorOpen(true);
      focusSymbolStory(match);
    },
    [graph, focusSymbolStory]
  );

  const onOverviewFolderClick = useCallback(
    (folder: FolderOverview) => {
      if (activeDomain === folder.folder && !storyFocusId) {
        unwindToOverview();
        return;
      }
      openRootDomain(folder.folder);
    },
    [activeDomain, storyFocusId, unwindToOverview, openRootDomain]
  );

  const onNodeClick = useCallback(
    (_event: MouseEvent, node: FlowNode<AtlasNodeData>) => {
      if (node.type === "tierHeader" || node.type === "storyHeader") return;

      if (node.type === "storyAnchor") {
        return;
      }

      if (node.type === "storyGroup") {
        const groupData = node.data as unknown as StoryGroupNodeData;
        toggleStoryGroup(groupData.groupKey);
        return;
      }

      if (node.type === "storyCard") {
        const cardData = node.data as unknown as StoryCardNodeData;
        const target = nodeById.get(cardData.nodeId);
        if (target) {
          focusSymbolStory(target);
        }
        return;
      }

      if (isClusterId(node.id)) {
        const folder = folderFromClusterId(node.id);
        const clusterData = node.data as unknown as ClusterNodeData;

        if (clusterData.isSubcluster) {
          expandSubcluster(folder);
          return;
        }

        // Single-clicking an Area card previews its plain-language summary in place (0 camera jump)
        setSelectedUnclusteredNodeId(null);
        setSpotlightNodeId(null);
        setSelectedDomain((prev) => (prev === folder ? null : folder));
        return;
      }

      if (!graph) return;
      const base = nodeById.get(node.data.nodeId ?? node.id);
      if (!base) return;

      // In clustered / Area exploration, clicking a symbol transitions into its Focused Feature Story!
      if (clusterMode && !searchLower) {
        focusSymbolStory(base);
        return;
      }

      // In flat unclustered/search mode, inspect with optional inspector
      setSelectedDomain(null);
      setSelectedUnclusteredNodeId(base.id);
      setTechnicalInspectorOpen(true);
    },
    [
      graph,
      nodeById,
      clusterMode,
      searchLower,
      toggleStoryGroup,
      focusSymbolStory,
      expandSubcluster,
    ]
  );

  const onNodeDoubleClick = useCallback(
    (_event: MouseEvent, node: FlowNode<AtlasNodeData>) => {
      if (!isClusterId(node.id)) return;
      const folder = folderFromClusterId(node.id);
      const clusterData = node.data as unknown as ClusterNodeData;
      if (clusterData.isSubcluster) {
        expandSubcluster(folder);
        return;
      }
      if (activeDomain && !storyFocusId) {
        switchDomain(folder);
        return;
      }
      openRootDomain(folder);
    },
    [activeDomain, storyFocusId, expandSubcluster, switchDomain, openRootDomain]
  );

  const onNodeMouseEnter = useCallback(
    (_event: MouseEvent, node: FlowNode<AtlasNodeData>) => {
      if (node.type === "tierHeader" || node.type === "storyHeader") return;
      setHoveredNodeId(node.id);
    },
    []
  );

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const onNeighborhoodFocusChange = useCallback((enabled: boolean) => {
    neighborhoodFocusTouchedRef.current = true;
    setNeighborhoodFocus(enabled);
  }, []);

  const onPaneClick = useCallback(() => {
    if (!isStoryView) {
      setSelectedDomain(null);
      setSelectedUnclusteredNodeId(null);
      setSpotlightNodeId(null);
      setBridgeFocus(null);
    }
    setHelperLines([]);
  }, [isStoryView]);

  const onNodeDrag: OnNodeDrag<FlowNode<AtlasNodeData>> = useCallback(
    (_event, dragged) => {
      if (dragged.type === "tierHeader" || isStoryView) return;
      const { lines } = computeHelperLines(dragged, nodes);
      setHelperLines(lines);
    },
    [nodes, isStoryView]
  );

  const onNodeDragStop: OnNodeDrag<FlowNode<AtlasNodeData>> = useCallback(
    (_event, dragged) => {
      if (dragged.type === "tierHeader" || isStoryView) return;
      draggedNodeIdsRef.current.add(dragged.id);
      setNodes((current) => {
        const { snapX, snapY } = computeHelperLines(dragged, current);
        const next =
          snapX === undefined && snapY === undefined
            ? current
            : current.map((node) =>
                node.id === dragged.id
                  ? {
                      ...node,
                      position: {
                        x: snapX ?? node.position.x,
                        y: snapY ?? node.position.y,
                      },
                    }
                  : node
              );

        if (graphKey && !isOverviewMap) {
          saveNodePositions(graphKey, nodePositionsFromNodes(next));
        }

        return next;
      });
      setHelperLines([]);
    },
    [setNodes, graphKey, isOverviewMap, isStoryView]
  );

  const showFromEntry = useCallback(() => {
    if (!graph) return;
    const entries = findEntryNodes(graph);
    if (entries.length === 0) return;
    focusSymbolStory(entries[0]!);
  }, [graph, focusSymbolStory]);

  const applyLayout = useCallback(
    (preset: LayoutPreset) => {
      setLayoutPreset(preset);
      saveLayoutPreset(preset);

      if (isOverviewMap || isStoryView) {
        queueCamera({
          kind: isStoryView ? "fit-story" : "fit-readable",
          duration: 220,
        });
        return;
      }

      if (preset === "dagre-tb" && nodes.length > 25) {
        setEdgeVisibility((prev) => {
          const next = { imports: false, renders: true, uses: false };
          if (
            prev.imports === next.imports &&
            prev.renders === next.renders &&
            prev.uses === next.uses
          ) {
            return prev;
          }
          saveEdgeVisibility(next);
          return next;
        });
      }

      const snapshot = nodes.filter((n) => n.type !== "tierHeader");
      const edgesSnapshot = baseEdgesRef.current;
      const buildingGen = ++buildingGenRef.current;
      setIsBuilding(true);

      void (async () => {
        try {
          const layouted = await relayoutFlowNodesAsync(
            snapshot,
            edgesSnapshot,
            {
              mode: preset,
              entryIds,
              graph: graph ?? undefined,
            }
          );
          if (buildingGen !== buildingGenRef.current) return;
          setNodes(layouted);
          queueCamera({ kind: "fit-readable", duration: 220 });
        } catch (err) {
          if (err instanceof LayoutCancelledError) return;
          console.error("Failed to apply layout", err);
        } finally {
          if (buildingGen === buildingGenRef.current) {
            setIsBuilding(false);
          }
        }
      })();
    },
    [
      isOverviewMap,
      isStoryView,
      nodes,
      entryIds,
      graph,
      setNodes,
      queueCamera,
    ]
  );

  const cycleLayout = useCallback(() => {
    applyLayout(nextLayoutPreset(layoutPreset));
  }, [applyLayout, layoutPreset]);

  const onEdgeVisibilityChange = useCallback(
    (type: keyof EdgeVisibilityPrefs, visible: boolean) => {
      setEdgeVisibility((prev) => {
        const next = setEdgeTypeVisible(prev, type, visible);
        saveEdgeVisibility(next);
        return next;
      });
    },
    []
  );

  const showAllEdges = useCallback(() => {
    const next = { ...DEFAULT_EDGE_VISIBILITY };
    setEdgeVisibility(next);
    saveEdgeVisibility(next);
  }, []);

  const copyText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore clipboard failures
    }
  }, []);

  const commandPaletteState = useMemo(
    () => ({
      nodes: graph?.nodes ?? [],
      clusterMode,
      neighborhoodFocus,
      layoutPreset,
      layoutDisabled: nodes.length === 0 || isOverviewMap || isStoryView,
      selected: activeFocusNode,
      hasEntryNodes: graph ? findEntryNodes(graph).length > 0 : false,
      edgeVisibility,
    }),
    [
      graph,
      clusterMode,
      neighborhoodFocus,
      nodes.length,
      isOverviewMap,
      isStoryView,
      activeFocusNode,
      layoutPreset,
      edgeVisibility,
    ]
  );

  const commandPaletteActions = useMemo<CommandPaletteActions>(
    () => ({
      onJumpToNode: focusSymbolStory,
      onShowFromEntry: showFromEntry,
      onApplyLayout: applyLayout,
      onCycleLayout: cycleLayout,
      onToggleClusterMode: () => {
        setHistoryStack([]);
        setActiveDomain(null);
        setStoryFocusId(null);
        setStoryViaId(null);
        setBridgeFocus(null);
        setSelectedDomain(null);
        setExpandedSubfolders(new Set());
        setClusterMode((enabled) => {
          const next = !enabled;
          if (!next) {
            setFullyExpandedFolders(new Set());
            setPartialReveals(new Map());
          }
          return next;
        });
        queueCamera({ kind: "fit-readable", duration: 220 });
      },
      onToggleNeighborhoodFocus: () => {
        neighborhoodFocusTouchedRef.current = true;
        setNeighborhoodFocus((enabled) => !enabled);
      },
      onFitView: () => triggerFitView(),
      onExportPng: () => {
        void triggerExport("png");
      },
      onExportSvg: () => {
        void triggerExport("svg");
      },
      onFocusSelected: () => {
        if (!activeFocusNode) return;
        queueCamera({ kind: "ensure-node", nodeId: activeFocusNode.id });
      },
      onCopySelectedName: () => {
        if (activeFocusNode?.name) void copyText(activeFocusNode.name);
      },
      onCopySelectedPath: () => {
        if (activeFocusNode?.file && activeFocusNode.file !== "external") {
          void copyText(activeFocusNode.file);
        }
      },
      onHideEdgeType: (type) => {
        onEdgeVisibilityChange(type, false);
      },
      onShowAllEdges: showAllEdges,
    }),
    [
      focusSymbolStory,
      showFromEntry,
      applyLayout,
      cycleLayout,
      activeFocusNode,
      copyText,
      onEdgeVisibilityChange,
      showAllEdges,
      queueCamera,
    ]
  );

  if (error) {
    return (
      <div className="graph-shell graph-shell--empty">
        <div className="graph-panel">
          <p className="graph-panel__eyebrow">Arclens</p>
          <h1>Could not load graph</h1>
          <p className="graph-error">{error}</p>
        </div>
      </div>
    );
  }

  if (emptyGraph) {
    return <EmptyGraphPanel presentation={emptyGraph} />;
  }

  if (!graph) {
    return (
      <div className="graph-shell graph-shell--empty">
        <div className="graph-panel">
          <p className="graph-panel__eyebrow">Arclens</p>
          <h1>Loading graph…</h1>
        </div>
      </div>
    );
  }

  const layoutReady = !isBuilding && renderedViewKey === viewKey;
  const showTechnicalDetails = Boolean(
    activeFocusNode && !activeFocusNode.cluster && technicalInspectorOpen
  );
  const showAreaSummary = Boolean(
    !showTechnicalDetails && !isStoryView && selectedDomain
  );
  const showRightRail = showTechnicalDetails || showAreaSummary;
  const canStepBack = Boolean(activeDomain || storyFocusId || searchLower);

  return (
    <div className="graph-shell graph-shell--docked">
      <MobileBanner />
      <CommandPalette
        state={commandPaletteState}
        actions={commandPaletteActions}
      />

      <ViewerHeader
        projectName={graph.meta?.projectName}
        totalNodes={canvasBaseGraph?.nodes.length ?? graph.nodes.length}
        totalEdges={canvasBaseGraph?.edges.length ?? graph.edges.length}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        isBuilding={isBuilding}
        canStepBack={canStepBack}
        trailItems={trailItems}
        hasFocusedStory={Boolean(activeFocusNode && !activeFocusNode.cluster)}
        inspectorOpen={technicalInspectorOpen}
        onToggleInspector={() => setTechnicalInspectorOpen((open) => !open)}
        bridgeInfo={
          activeBridgeFocus
            ? {
                fromDomain: activeBridgeFocus.fromDomain,
                count: activeBridgeFocus.targetNodeIds.length,
              }
            : null
        }
        onClearBridge={() => setBridgeFocus(null)}
        searchLower={searchLower}
        matchCount={viewSelection.matchCount}
        primaryEntry={primaryEntry}
        insights={graph.meta?.insights}
        allNodes={graph.nodes}
        onInsightClick={onInsightClick}
        onTraceFromEntry={showFromEntry}
        onStepBack={stepBackOne}
        onSelectTrailItem={selectTrailItem}
      />

      <div className="viewer-workspace">
        {sidebarOpen && (
          <aside className="viewer-rail viewer-rail--left">
            <div className="graph-sidebar graph-sidebar--main">
              <div className="graph-sidebar__sticky">
                <div className="graph-sidebar__search-wrap">
                  <input
                    className="graph-search graph-search--sticky"
                    type="search"
                    placeholder="Find a feature, screen, or component…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="graph-sidebar__scroll atlas-scroll">
                <OverviewShortcuts
                  entries={overviewEntries}
                  projectRoot={graph.meta?.targetDir}
                  folders={overviewFolders}
                  hubs={overviewHubs}
                  spotlightFolder={activeDomain ?? selectedDomain}
                  spotlightNodeId={activeFocusNode?.id ?? spotlightNodeId}
                  onEntryClick={focusSymbolStory}
                  onFolderClick={onOverviewFolderClick}
                  onHubClick={focusSymbolStory}
                />

                <GraphActions
                  clusterMode={clusterMode}
                  onClusterModeChange={(enabled) => {
                    setHistoryStack([]);
                    setActiveDomain(null);
                    setStoryFocusId(null);
                    setStoryViaId(null);
                    setBridgeFocus(null);
                    setSelectedDomain(null);
                    setExpandedSubfolders(new Set());
                    setClusterMode(enabled);
                    if (!enabled) {
                      setFullyExpandedFolders(new Set());
                      setPartialReveals(new Map());
                    }
                    queueCamera({ kind: "fit-readable", duration: 220 });
                  }}
                  neighborhoodFocus={neighborhoodFocus}
                  onNeighborhoodFocusChange={onNeighborhoodFocusChange}
                  neighborhoodHops={neighborhoodHops}
                  onNeighborhoodHopsChange={setNeighborhoodHops}
                  showOverviewEdges={showOverviewEdges}
                  onShowOverviewEdgesChange={setShowOverviewEdges}
                  edgeVisibility={edgeVisibility}
                  onEdgeVisibilityChange={onEdgeVisibilityChange}
                  showExternalHooks={showExternalHooks}
                  onShowExternalHooksChange={(enabled) => {
                    setShowExternalHooks(enabled);
                  }}
                  activeDomain={activeDomain}
                  onBackToOverview={unwindToOverview}
                  expandedSubfolderCount={expandedSubfolders.size}
                  onCollapseSubfolders={() => {
                    setExpandedSubfolders(new Set());
                    queueCamera({ kind: "fit-readable", duration: 220 });
                  }}
                  onShowFromEntry={showFromEntry}
                  onLayoutPresetChange={applyLayout}
                  layoutPreset={layoutPreset}
                  layoutDisabled={
                    nodes.length === 0 || isOverviewMap || isStoryView
                  }
                />

                {graph.meta?.notice && (
                  <p className="graph-notice">{graph.meta.notice}</p>
                )}

                <GraphLegend types={legendTypes} typeColors={typeColors} />

                {activeFocusNode && pathIds.length > 0 && (
                  <p className="graph-sidebar__hint">
                    <span className="graph-sidebar__hint-label">
                      <span className="field-label">
                        <span className="field-label__text">
                          Path from startup
                        </span>
                        <InfoTip text="Shortest analyzed chain from an app startup file to the focused item." />
                      </span>
                    </span>
                    {pathIds
                      .map((id) => nodeById.get(id)?.name ?? id)
                      .join(" → ")}
                  </p>
                )}
              </div>
            </div>
          </aside>
        )}

        <main className="viewer-canvas viewer-canvas--column">
          {isAreaMapView && activeDomain && canvasBaseGraph && (
            <AreaContextBanner
              domain={activeDomain}
              graph={canvasBaseGraph}
              onStartStory={focusSymbolStory}
            />
          )}

          <div className="viewer-canvas__flow">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={flowNodeTypes}
              onInit={(inst) => {
                rfInstanceRef.current = inst;
              }}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onNodeDoubleClick={onNodeDoubleClick}
              onNodeMouseEnter={onNodeMouseEnter}
              onNodeMouseLeave={onNodeMouseLeave}
              onPaneClick={onPaneClick}
              onNodeDrag={onNodeDrag}
              onNodeDragStop={onNodeDragStop}
              defaultEdgeOptions={COMPACT_EDGE_DEFAULTS}
              connectionLineType={ConnectionLineType.SmoothStep}
              nodesDraggable={!isStoryView}
              nodesConnectable={false}
              elementsSelectable
              selectNodesOnDrag={false}
              onlyRenderVisibleElements={shouldVirtualize}
              elevateNodesOnSelect={false}
              elevateEdgesOnSelect={false}
              autoPanOnNodeFocus={false}
              panOnDrag
              panOnScroll
              zoomOnScroll
              zoomOnDoubleClick={false}
              minZoom={0.15}
              maxZoom={2}
              proOptions={PRO_OPTIONS}
            >
              <ViewportPersistence
                graphKey={persistenceKey}
                enabled={Boolean(persistenceKey) && layoutReady && !cameraCommand}
                restoreOnKeyChange={false}
              />
              <ExportBridge
                projectName={graph.meta?.projectName}
                graphKey={graphKey}
              />
              <FitViewBridge />
              <CameraController
                command={cameraCommand}
                layoutReady={layoutReady}
                nodeCount={nodes.length}
                onHandled={handleCameraHandled}
              />
              {!isStoryView &&
                activeFocusNode &&
                !activeFocusNode.cluster && (
                  <NodeToolbarActions
                    node={activeFocusNode}
                    onFocus={() =>
                      queueCamera({
                        kind: "ensure-node",
                        nodeId: activeFocusNode.id,
                      })
                    }
                  />
                )}

              <Background
                variant={BackgroundVariant.Dots}
                gap={16}
                size={1}
                color="var(--atlas-canvas-grid)"
              />
              <ZoomControls />
              <HelperLinesOverlay lines={helperLines} />

              <MiniMap
                nodeColor={(node) =>
                  node.type === "tierHeader" || node.type === "storyHeader"
                    ? "transparent"
                    : (typeColors[node.data.type as keyof typeof typeColors] ??
                      "#64748b")
                }
                nodeStrokeColor={() => "transparent"}
                maskColor="rgba(17, 17, 17, 0.85)"
                style={{
                  background: "var(--atlas-surface)",
                  border: "1px solid var(--atlas-border)",
                  borderRadius: "var(--atlas-radius-xl)",
                }}
                pannable
                zoomable
              />
            </ReactFlow>
          </div>
        </main>

        {showRightRail && (
          <aside className="viewer-rail viewer-rail--right">
            {showTechnicalDetails && activeFocusNode ? (
              <NodeDetails
                node={activeFocusNode}
                projectRoot={graph.meta?.targetDir}
                onSelectConnection={onSelectConnectionById}
                onClose={() => setTechnicalInspectorOpen(false)}
              />
            ) : showAreaSummary && selectedDomain ? (
              <DomainSummaryPanel
                domain={selectedDomain}
                graph={canvasBaseGraph ?? graph}
                onOpenDomain={
                  activeDomain && !storyFocusId ? switchDomain : openRootDomain
                }
                onSelectSymbol={focusSymbolStory}
                onSelectNeighborDomain={(neighbor) =>
                  setSelectedDomain(neighbor)
                }
                onClose={() => setSelectedDomain(null)}
              />
            ) : null}
          </aside>
        )}
      </div>
    </div>
  );
}
