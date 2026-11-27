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
import {
  AtlasClusterNode,
  OPEN_CLUSTER_EVENT,
  type ClusterNodeData,
} from "./AtlasClusterNode";
import { AtlasNode } from "./AtlasNode";
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
  popViewport,
  pushViewport,
  type CameraHistoryEntry,
} from "./cameraHistory";
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
  subclusterKeyWithinDomain,
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
  shouldAutoEnableNeighborhoodFocus,
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
import { ViewerHeader } from "./ViewerHeader";
import { ViewportPersistence } from "./ViewportPersistence";
import { loadViewport } from "./viewportStorage";
import { ZoomControls } from "./ZoomControls";
import "./graph.css";

const flowNodeTypes = {
  atlas: AtlasNode,
  cluster: AtlasClusterNode,
  tierHeader: AtlasTierHeaderNode,
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

type CameraCommand =
  | {
      id: number;
      kind: "fit-readable";
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

function scopeStorageKey(graphKey: string, activeDomain: string | null): string {
  if (!graphKey) return "";
  return `${graphKey}::v3::${activeDomain ?? "overview"}`;
}

function shortDomainName(domain: string): string {
  return domain.split("/").pop() ?? domain;
}

function nodeOpacity(
  node: FlowNode<AtlasNodeData>,
  searchLower: string,
  highlightIds: Set<string> | null
): number {
  if (node.type === "tierHeader") {
    return highlightIds && highlightIds.size > 0 ? 0.72 : 1;
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
  const bridgeFromShort = bridgeFocus
    ? shortDomainName(bridgeFocus.fromDomain)
    : undefined;
  let changed = false;

  const next = nodes.map((node) => {
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
      bridgeTargets && bridgeTargets.has(node.id) ? bridgeFromShort : undefined;

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
    isOverviewMap: boolean;
    showOverviewEdges: boolean;
    focusClusterId: string | null;
    clusterLinkCounts: ReadonlyMap<string, number>;
    isDenseDomain: boolean;
    hoveredNodeId: string | null;
  }
): Edge[] {
  const visible = filterEdgesByVisibility(edges, visibility);

  if (options.isOverviewMap && !options.showOverviewEdges) {
    const focusId = options.focusClusterId;
    if (!focusId) return [];

    return visible
      .filter((edge) => edge.source === focusId || edge.target === focusId)
      .map((edge) => {
        const count =
          options.clusterLinkCounts.get(`${edge.source}|${edge.target}`) ?? 1;
        return {
          ...edge,
          animated: false,
          label: `${count} link${count === 1 ? "" : "s"}`,
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

        if (command.kind === "fit-nodes") {
          // Prefer framing both the bridge targets and the origin stub if they sit
          // close enough to stay >= 68% zoom; otherwise frame the bridge targets directly.
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
  const [selected, setSelected] = useState<AtlasGraphNode | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [clusterMode, setClusterMode] = useState(false);
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const [domainTrail, setDomainTrail] = useState<string[]>([]);
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
  const cameraStackRef = useRef<CameraHistoryEntry[]>([]);
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

  const isLargeGraph =
    (canvasBaseGraph?.nodes.length ?? 0) > LARGE_GRAPH_THRESHOLD;
  const shouldVirtualize = nodes.length > VIRTUALIZE_THRESHOLD;
  const graphKey = graph ? graphSignature(graph) : "";
  const persistenceKey = scopeStorageKey(graphKey, activeDomain);

  const isOverviewMap =
    clusterMode &&
    !activeDomain &&
    !searchLower &&
    fullyExpandedFolders.size === 0;

  useEffect(() => {
    if (!graph) return;
    neighborhoodFocusTouchedRef.current = false;
    cameraStackRef.current = [];
    const nonExternal = graph.nodes.filter((node) => node.file !== "external");
    const large = nonExternal.length > LARGE_GRAPH_THRESHOLD;
    const shouldCluster =
      nonExternal.length > CLUSTER_OVERVIEW_THRESHOLD &&
      groupNodesByFolder(nonExternal).size >= 2;
    setClusterMode(shouldCluster);
    setActiveDomain(null);
    setDomainTrail([]);
    setBridgeFocus(null);
    setSelected(null);
    setSelectedDomain(null);
    setHoveredNodeId(null);
    setExpandedSubfolders(new Set());
    setFullyExpandedFolders(new Set());
    setPartialReveals(new Map());
    setSpotlightNodeId(null);
    setNeighborhoodFocus(defaultNeighborhoodFocusEnabled(large));

    const overviewKey = scopeStorageKey(graphKey, null);
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
    if (activeDomain && !searchLower) {
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
    expandedSubfolders,
    searchLower,
    clusterMode,
    fullyExpandedFolders,
    effectivePartialReveals,
  ]);

  const isDenseDomain =
    !isOverviewMap &&
    clusteredGraph.nodes.length > DENSE_DOMAIN_EDGE_LABEL_THRESHOLD;

  const clusterLinkCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!canvasBaseGraph || !clusterMode) return counts;
    const byId = new Map(
      canvasBaseGraph.nodes.map((node) => [node.id, node] as const)
    );
    for (const edge of canvasBaseGraph.edges) {
      const fromNode = byId.get(edge.from);
      const toNode = byId.get(edge.to);
      if (
        !fromNode ||
        !toNode ||
        fromNode.file === "external" ||
        toNode.file === "external"
      ) {
        continue;
      }
      const fromC = clusterNodeId(folderKey(fromNode.file));
      const toC = clusterNodeId(folderKey(toNode.file));
      if (fromC === toC) continue;
      const key = `${fromC}|${toC}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [canvasBaseGraph, clusterMode]);

  const partialRevealKey = [...effectivePartialReveals.entries()]
    .map(([folder, ids]) => `${folder}:${[...ids].sort().join(",")}`)
    .sort()
    .join("|");
  const expandedSubKey = [...expandedSubfolders].sort().join(",");

  const viewKey = `${graphSignature(clusteredGraph)}:${searchLower}:${clusterMode}:${activeDomain ?? ""}:${expandedSubKey}:${showExternalHooks}:${[...fullyExpandedFolders].sort().join(",")}:${partialRevealKey}`;

  const nodeById = useMemo(
    () => (graph ? buildNodeById(graph) : new Map<string, AtlasGraphNode>()),
    [graph]
  );

  const entryIds = useMemo(
    () => (graph ? findEntryNodes(graph).map((node) => node.id) : []),
    [graph]
  );

  const pathIds = useMemo(() => {
    if (!selected || !graph) return [] as string[];
    return findPathFromEntries(graph, selected.id, entryIds);
  }, [selected, graph, entryIds]);

  const connectedIds = useMemo(() => {
    if (!selected || !graph) return null;
    return getConnectedNodeIdsFromEdges(selected.id, graph.edges);
  }, [selected, graph]);

  const pathEdges = useMemo(
    () =>
      graph && pathIds.length > 0
        ? pathEdgeKeys(pathIds, graph)
        : new Set<string>(),
    [graph, pathIds]
  );

  const nodeSpotlightIds = useMemo(() => {
    if (!spotlightNodeId || !graph) return null;
    return computeNodeSpotlightIds(
      spotlightNodeId,
      graph.nodes,
      clusteredGraph.nodes,
      graph.edges
    );
  }, [spotlightNodeId, graph, clusteredGraph.nodes]);

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

  const selectionHighlightIds = useMemo(
    () =>
      resolveHighlightIds(
        pathIds,
        selected?.id ?? null,
        graph?.edges ?? [],
        connectedIds,
        { neighborhoodFocus, neighborhoodHops }
      ),
    [
      pathIds,
      connectedIds,
      selected?.id,
      graph?.edges,
      neighborhoodFocus,
      neighborhoodHops,
    ]
  );

  const activeBridgeFocus = useMemo(
    () =>
      bridgeFocus && bridgeFocus.toDomain === activeDomain ? bridgeFocus : null,
    [bridgeFocus, activeDomain]
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
    selectionHighlightIds,
    nodeSpotlightIds,
    bridgeHighlightIds,
    overviewFocusHighlightIds,
    searchHighlightIds,
  ]);

  const shouldHighlightEdges =
    Boolean(selected) ||
    Boolean(spotlightNodeId) ||
    Boolean(bridgeHighlightIds) ||
    Boolean(overviewFocusHighlightIds) ||
    Boolean(searchLower && searchHighlightIds && searchHighlightIds.size > 0);

  const selectedCanvasNodeId = useMemo(() => {
    if (selected) return selected.id;
    if (selectedDomain) return clusterNodeId(selectedDomain);
    return null;
  }, [selected, selectedDomain]);

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

  useEffect(() => {
    if (!graph) return;
    if (buildSigRef.current === viewKey) return;

    let cancelled = false;
    const buildingGen = ++buildingGenRef.current;
    setIsBuilding(true);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
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
                isOverviewMap,
                showOverviewEdges,
                focusClusterId: overviewFocusClusterId,
                clusterLinkCounts,
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
    clusteredGraph,
    viewKey,
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
    clusterLinkCounts,
    hoveredNodeId,
    setNodes,
    setEdges,
  ]);

  useEffect(() => {
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
          isOverviewMap,
          showOverviewEdges,
          focusClusterId: overviewFocusClusterId,
          clusterLinkCounts,
          isDenseDomain,
          hoveredNodeId,
        }
      )
    );
  }, [
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
    clusterLinkCounts,
    hoveredNodeId,
    setNodes,
    setEdges,
  ]);

  const pushCurrentCamera = useCallback(() => {
    const inst = rfInstanceRef.current;
    if (!inst) return;
    const scopeKey = activeDomain ? `domain:${activeDomain}` : "overview";
    cameraStackRef.current = pushViewport(cameraStackRef.current, {
      scopeKey,
      domain: activeDomain,
      trail: domainTrail,
      viewport: inst.getViewport(),
    });
  }, [activeDomain, domainTrail]);

  const unwindToOverview = useCallback(() => {
    const { entry, nextStack } = popViewport(
      cameraStackRef.current,
      "overview"
    );
    cameraStackRef.current = nextStack;
    setActiveDomain(null);
    setDomainTrail([]);
    setBridgeFocus(null);
    setExpandedSubfolders(new Set());
    setSearch("");
    setSelected(null);
    setSelectedDomain(null);
    setHoveredNodeId(null);
    setSpotlightNodeId(null);
    setFullyExpandedFolders(new Set());
    setPartialReveals(new Map());

    if (entry) {
      queueCamera({ kind: "restore", viewport: entry.viewport, duration: 240 });
    } else {
      queueCamera({ kind: "fit-readable", duration: 220 });
    }
  }, [queueCamera]);

  const stepBackOne = useCallback(() => {
    if (searchLower && !activeDomain) {
      setSearch("");
      return;
    }

    const { entry, nextStack } = popViewport(cameraStackRef.current);
    cameraStackRef.current = nextStack;

    const restoredDomain = entry?.domain ?? null;
    const restoredTrail = entry?.trail
      ? [...entry.trail]
      : restoredDomain
        ? [restoredDomain]
        : [];

    setActiveDomain(restoredDomain);
    setDomainTrail(restoredTrail);
    setBridgeFocus(null);
    setExpandedSubfolders(new Set());
    setSearch("");
    setSelected(null);
    setSelectedDomain(null);
    setHoveredNodeId(null);
    setSpotlightNodeId(null);
    setFullyExpandedFolders(new Set());
    setPartialReveals(new Map());

    if (entry) {
      queueCamera({ kind: "restore", viewport: entry.viewport, duration: 240 });
    } else {
      queueCamera({ kind: "fit-readable", duration: 220 });
    }
  }, [searchLower, activeDomain, queueCamera]);

  const unwindToTrailDomain = useCallback(
    (targetDomain: string, trailIndex: number) => {
      if (targetDomain === activeDomain) {
        setSelected(null);
        setSelectedDomain(null);
        return;
      }

      const targetKey = `domain:${targetDomain}`;
      const { entry, nextStack } = popViewport(
        cameraStackRef.current,
        targetKey
      );
      cameraStackRef.current = nextStack;

      setActiveDomain(targetDomain);
      setDomainTrail(
        entry?.trail
          ? [...entry.trail]
          : domainTrail.slice(0, trailIndex + 1)
      );
      setBridgeFocus(null);
      setExpandedSubfolders(new Set());
      setSearch("");
      setSelected(null);
      setSelectedDomain(null);
      setHoveredNodeId(null);
      setSpotlightNodeId(null);

      if (entry) {
        queueCamera({
          kind: "restore",
          viewport: entry.viewport,
          duration: 240,
        });
      } else {
        queueCamera({ kind: "fit-readable", duration: 220 });
      }
    },
    [activeDomain, domainTrail, queueCamera]
  );

  /**
   * Open a domain as a fresh root drill-down (from Overview or Left Sidebar).
   */
  const openRootDomain = useCallback(
    (domain: string) => {
      if (domain === activeDomain && !searchLower) {
        setSelected(null);
        setSelectedDomain(null);
        setBridgeFocus(null);
        return;
      }

      if (!activeDomain) {
        pushCurrentCamera();
      } else {
        // Keep overview at the bottom of the stack when switching root domains from sidebar
        const overviewEntry = cameraStackRef.current.find(
          (item) => item.scopeKey === "overview"
        );
        cameraStackRef.current = overviewEntry ? [overviewEntry] : [];
      }

      setActiveDomain(domain);
      setDomainTrail([domain]);
      setBridgeFocus(null);
      setExpandedSubfolders(new Set());
      setClusterMode(true);
      setSearch("");
      setSelected(null);
      setSelectedDomain(null);
      setHoveredNodeId(null);
      setSpotlightNodeId(null);
      queueCamera({ kind: "fit-readable", duration: 220 });
    },
    [activeDomain, searchLower, pushCurrentCamera, queueCamera]
  );

  /**
   * Directed hop (`switch →`) from `activeDomain` into connected neighbor `targetDomain`:
   * appends to traversal trail, spotlights exact bridge symbols, and frames them in view.
   */
  const switchDomain = useCallback(
    (targetDomain: string) => {
      if (!activeDomain || !canvasBaseGraph) {
        openRootDomain(targetDomain);
        return;
      }

      // If targetDomain is already an ancestor in our trail, unwind back to it cleanly
      const existingIdx = domainTrail.indexOf(targetDomain);
      if (existingIdx >= 0) {
        unwindToTrailDomain(targetDomain, existingIdx);
        return;
      }

      const fromDomain = activeDomain;
      const bridge = findDomainBridgeNodes(
        canvasBaseGraph,
        fromDomain,
        targetDomain
      );

      pushCurrentCamera();
      const nextTrail =
        domainTrail.length > 0
          ? [...domainTrail, targetDomain]
          : [fromDomain, targetDomain];

      setActiveDomain(targetDomain);
      setDomainTrail(nextTrail);
      setExpandedSubfolders(new Set(bridge.requiredSubfolders));
      setClusterMode(true);
      setSearch("");
      setSelected(null);
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
      domainTrail,
      openRootDomain,
      unwindToTrailDomain,
      pushCurrentCamera,
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

  useEffect(() => {
    const onOpenCluster = (event: Event) => {
      const folder = (event as CustomEvent<string>).detail;
      if (!folder) return;
      if (activeDomain && folder.startsWith(`${activeDomain}/`)) {
        expandSubcluster(folder);
        return;
      }
      if (activeDomain) {
        switchDomain(folder);
        return;
      }
      openRootDomain(folder);
    };

    window.addEventListener(OPEN_CLUSTER_EVENT, onOpenCluster);
    return () => window.removeEventListener(OPEN_CLUSTER_EVENT, onOpenCluster);
  }, [activeDomain, expandSubcluster, switchDomain, openRootDomain]);

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

      if (activeDomain) {
        event.preventDefault();
        stepBackOne();
        return;
      }

      if (search) {
        event.preventDefault();
        setSearch("");
        return;
      }

      if (selected || selectedDomain || spotlightNodeId || bridgeFocus) {
        event.preventDefault();
        setSelected(null);
        setSelectedDomain(null);
        setSpotlightNodeId(null);
        setBridgeFocus(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeDomain,
    search,
    selected,
    selectedDomain,
    spotlightNodeId,
    bridgeFocus,
    stepBackOne,
  ]);

  const jumpToSymbol = useCallback(
    (node: AtlasGraphNode) => {
      if (!graph) return;

      if (node.file === "external" && !showExternalHooks) {
        setShowExternalHooks(true);
      }

      if (clusterMode && node.file !== "external") {
        const targetDomain = folderKey(node.file);
        const subKey = subclusterKeyWithinDomain(node.file, targetDomain);

        if (targetDomain !== activeDomain) {
          pushCurrentCamera();
          setActiveDomain(targetDomain);
          setDomainTrail((prev) => {
            if (!activeDomain) return [targetDomain];
            const idx = prev.indexOf(targetDomain);
            return idx >= 0
              ? prev.slice(0, idx + 1)
              : [...prev, targetDomain];
          });
          setBridgeFocus(null);
          setExpandedSubfolders(subKey ? new Set([subKey]) : new Set());
        } else if (subKey && !expandedSubfolders.has(subKey)) {
          setExpandedSubfolders((prev) => new Set([...prev, subKey]));
        }
      }

      setSearch("");
      setSelectedDomain(null);
      setSpotlightNodeId(node.id);
      setSelected(enrichNodeForDetails(node, graph, nodeById));
      queueCamera({ kind: "ensure-node", nodeId: node.id });
    },
    [
      graph,
      showExternalHooks,
      clusterMode,
      activeDomain,
      expandedSubfolders,
      pushCurrentCamera,
      nodeById,
      queueCamera,
    ]
  );

  const onSelectConnectionById = useCallback(
    (targetId: string) => {
      const target = nodeById.get(targetId);
      if (target) {
        jumpToSymbol(target);
      }
    },
    [nodeById, jumpToSymbol]
  );

  const onInsightClick = useCallback(
    (insight: GraphInsight) => {
      if (!graph) return;
      const match = findNodeForInsight(insight, graph.nodes);
      if (!match) return;
      jumpToSymbol(match);
    },
    [graph, jumpToSymbol]
  );

  const onOverviewFolderClick = useCallback(
    (folder: FolderOverview) => {
      if (activeDomain === folder.folder) {
        unwindToOverview();
        return;
      }
      openRootDomain(folder.folder);
    },
    [activeDomain, unwindToOverview, openRootDomain]
  );

  const onNodeClick = useCallback(
    (_event: MouseEvent, node: FlowNode<AtlasNodeData>) => {
      if (node.type === "tierHeader") return;

      if (isClusterId(node.id)) {
        const folder = folderFromClusterId(node.id);
        const clusterData = node.data as unknown as ClusterNodeData;

        if (clusterData.isSubcluster) {
          expandSubcluster(folder);
          return;
        }

        // Single-click previews domain connections & summary in place with 0 camera jump
        setSelected(null);
        setSpotlightNodeId(null);
        setSelectedDomain((prev) => (prev === folder ? null : folder));
        return;
      }

      if (!graph) return;
      const base = nodeById.get(node.data.nodeId ?? node.id);
      if (!base) return;

      setSelectedDomain(null);
      setSpotlightNodeId(null);
      if (
        shouldAutoEnableNeighborhoodFocus(
          isLargeGraph,
          neighborhoodFocusTouchedRef.current,
          neighborhoodFocus
        )
      ) {
        setNeighborhoodFocus(true);
      }
      // Single-clicking a symbol inspects in place with 0 camera jump
      setSelected(enrichNodeForDetails(base, graph, nodeById));
    },
    [graph, nodeById, expandSubcluster, isLargeGraph, neighborhoodFocus]
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
      if (activeDomain) {
        switchDomain(folder);
        return;
      }
      openRootDomain(folder);
    },
    [activeDomain, expandSubcluster, switchDomain, openRootDomain]
  );

  const onNodeMouseEnter = useCallback(
    (_event: MouseEvent, node: FlowNode<AtlasNodeData>) => {
      if (node.type === "tierHeader") return;
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
    setSelected(null);
    setSelectedDomain(null);
    setSpotlightNodeId(null);
    setBridgeFocus(null);
    setHelperLines([]);
  }, []);

  const onNodeDrag: OnNodeDrag<FlowNode<AtlasNodeData>> = useCallback(
    (_event, dragged) => {
      if (dragged.type === "tierHeader") return;
      const { lines } = computeHelperLines(dragged, nodes);
      setHelperLines(lines);
    },
    [nodes]
  );

  const onNodeDragStop: OnNodeDrag<FlowNode<AtlasNodeData>> = useCallback(
    (_event, dragged) => {
      if (dragged.type === "tierHeader") return;
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
    [setNodes, graphKey, isOverviewMap]
  );

  const showFromEntry = useCallback(() => {
    if (!graph) return;
    const entries = findEntryNodes(graph);
    if (entries.length === 0) return;
    jumpToSymbol(entries[0]!);
  }, [graph, jumpToSymbol]);

  const applyLayout = useCallback(
    (preset: LayoutPreset) => {
      setLayoutPreset(preset);
      saveLayoutPreset(preset);

      if (isOverviewMap) {
        queueCamera({ kind: "fit-readable", duration: 220 });
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
    [isOverviewMap, nodes, entryIds, graph, setNodes, queueCamera]
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
      layoutDisabled: nodes.length === 0,
      selected,
      hasEntryNodes: graph ? findEntryNodes(graph).length > 0 : false,
      edgeVisibility,
    }),
    [
      graph,
      clusterMode,
      neighborhoodFocus,
      nodes.length,
      selected,
      layoutPreset,
      edgeVisibility,
    ]
  );

  const commandPaletteActions = useMemo<CommandPaletteActions>(
    () => ({
      onJumpToNode: jumpToSymbol,
      onShowFromEntry: showFromEntry,
      onApplyLayout: applyLayout,
      onCycleLayout: cycleLayout,
      onToggleClusterMode: () => {
        setActiveDomain(null);
        setDomainTrail([]);
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
        if (!selected) return;
        queueCamera({ kind: "ensure-node", nodeId: selected.id });
      },
      onCopySelectedName: () => {
        if (selected?.name) void copyText(selected.name);
      },
      onCopySelectedPath: () => {
        if (selected?.file && selected.file !== "external") {
          void copyText(selected.file);
        }
      },
      onHideEdgeType: (type) => {
        onEdgeVisibilityChange(type, false);
      },
      onShowAllEdges: showAllEdges,
    }),
    [
      jumpToSymbol,
      showFromEntry,
      applyLayout,
      cycleLayout,
      selected,
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
  const showRightRail = Boolean(
    (selected && !selected.cluster) || selectedDomain
  );

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
        activeDomain={activeDomain}
        domainTrail={domainTrail}
        selectedDomain={selectedDomain}
        selectedNode={selected}
        bridgeInfo={
          activeBridgeFocus && !selected
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
        onBackToOverview={unwindToOverview}
        onSelectTrailDomain={unwindToTrailDomain}
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
                    placeholder="Filter symbols or folders…"
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
                  spotlightNodeId={selected?.id ?? spotlightNodeId}
                  onEntryClick={jumpToSymbol}
                  onFolderClick={onOverviewFolderClick}
                  onHubClick={jumpToSymbol}
                />

                <GraphActions
                  clusterMode={clusterMode}
                  onClusterModeChange={(enabled) => {
                    setActiveDomain(null);
                    setDomainTrail([]);
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
                  layoutDisabled={nodes.length === 0 || isOverviewMap}
                />

                {graph.meta?.notice && (
                  <p className="graph-notice">{graph.meta.notice}</p>
                )}

                <GraphLegend types={legendTypes} typeColors={typeColors} />

                {selected && pathIds.length > 0 && (
                  <p className="graph-sidebar__hint">
                    <span className="graph-sidebar__hint-label">
                      <span className="field-label">
                        <span className="field-label__text">Boot path</span>
                        <InfoTip text="Shortest chain from an app entry file to the selected symbol." />
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

        <main className="viewer-canvas">
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
            nodesDraggable
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
            {selected && !selected.cluster && (
              <NodeToolbarActions
                node={selected}
                onFocus={() =>
                  queueCamera({ kind: "ensure-node", nodeId: selected.id })
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
                node.type === "tierHeader"
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
        </main>

        {showRightRail && (
          <aside className="viewer-rail viewer-rail--right">
            {selected && !selected.cluster ? (
              <NodeDetails
                node={selected}
                projectRoot={graph.meta?.targetDir}
                onSelectConnection={onSelectConnectionById}
                onClose={() => setSelected(null)}
              />
            ) : selectedDomain ? (
              <DomainSummaryPanel
                domain={selectedDomain}
                graph={canvasBaseGraph ?? graph}
                onOpenDomain={activeDomain ? switchDomain : openRootDomain}
                onSelectSymbol={jumpToSymbol}
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
