import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AtlasNode } from "./AtlasNode";
import {
  buildFlowGraph,
  nodeTypes as legendTypes,
  type AtlasNodeData,
  typeColors,
} from "./buildFlowGraph";
import {
  buildNodeById,
  enrichNodeForDetails,
  getConnectedNodeIdsFromEdges,
  graphSignature,
} from "./graphConnections";
import { NodeDetails } from "./NodeDetails";
import type { AtlasGraph, AtlasGraphNode } from "./types";
import {
  LARGE_GRAPH_THRESHOLD,
  selectVisibleGraph,
  type ViewGraphMode,
} from "./viewGraph";
import "./graph.css";

const flowNodeTypes = { atlas: AtlasNode };

const POLL_MS = 2000;
const VIRTUALIZE_THRESHOLD = 100;

/** Static options — avoid new object refs each render (React Flow perf guide). */
const PRO_OPTIONS = { hideAttribution: true } as const;
const COMPACT_EDGE_DEFAULTS = {
  animated: false,
  type: "default" as const,
} as const;

function mergeNodePositions(
  nextNodes: Node<AtlasNodeData>[],
  currentNodes: Node<AtlasNodeData>[],
): Node<AtlasNodeData>[] {
  const positions = new Map(currentNodes.map((node) => [node.id, node.position]));

  return nextNodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
    draggable: true,
  }));
}

function nodeOpacity(
  node: Node<AtlasNodeData>,
  searchLower: string,
  selectedId: string | null,
  connectedIds: Set<string> | null,
): number {
  const matchesSearch =
    !searchLower || node.data.label.toLowerCase().includes(searchLower);

  if (selectedId) {
    if (node.id === selectedId) return 1;
    if (connectedIds?.has(node.id)) return 1;
    return 0.28;
  }

  if (searchLower && !matchesSearch) return 0.22;
  return 1;
}

/** Patch only nodes whose presentation changed — keeps stable refs elsewhere. */
function patchNodePresentation(
  nodes: Node<AtlasNodeData>[],
  searchLower: string,
  selectedId: string | null,
  connectedIds: Set<string> | null,
): Node<AtlasNodeData>[] {
  let changed = false;

  const next = nodes.map((node) => {
    const opacity = nodeOpacity(node, searchLower, selectedId, connectedIds);
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
      data: {
        ...node.data,
        selected: isSelected,
        dimmed,
      },
    };
  });

  return changed ? next : nodes;
}

function patchEdgePresentation(
  edges: Edge[],
  connectedIds: Set<string> | null,
  highlightEdges: boolean,
): Edge[] {
  if (!highlightEdges || !connectedIds) return edges;

  let changed = false;
  const next = edges.map((edge) => {
    const highlighted =
      connectedIds.has(edge.source) && connectedIds.has(edge.target);
    const opacity = highlighted ? 1 : 0.12;
    const prevOpacity = edge.style?.opacity ?? 1;

    if (prevOpacity === opacity && edge.animated === false) {
      return edge;
    }

    changed = true;
    return {
      ...edge,
      animated: false,
      style: { ...edge.style, opacity },
    };
  });

  return changed ? next : edges;
}

function FitViewOnce({ viewKey, nodeCount }: { viewKey: string; nodeCount: number }) {
  const { fitView } = useReactFlow();
  const lastKey = useRef("");

  useEffect(() => {
    if (nodeCount === 0 || lastKey.current === viewKey) return;

    const timer = window.setTimeout(() => {
      fitView({ padding: 0.22, duration: nodeCount > VIRTUALIZE_THRESHOLD ? 0 : 280 });
      lastKey.current = viewKey;
    }, 80);

    return () => window.clearTimeout(timer);
  }, [fitView, nodeCount, viewKey]);

  return null;
}

function emptyViewMessage(
  mode: ViewGraphMode,
  totalNodes: number,
  matchCount: number,
  searchLower: string,
): string {
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

export default function App() {
  const [graph, setGraph] = useState<AtlasGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AtlasGraphNode | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<AtlasNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const buildSigRef = useRef<string>("");
  const baseEdgesRef = useRef<Edge[]>([]);

  const deferredSearch = useDeferredValue(search);
  const searchLower = deferredSearch.trim().toLowerCase();

  const isLargeGraph = (graph?.nodes.length ?? 0) > LARGE_GRAPH_THRESHOLD;
  const shouldVirtualize = nodes.length > VIRTUALIZE_THRESHOLD;

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

  const displayGraph = viewSelection.graph;
  const viewKey = `${graphSignature(displayGraph)}:${searchLower}`;

  const nodeById = useMemo(
    () => (graph ? buildNodeById(graph) : new Map<string, AtlasGraphNode>()),
    [graph],
  );

  const connectedIds = useMemo(() => {
    if (!selected || !graph) return null;
    return getConnectedNodeIdsFromEdges(selected.id, graph.edges);
  }, [selected, graph]);

  const loadGraph = useCallback(async () => {
    try {
      const res = await fetch("/graph.json");
      if (!res.ok) {
        throw new Error("graph.json not found. Run pnpm analyze first.");
      }
      const data = (await res.json()) as AtlasGraph;
      setGraph(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load graph.json");
    }
  }, []);

  useEffect(() => {
    loadGraph();
    if (isLargeGraph) return undefined;

    const interval = window.setInterval(loadGraph, POLL_MS);
    return () => window.clearInterval(interval);
  }, [loadGraph, isLargeGraph]);

  useEffect(() => {
    if (!graph) return;
    if (buildSigRef.current === viewKey) return;

    let cancelled = false;
    setIsBuilding(true);

    const timer = window.setTimeout(() => {
      const built = buildFlowGraph(displayGraph, { compact: isLargeGraph });
      if (cancelled) return;

      buildSigRef.current = viewKey;
      baseEdgesRef.current = built.edges;

      setNodes((current) =>
        patchNodePresentation(
          mergeNodePositions(built.nodes, current),
          searchLower,
          selected?.id ?? null,
          connectedIds,
        ),
      );
      setEdges(
        patchEdgePresentation(built.edges, connectedIds, Boolean(selected)),
      );
      setIsBuilding(false);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [graph, displayGraph, viewKey, isLargeGraph, setNodes, setEdges]);

  useEffect(() => {
    setNodes((current) =>
      patchNodePresentation(current, searchLower, selected?.id ?? null, connectedIds),
    );
    setEdges((current) =>
      patchEdgePresentation(
        current.length > 0 ? current : baseEdgesRef.current,
        connectedIds,
        Boolean(selected),
      ),
    );
  }, [searchLower, selected?.id, connectedIds, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_event: MouseEvent, node: Node<AtlasNodeData>) => {
      if (!graph) return;
      const base = nodeById.get(node.data.nodeId);
      if (!base) return;
      setSelected(enrichNodeForDetails(base, graph, nodeById));
    },
    [graph, nodeById],
  );

  const onPaneClick = useCallback(() => {
    setSelected(null);
  }, []);

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
          <h1>React Atlas</h1>
          <p className="graph-error">{error}</p>
        </div>
      </div>
    );
  }

  if (!graph) {
    return (
      <div className="graph-shell graph-shell--empty">
        <div className="graph-panel">
          <h1>React Atlas</h1>
          <p>Loading graph…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-shell">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={flowNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
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
        minZoom={0.25}
        maxZoom={2}
        proOptions={PRO_OPTIONS}
      >
        <FitViewOnce viewKey={viewKey} nodeCount={nodes.length} />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--atlas-canvas-grid)" />
        <Controls showInteractive={false} />
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
          />
        )}

        {(canvasMessage || isBuilding) && (
          <Panel position="top-center" className="graph-canvas-notice">
            {isBuilding ? "Building view…" : canvasMessage}
          </Panel>
        )}

        <Panel position="top-left" className="graph-sidebar graph-sidebar--main">
          <div className="graph-sidebar__header graph-sidebar__header--compact">
            <h1>React Atlas</h1>
          </div>
          <p className="graph-sidebar__stats">
            {graph.nodes.length} nodes · {graph.edges.length} edges
          </p>
          {isLargeGraph && (
            <p className="graph-notice">
              Large graph — search to explore. Animations off, viewport culling on.
            </p>
          )}
          {graph.meta?.notice && (
            <p className="graph-notice">{graph.meta.notice}</p>
          )}
          <input
            className="graph-search"
            type="search"
            placeholder={isLargeGraph ? "Search to explore…" : "Search nodes…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus={isLargeGraph}
          />
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
        </Panel>

        {selected && (
          <Panel position="top-right" className="graph-sidebar-wrap">
            <NodeDetails node={selected} onClose={() => setSelected(null)} />
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
