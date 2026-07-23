import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
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

const flowNodeTypes = {
  atlas: AtlasNode,
};

const POLL_MS = 2000;

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

function applyNodePresentation(
  nodes: Node<AtlasNodeData>[],
  searchLower: string,
  selectedId: string | null,
  connectedIds: Set<string> | null,
): Node<AtlasNodeData>[] {
  return nodes.map((node) => {
    const matchesSearch =
      !searchLower || node.data.label.toLowerCase().includes(searchLower);
    const isSelected = selectedId === node.id;
    const isConnected = connectedIds?.has(node.id) ?? false;

    let opacity = 1;
    if (searchLower && !matchesSearch) opacity = 0.22;
    if (selectedId && !isSelected && !isConnected) opacity = 0.28;

    return {
      ...node,
      selected: isSelected,
      style: { ...node.style, opacity },
      data: {
        ...node.data,
        selected: isSelected,
        dimmed: opacity < 1,
      },
    };
  });
}

function applyEdgePresentation(
  edges: Edge[],
  connectedIds: Set<string> | null,
): Edge[] {
  if (!connectedIds) return edges;

  return edges.map((edge) => ({
    ...edge,
    style: {
      ...edge.style,
      opacity:
        connectedIds.has(edge.source) && connectedIds.has(edge.target) ? 1 : 0.12,
    },
  }));
}

function FitViewOnce({ viewKey, nodeCount }: { viewKey: string; nodeCount: number }) {
  const { fitView } = useReactFlow();
  const lastKey = useRef("");

  useEffect(() => {
    if (nodeCount === 0 || lastKey.current === viewKey) return;

    const timer = window.setTimeout(() => {
      fitView({ padding: 0.22, duration: 280 });
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
    return `This graph has ${totalNodes.toLocaleString()} nodes — too large to render at once. Search for a component, hook, or file to explore its neighborhood.`;
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
  const searchLower = search.trim().toLowerCase();

  const isLargeGraph = (graph?.nodes.length ?? 0) > LARGE_GRAPH_THRESHOLD;

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
      setNodes((current) =>
        applyNodePresentation(
          mergeNodePositions(built.nodes, current),
          searchLower,
          selected?.id ?? null,
          connectedIds,
        ),
      );
      setEdges(built.edges);
      setIsBuilding(false);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    graph,
    displayGraph,
    viewKey,
    isLargeGraph,
    searchLower,
    selected?.id,
    connectedIds,
    setNodes,
    setEdges,
  ]);

  useEffect(() => {
    setNodes((current) =>
      applyNodePresentation(current, searchLower, selected?.id ?? null, connectedIds),
    );
  }, [searchLower, selected?.id, connectedIds, setNodes]);

  const visibleEdges = useMemo(
    () => applyEdgePresentation(edges, connectedIds),
    [edges, connectedIds],
  );

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
        edges={visibleEdges}
        nodeTypes={flowNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        selectNodesOnDrag={false}
        onlyRenderVisibleElements={isLargeGraph}
        panOnDrag
        panOnScroll
        zoomOnScroll
        minZoom={0.25}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
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
              Large graph — search to explore. Edge labels and minimap are off.
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
