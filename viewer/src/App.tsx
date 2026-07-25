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
  MiniMap,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AtlasClusterNode } from "./AtlasClusterNode";
import { AtlasNode } from "./AtlasNode";
import {
  buildFlowGraph,
  nodeTypes as legendTypes,
  relayoutFlowNodes,
  type AtlasNodeData,
  typeColors,
} from "./buildFlowGraph";
import {
  applyClusterView,
  buildClusteredVisibleIds,
  clusterNodeId,
  collapseAllClusterFoldersState,
  collapseClusterFolderState,
  findEntryNodes,
  folderFromClusterId,
  folderKey,
  groupNodesByFolder,
  isClusterId,
  listExpandedFolders,
  nextClusterReveal,
} from "./clusterGraph";
import { FocusOnSelect } from "./FocusOnSelect";
import { computeFolderSpotlightIds } from "./folderSpotlight";
import { filterEdgesByVisibility } from "./edgeVisibility";
import {
  loadEdgeVisibility,
  saveEdgeVisibility,
  setEdgeTypeVisible,
  DEFAULT_EDGE_VISIBILITY,
  type EdgeVisibilityPrefs,
} from "./edgeVisibilityPrefs";
import { GraphActions } from "./GraphActions";
import { CommandPalette } from "./features/command-palette/CommandPalette";
import { ExportBridge, triggerExport } from "./exportGraphBridge";
import {
  FitViewBridge,
  triggerFitView,
} from "./features/command-palette/fitViewBridge";
import type { CommandPaletteActions } from "./features/command-palette/commandRegistry";
import { MobileBanner } from "./features/mobile-banner/MobileBanner";
import { FloatingPanel, PanelMinimizeButton } from "./FloatingPanel";
import {
  buildNodeById,
  enrichNodeForDetails,
  getConnectedNodeIdsFromEdges,
  graphSignature,
} from "./graphConnections";
import {
  computeEntryPoints,
  computeHubNodes,
  computeTopFolders,
  type FolderOverview,
} from "./graphOverview";
import {
  computeHelperLines,
  HelperLinesOverlay,
  type HelperLine,
} from "./HelperLines";
import { InsightsBadge } from "./InsightsBadge";
import { InfoTip } from "./InfoTip";
import { NodeDetails } from "./NodeDetails";
import { OverviewShortcuts } from "./OverviewShortcuts";
import { NodeToolbarActions } from "./NodeToolbarActions";
import { defaultDetailsPanelRect, defaultMainPanelRect } from "./panelStorage";
import {
  loadNodePositions,
  mergeNodePositions,
  nodePositionsFromNodes,
  saveNodePositions,
} from "./nodePositionStorage";
import {
  findPathFromEntries,
  pathEdgeKeys,
} from "./pathHighlight";
import {
  DEFAULT_NEIGHBORHOOD_HOPS,
  defaultNeighborhoodFocusEnabled,
  resolveHighlightIds,
  shouldAutoEnableNeighborhoodFocus,
} from "./neighborhoodFocus";
import {
  emptyGraphPresentation,
  validateGraphData,
  type EmptyGraphPresentation,
} from "./graphValidation";
import type { AtlasGraph, AtlasGraphNode } from "./types";
import { ViewportPersistence } from "./ViewportPersistence";
import { ZoomControls } from "./ZoomControls";
import { loadViewport } from "./viewportStorage";
import {
  FORCE_FULL_GRAPH,
  GRAPH_POLL_MS,
  LARGE_GRAPH_THRESHOLD,
  OVERVIEW_HUB_NODES,
  OVERVIEW_TOP_FOLDERS,
  VIRTUALIZE_THRESHOLD,
} from "./viewerConfig";
import "./graph.css";
import {
  loadLayoutPreset,
  nextLayoutPreset,
  saveLayoutPreset,
  type LayoutPreset,
} from "./layoutPresets";
import { selectVisibleGraph, type ViewGraphMode } from "./viewGraph";

const flowNodeTypes = { atlas: AtlasNode, cluster: AtlasClusterNode };

const PRO_OPTIONS = { hideAttribution: true } as const;
const COMPACT_EDGE_DEFAULTS = {
  animated: false,
  type: "default" as const,
} as const;

function nodeOpacity(
  nodeId: string,
  label: string,
  searchLower: string,
  highlightIds: Set<string> | null,
): number {
  const matchesSearch = !searchLower || label.toLowerCase().includes(searchLower);

  if (highlightIds && highlightIds.size > 0) {
    return highlightIds.has(nodeId) ? 1 : 0.18;
  }

  if (searchLower && !matchesSearch) return 0.22;
  return 1;
}

function patchNodePresentation(
  nodes: Node<AtlasNodeData>[],
  searchLower: string,
  selectedId: string | null,
  highlightIds: Set<string> | null,
): Node<AtlasNodeData>[] {
  let changed = false;

  const next = nodes.map((node) => {
    const label = String(node.data.label ?? "");
    const opacity = nodeOpacity(node.id, label, searchLower, highlightIds);
    const isSelected = selectedId === node.id;
    const dimmed = opacity < 1;
    const prevOpacity = node.style?.opacity ?? 1;

    if (
      node.selected === isSelected &&
      node.data.selected === isSelected &&
      node.data.dimmed === dimmed &&
      prevOpacity === opacity
    ) {
      return node;
    }

    changed = true;
    return {
      ...node,
      selected: isSelected,
      style: { ...node.style, opacity },
      data: { ...node.data, selected: isSelected, dimmed },
    };
  });

  return changed ? next : nodes;
}

function patchEdgePresentation(
  edges: Edge[],
  highlightIds: Set<string> | null,
  pathEdges: Set<string>,
  highlight: boolean,
): Edge[] {
  if (!highlight || !highlightIds) return edges;

  let changed = false;
  const next = edges.map((edge) => {
    let onPath = false;
    if (pathEdges.size > 0) {
      for (const key of pathEdges) {
        const [from, to] = key.split("|");
        if (from === edge.source && to === edge.target) {
          onPath = true;
          break;
        }
      }
    } else if (highlightIds) {
      onPath = highlightIds.has(edge.source) && highlightIds.has(edge.target);
    }

    const opacity = onPath ? 1 : 0.1;
    const prevOpacity = edge.style?.opacity ?? 1;

    if (prevOpacity === opacity && edge.animated === false) return edge;

    changed = true;
    return {
      ...edge,
      animated: false,
      style: { ...edge.style, opacity },
    };
  });

  return changed ? next : edges;
}

function presentEdges(
  edges: Edge[],
  visibility: EdgeVisibilityPrefs,
  highlightIds: Set<string> | null,
  pathEdges: Set<string>,
  highlight: boolean,
): Edge[] {
  return patchEdgePresentation(
    filterEdgesByVisibility(edges, visibility),
    highlightIds,
    pathEdges,
    highlight,
  );
}

function FitViewOnce({
  viewKey,
  nodeCount,
  skip,
}: {
  viewKey: string;
  nodeCount: number;
  skip: boolean;
}) {
  const { fitView } = useReactFlow();
  const lastKey = useRef("");

  useEffect(() => {
    if (skip || nodeCount === 0 || lastKey.current === viewKey) return;

    const timer = window.setTimeout(() => {
      fitView({ padding: 0.22, duration: nodeCount > VIRTUALIZE_THRESHOLD ? 0 : 280 });
      lastKey.current = viewKey;
    }, 120);

    return () => window.clearTimeout(timer);
  }, [fitView, nodeCount, viewKey, skip]);

  return null;
}

function emptyViewMessage(
  mode: ViewGraphMode,
  totalNodes: number,
  matchCount: number,
  searchLower: string,
): string {
  if (mode === "overview" && !searchLower) {
    return "Showing folder overview — click a folder to expand, or use shortcuts below.";
  }
  if (mode === "empty" && !searchLower) {
    return `This graph has ${totalNodes.toLocaleString()} nodes — search for a component, hook, or file to explore.`;
  }
  if (mode === "empty" && searchLower) {
    return `No nodes match "${searchLower}". Try another name or file path.`;
  }
  if (mode === "search" && matchCount > 0) {
    return `Showing ${matchCount} match${matchCount === 1 ? "" : "es"} and nearby connections.`;
  }
  return "";
}

function EmptyGraphPanel({ presentation }: { presentation: EmptyGraphPresentation }) {
  return (
    <div className="graph-shell graph-shell--empty">
      <div className="graph-panel graph-panel--empty">
        <p className="graph-panel__eyebrow">React Atlas</p>
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
  const [emptyGraph, setEmptyGraph] = useState<EmptyGraphPresentation | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AtlasGraphNode | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [clusterMode, setClusterMode] = useState(false);
  const [fullyExpandedFolders, setFullyExpandedFolders] = useState<Set<string>>(
    () => new Set(),
  );
  const [partialReveals, setPartialReveals] = useState<Map<string, Set<string>>>(
    () => new Map(),
  );
  const [helperLines, setHelperLines] = useState<HelperLine[]>([]);
  const [focusOnSelect, setFocusOnSelect] = useState(true);
  const [neighborhoodFocus, setNeighborhoodFocus] = useState(false);
  const [neighborhoodHops, setNeighborhoodHops] = useState(DEFAULT_NEIGHBORHOOD_HOPS);
  const [spotlightFolder, setSpotlightFolder] = useState<string | null>(null);
  const [canvasFocusId, setCanvasFocusId] = useState<string | null>(null);
  const [relayoutNonce, setRelayoutNonce] = useState(0);
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>(() => loadLayoutPreset());
  const [edgeVisibility, setEdgeVisibility] = useState<EdgeVisibilityPrefs>(() =>
    loadEdgeVisibility(),
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<AtlasNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const buildSigRef = useRef<string>("");
  const baseEdgesRef = useRef<Edge[]>([]);
  const hasSavedViewportRef = useRef(false);
  const savedNodePositionsRef = useRef<ReturnType<typeof loadNodePositions>>(null);
  const prevSearchRef = useRef("");
  const neighborhoodFocusTouchedRef = useRef(false);

  const deferredSearch = useDeferredValue(search);
  const searchLower = deferredSearch.trim().toLowerCase();

  const isLargeGraph = (graph?.nodes.length ?? 0) > LARGE_GRAPH_THRESHOLD;
  const shouldVirtualize = nodes.length > VIRTUALIZE_THRESHOLD;
  const graphKey = graph ? graphSignature(graph) : "";

  useEffect(() => {
    if (!graph) return;
    neighborhoodFocusTouchedRef.current = false;
    const large = graph.nodes.length > LARGE_GRAPH_THRESHOLD;
    setClusterMode(large);
    setFullyExpandedFolders(new Set());
    setPartialReveals(new Map());
    setSpotlightFolder(null);
    setNeighborhoodFocus(defaultNeighborhoodFocusEnabled(large));
  }, [graphKey]);

  const viewSelection = useMemo(() => {
    if (!graph) {
      return {
        graph: { nodes: [], edges: [] } as AtlasGraph,
        mode: "full" as ViewGraphMode,
        matchCount: 0,
      };
    }
    return selectVisibleGraph(graph, searchLower, isLargeGraph);
  }, [graph, searchLower, isLargeGraph]);

  const clusteredGraph = useMemo(() => {
    if (!graph) return viewSelection.graph;
    return applyClusterView(
      viewSelection.graph,
      clusterMode,
      fullyExpandedFolders,
      partialReveals,
    );
  }, [graph, viewSelection.graph, clusterMode, fullyExpandedFolders, partialReveals]);

  const partialRevealKey = [...partialReveals.entries()]
    .map(([folder, ids]) => `${folder}:${[...ids].sort().join(",")}`)
    .sort()
    .join("|");

  const viewKey = `${graphSignature(clusteredGraph)}:${searchLower}:${clusterMode}:${[...fullyExpandedFolders].sort().join(",")}:${partialRevealKey}`;

  const nodeById = useMemo(
    () => (graph ? buildNodeById(graph) : new Map<string, AtlasGraphNode>()),
    [graph],
  );

  const entryIds = useMemo(
    () => (graph ? findEntryNodes(graph).map((node) => node.id) : []),
    [graph],
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
    () => (graph && pathIds.length > 0 ? pathEdgeKeys(pathIds, graph) : new Set<string>()),
    [graph, pathIds],
  );

  const folderSpotlightIds = useMemo(() => {
    if (!spotlightFolder || !graph) return null;
    return computeFolderSpotlightIds(spotlightFolder, graph.nodes, clusteredGraph.nodes);
  }, [spotlightFolder, graph, clusteredGraph.nodes]);

  const selectionHighlightIds = useMemo(
    () =>
      resolveHighlightIds(
        pathIds,
        selected?.id ?? null,
        graph?.edges ?? [],
        connectedIds,
        { neighborhoodFocus, neighborhoodHops },
      ),
    [pathIds, connectedIds, selected?.id, graph?.edges, neighborhoodFocus, neighborhoodHops],
  );

  const highlightIds = useMemo(() => {
    if (selectionHighlightIds && selectionHighlightIds.size > 0) {
      return selectionHighlightIds;
    }
    if (folderSpotlightIds && folderSpotlightIds.size > 0) {
      return folderSpotlightIds;
    }
    return selectionHighlightIds;
  }, [selectionHighlightIds, folderSpotlightIds]);

  const shouldHighlightEdges = Boolean(selected) || Boolean(spotlightFolder);

  const spotlightFitIds = useMemo(
    () => (folderSpotlightIds ? [...folderSpotlightIds] : null),
    [folderSpotlightIds],
  );

  const expandedFolders = useMemo(
    () => listExpandedFolders(fullyExpandedFolders, partialReveals),
    [fullyExpandedFolders, partialReveals],
  );

  const overviewEntries = useMemo(
    () => (graph ? computeEntryPoints(graph) : []),
    [graph],
  );

  const overviewFolders = useMemo(
    () => (graph ? computeTopFolders(graph, OVERVIEW_TOP_FOLDERS) : []),
    [graph],
  );

  const overviewHubs = useMemo(
    () => (graph ? computeHubNodes(graph, OVERVIEW_HUB_NODES) : []),
    [graph],
  );

  const loadGraph = useCallback(async () => {
    try {
      const res = await fetch("/graph.json");
      if (!res.ok) throw new Error("graph.json not found. Run `pnpm analyze` first.");
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
      setError(err instanceof Error ? err.message : "Failed to load graph.json");
    }
  }, []);

  useEffect(() => {
    hasSavedViewportRef.current = Boolean(graphKey && loadViewport(graphKey));
    savedNodePositionsRef.current = graphKey ? loadNodePositions(graphKey) : null;
  }, [graphKey]);

  useEffect(() => {
    if (prevSearchRef.current && !searchLower) {
      setSelected(null);
      setSpotlightFolder(null);
    }
    prevSearchRef.current = searchLower;
  }, [searchLower]);

  useEffect(() => {
    loadGraph();
    if (isLargeGraph) return undefined;
    const interval = window.setInterval(loadGraph, GRAPH_POLL_MS);
    return () => window.clearInterval(interval);
  }, [loadGraph, isLargeGraph]);

  useEffect(() => {
    if (!graph) return;
    if (buildSigRef.current === viewKey) return;

    let cancelled = false;
    setIsBuilding(true);

    const timer = window.setTimeout(() => {
      const built = buildFlowGraph(clusteredGraph, { compact: isLargeGraph });
      if (cancelled) return;

      buildSigRef.current = viewKey;
      baseEdgesRef.current = built.edges;

      setNodes((current) =>
        patchNodePresentation(
          mergeNodePositions(built.nodes, current, savedNodePositionsRef.current),
          searchLower,
          selected?.id ?? null,
          highlightIds,
        ),
      );
      setEdges(
        presentEdges(
          built.edges,
          edgeVisibility,
          highlightIds,
          pathEdges,
          shouldHighlightEdges,
        ),
      );
      setIsBuilding(false);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [graph, clusteredGraph, viewKey, isLargeGraph, setNodes, setEdges]);

  useEffect(() => {
    setNodes((current) =>
      patchNodePresentation(current, searchLower, selected?.id ?? null, highlightIds),
    );
    setEdges((current) =>
      presentEdges(
        baseEdgesRef.current.length > 0 ? baseEdgesRef.current : current,
        edgeVisibility,
        highlightIds,
        pathEdges,
        shouldHighlightEdges,
      ),
    );
  }, [
    searchLower,
    selected?.id,
    highlightIds,
    pathEdges,
    shouldHighlightEdges,
    edgeVisibility,
    setNodes,
    setEdges,
  ]);

  const expandClusterFolder = useCallback(
    (folder: string) => {
      if (!graph) return;

      if (isLargeGraph && clusterMode) {
        const members = groupNodesByFolder(graph.nodes).get(folder) ?? [];
        setPartialReveals((prev) => {
          const next = new Map(prev);
          const already = next.get(folder) ?? new Set<string>();
          const visible = buildClusteredVisibleIds(
            viewSelection.graph,
            clusterMode,
            fullyExpandedFolders,
            prev,
          );
          next.set(
            folder,
            nextClusterReveal(folder, members, visible, graph, already),
          );
          return next;
        });
      } else {
        setFullyExpandedFolders((prev) => new Set([...prev, folder]));
      }

      setCanvasFocusId(clusterNodeId(folder));
      setSelected(null);
    },
    [graph, isLargeGraph, clusterMode, viewSelection.graph, fullyExpandedFolders],
  );

  const collapseClusterFolder = useCallback(
    (folder: string) => {
      const next = collapseClusterFolderState(
        folder,
        fullyExpandedFolders,
        partialReveals,
      );
      setFullyExpandedFolders(next.fullyExpandedFolders);
      setPartialReveals(next.partialReveals);
      setCanvasFocusId(clusterNodeId(folder));
      setSelected((current) => {
        if (!current || current.file === "external") return current;
        return folderKey(current.file) === folder ? null : current;
      });
    },
    [fullyExpandedFolders, partialReveals],
  );

  const collapseAllClusterFolders = useCallback(() => {
    const next = collapseAllClusterFoldersState();
    setFullyExpandedFolders(next.fullyExpandedFolders);
    setPartialReveals(next.partialReveals);
    setSelected(null);
    setSpotlightFolder(null);
    setCanvasFocusId(null);
  }, []);

  const focusGraphNode = useCallback(
    (node: AtlasGraphNode) => {
      if (!graph) return;

      if (isLargeGraph && !FORCE_FULL_GRAPH) {
        setSearch(node.name);
      }

      setSelected(enrichNodeForDetails(node, graph, nodeById));
      setSpotlightFolder(null);
      setFocusOnSelect(true);
      setCanvasFocusId(null);
    },
    [graph, isLargeGraph, nodeById],
  );

  const onOverviewFolderClick = useCallback(
    (folder: FolderOverview) => {
      if (spotlightFolder === folder.folder) {
        setSpotlightFolder(null);
        return;
      }

      setSpotlightFolder(folder.folder);
      setSelected(null);
      if (!clusterMode) setClusterMode(true);
      expandClusterFolder(folder.folder);
      setCanvasFocusId(null);
      setFocusOnSelect(true);
    },
    [expandClusterFolder, clusterMode, spotlightFolder],
  );

  const onOverviewEntryClick = useCallback(
    (node: AtlasGraphNode) => focusGraphNode(node),
    [focusGraphNode],
  );

  const onOverviewHubClick = useCallback(
    (node: AtlasGraphNode) => focusGraphNode(node),
    [focusGraphNode],
  );

  const onNodeClick = useCallback(
    (_event: MouseEvent, node: Node<AtlasNodeData>) => {
      if (isClusterId(node.id)) {
        const folder = folderFromClusterId(node.id);
        if (_event.shiftKey && expandedFolders.includes(folder)) {
          collapseClusterFolder(folder);
          return;
        }
        expandClusterFolder(folder);
        return;
      }

      if (!graph) return;
      const base = nodeById.get(node.data.nodeId ?? node.id);
      if (!base) return;
      setCanvasFocusId(null);
      setSpotlightFolder(null);
      if (
        shouldAutoEnableNeighborhoodFocus(
          isLargeGraph,
          neighborhoodFocusTouchedRef.current,
          neighborhoodFocus,
        )
      ) {
        setNeighborhoodFocus(true);
      }
      setSelected(enrichNodeForDetails(base, graph, nodeById));
    },
    [graph, nodeById, expandClusterFolder, collapseClusterFolder, expandedFolders, isLargeGraph, neighborhoodFocus],
  );

  const onNeighborhoodFocusChange = useCallback((enabled: boolean) => {
    neighborhoodFocusTouchedRef.current = true;
    setNeighborhoodFocus(enabled);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelected(null);
    setSpotlightFolder(null);
    setHelperLines([]);
  }, []);

  const onNodeDrag: OnNodeDrag<Node<AtlasNodeData>> = useCallback(
    (_event, dragged) => {
      const { lines } = computeHelperLines(dragged as Node<AtlasNodeData>, nodes);
      setHelperLines(lines);
    },
    [nodes],
  );

  const onNodeDragStop: OnNodeDrag<Node<AtlasNodeData>> = useCallback(
    (_event, dragged) => {
      setNodes((current) => {
        const { snapX, snapY } = computeHelperLines(dragged as Node<AtlasNodeData>, current);
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
                  : node,
              );

        if (graphKey) {
          saveNodePositions(graphKey, nodePositionsFromNodes(next));
        }

        return next;
      });
      setHelperLines([]);
    },
    [setNodes, graphKey],
  );

  const showFromEntry = useCallback(() => {
    if (!graph) return;
    const entries = findEntryNodes(graph);
    if (entries.length === 0) return;

    const entry = entries[0]!;
    setClusterMode(false);
    setFullyExpandedFolders(new Set());
    setPartialReveals(new Map());
    if (isLargeGraph && !FORCE_FULL_GRAPH) {
      setSearch(entry.name);
    } else {
      setSearch("");
    }
    setSelected(enrichNodeForDetails(entry, graph, nodeById));
    setSpotlightFolder(null);
    setFocusOnSelect(true);
    setCanvasFocusId(null);
  }, [graph, nodeById, isLargeGraph]);

  const applyLayout = useCallback(
    (preset: LayoutPreset) => {
      setLayoutPreset(preset);
      saveLayoutPreset(preset);
      setNodes((current) =>
        relayoutFlowNodes(current, baseEdgesRef.current, {
          mode: preset,
          entryIds,
          graph: graph ?? undefined,
        }),
      );
      setRelayoutNonce((value) => value + 1);
      setFocusOnSelect(true);
    },
    [setNodes, entryIds, graph],
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
    [],
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
    [graph, clusterMode, neighborhoodFocus, nodes.length, selected, layoutPreset, edgeVisibility],
  );

  const commandPaletteActions = useMemo<CommandPaletteActions>(
    () => ({
      onJumpToNode: focusGraphNode,
      onShowFromEntry: showFromEntry,
      onApplyLayout: applyLayout,
      onCycleLayout: cycleLayout,
      onToggleClusterMode: () => {
        setClusterMode((enabled) => {
          const next = !enabled;
          if (!next) {
            setFullyExpandedFolders(new Set());
            setPartialReveals(new Map());
          }
          return next;
        });
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
        setFocusOnSelect(true);
        setCanvasFocusId(selected.id);
      },
      onCopySelectedName: () => {
        if (selected?.name) void copyText(selected.name);
      },
      onCopySelectedPath: () => {
        if (selected?.file && selected.file !== "external") void copyText(selected.file);
      },
      onHideEdgeType: (type) => {
        onEdgeVisibilityChange(type, false);
      },
      onShowAllEdges: showAllEdges,
    }),
    [focusGraphNode, showFromEntry, applyLayout, cycleLayout, selected, copyText, onEdgeVisibilityChange, showAllEdges],
  );

  const mainPanelDefault = useMemo(() => defaultMainPanelRect(), []);
  const detailsPanelDefault = useMemo(() => defaultDetailsPanelRect(), []);

  const canvasMessage = graph
    ? emptyViewMessage(
        viewSelection.mode,
        graph.nodes.length,
        viewSelection.matchCount,
        searchLower,
      )
    : "";

  if (error) {
    return (
      <div className="graph-shell graph-shell--empty">
        <div className="graph-panel">
          <p className="graph-panel__eyebrow">React Atlas</p>
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
          <p className="graph-panel__eyebrow">React Atlas</p>
          <h1>Loading graph…</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-shell">
      <MobileBanner />
      <CommandPalette state={commandPaletteState} actions={commandPaletteActions} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={flowNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        defaultEdgeOptions={COMPACT_EDGE_DEFAULTS}
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
        zoomOnDoubleClick
        minZoom={0.25}
        maxZoom={2}
        proOptions={PRO_OPTIONS}
      >
        <ViewportPersistence graphKey={graphKey} enabled={Boolean(graphKey)} />
        <ExportBridge projectName={graph.meta?.projectName} graphKey={graphKey} />
        <FitViewBridge />
        <FitViewOnce
          viewKey={`${viewKey}:r${relayoutNonce}`}
          nodeCount={nodes.length}
          skip={hasSavedViewportRef.current && relayoutNonce === 0}
        />
        <FocusOnSelect
          nodeId={spotlightFolder ? null : canvasFocusId ?? selected?.id ?? null}
          nodeIds={spotlightFolder ? spotlightFitIds : null}
          enabled={focusOnSelect}
        />
        {selected && !selected.cluster && (
          <NodeToolbarActions
            node={selected}
            onFocus={() => setFocusOnSelect(true)}
          />
        )}

        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--atlas-canvas-grid)" />
        <ZoomControls />
        <HelperLinesOverlay lines={helperLines} />

        {!isLargeGraph && (
          <MiniMap
            nodeColor={(node) =>
              typeColors[node.data.type as keyof typeof typeColors] ?? "#64748b"
            }
            maskColor="rgba(17, 17, 17, 0.85)"
            style={{
              background: "var(--atlas-surface)",
              border: "1px solid var(--atlas-border)",
              borderRadius: "var(--atlas-radius-xl)",
            }}
            pannable
          />
        )}

        {(canvasMessage || isBuilding) && (
          <Panel position="top-center" className="graph-canvas-notice">
            {isBuilding ? "Building view…" : canvasMessage}
          </Panel>
        )}
      </ReactFlow>

      {graph.meta?.insights && graph.meta.insights.length > 0 && (
        <InsightsBadge insights={graph.meta.insights} />
      )}

      <FloatingPanel
        id="main"
        defaultRect={mainPanelDefault}
        minimizedLabel={graph.meta?.projectName ?? "Explorer"}
      >
        <div className="graph-sidebar graph-sidebar--main">
          <div className="graph-sidebar__sticky">
            <div className="graph-sidebar__header graph-sidebar__header--compact">
              <div className="graph-sidebar__title-row">
                <div>
                  {graph.meta?.projectName && (
                    <p className="graph-sidebar__project">{graph.meta.projectName}</p>
                  )}
                  <p className="graph-sidebar__stats graph-sidebar__stats--inline">
                    {graph.nodes.length} nodes · {graph.edges.length} edges
                  </p>
                </div>
              </div>
              <div className="graph-sidebar__header-actions">
                <PanelMinimizeButton />
              </div>
            </div>
            <div className="graph-sidebar__search-wrap">
              <input
                className="graph-search graph-search--sticky"
                type="search"
                placeholder="Search nodes…"
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
              spotlightFolder={spotlightFolder}
              onEntryClick={onOverviewEntryClick}
              onFolderClick={onOverviewFolderClick}
              onHubClick={onOverviewHubClick}
            />

            <GraphActions
              clusterMode={clusterMode}
              onClusterModeChange={(enabled) => {
                setClusterMode(enabled);
                if (!enabled) {
                  setFullyExpandedFolders(new Set());
                  setPartialReveals(new Map());
                }
              }}
              neighborhoodFocus={neighborhoodFocus}
              onNeighborhoodFocusChange={onNeighborhoodFocusChange}
              neighborhoodHops={neighborhoodHops}
              onNeighborhoodHopsChange={setNeighborhoodHops}
              focusOnSelect={focusOnSelect}
              onFocusOnSelectChange={setFocusOnSelect}
              edgeVisibility={edgeVisibility}
              onEdgeVisibilityChange={onEdgeVisibilityChange}
              expandedFolders={expandedFolders}
              onShowFromEntry={showFromEntry}
              onCollapseFolders={() => {
                if (expandedFolders.length === 1) {
                  collapseClusterFolder(expandedFolders[0]!);
                } else {
                  collapseAllClusterFolders();
                }
              }}
              onLayoutPresetChange={applyLayout}
              layoutPreset={layoutPreset}
              layoutDisabled={nodes.length === 0}
            />

            {isLargeGraph && (
              <p className="graph-notice">
                {FORCE_FULL_GRAPH
                  ? "Large graph — full render mode. Use cluster folders if slow."
                  : viewSelection.mode === "overview"
                    ? "Large graph — folder overview loaded. Expand folders or search to drill in."
                    : "Large graph — search or click folders to expand nearby nodes gradually."}
              </p>
            )}
            {graph.meta?.notice && <p className="graph-notice">{graph.meta.notice}</p>}

            <div className="graph-legend">
              {legendTypes.map((type) => (
                <span key={type} className="graph-legend__item">
                  <span
                    className="graph-legend__swatch"
                    style={{ background: typeColors[type] }}
                  />
                  {type}
                </span>
              ))}
            </div>

            {spotlightFolder && !selected && (
              <p className="graph-sidebar__hint">
                <span className="graph-sidebar__hint-label">
                  <span className="field-label">
                    <span className="field-label__text">Folder spotlight</span>
                    <InfoTip text="Nodes in this folder stay fully visible; everything else is dimmed. Click the canvas or the same folder again to clear." />
                  </span>
                </span>
                {spotlightFolder} · {highlightIds?.size ?? 0} node
                {(highlightIds?.size ?? 0) === 1 ? "" : "s"} highlighted
              </p>
            )}
            {selected && pathIds.length > 0 && (
              <p className="graph-sidebar__hint">
                <span className="graph-sidebar__hint-label">
                  <span className="field-label">
                    <span className="field-label__text">Boot path</span>
                    <InfoTip text="Shortest chain from an app entry file to the selected node." />
                  </span>
                </span>
                {pathIds.map((id) => nodeById.get(id)?.name ?? id).join(" → ")}
              </p>
            )}
            {selected && neighborhoodFocus && pathIds.length === 0 && (
              <p className="graph-sidebar__hint">
                <span className="graph-sidebar__hint-label">
                  <span className="field-label">
                    <span className="field-label__text">Nearby focus</span>
                    <InfoTip text="Only the selected node and its connections within the chosen depth stay fully visible." />
                  </span>
                </span>
                Showing {highlightIds?.size ?? 0} nodes within {neighborhoodHops} hop
                {neighborhoodHops === 1 ? "" : "s"} — everything else is dimmed.
              </p>
            )}
          </div>
        </div>
      </FloatingPanel>

      {selected && !selected.cluster && (
        <FloatingPanel
          id="details"
          className="floating-panel--details"
          defaultRect={detailsPanelDefault}
          minimizedLabel={selected.name}
        >
          <NodeDetails
            node={selected}
            projectRoot={graph.meta?.targetDir}
            onClose={() => setSelected(null)}
          />
        </FloatingPanel>
      )}
    </div>
  );
}
