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
  getConnectedNodeIds,
  nodeTypes as legendTypes,
  type AtlasNodeData,
  typeColors,
} from "./buildFlowGraph";
import { NodeDetails } from "./NodeDetails";
import type { AtlasGraph, AtlasGraphNode } from "./types";
import "./graph.css";

const flowNodeTypes = {
  atlas: AtlasNode,
};

const POLL_MS = 2000;

function graphSignature(graph: AtlasGraph): string {
  return JSON.stringify({
    nodes: graph.nodes.map((node) => `${node.id}:${node.type}:${node.name}`),
    edges: graph.edges.map((edge) => `${edge.from}|${edge.to}|${edge.type}`),
  });
}

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
  selected: AtlasGraphNode | null,
): Node<AtlasNodeData>[] {
  const connectedIds = selected ? getConnectedNodeIds(selected) : null;

  return nodes.map((node) => {
    const matchesSearch =
      !searchLower || node.data.label.toLowerCase().includes(searchLower);
    const isSelected = selected?.id === node.id;
    const isConnected = connectedIds?.has(node.id) ?? false;

    let opacity = 1;
    if (searchLower && !matchesSearch) opacity = 0.22;
    if (selected && !isSelected && !isConnected) opacity = 0.28;

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
  selected: AtlasGraphNode | null,
): Edge[] {
  if (!selected) return edges;

  const connectedIds = getConnectedNodeIds(selected);
  return edges.map((edge) => ({
    ...edge,
    style: {
      ...edge.style,
      opacity:
        connectedIds.has(edge.source) && connectedIds.has(edge.target) ? 1 : 0.12,
    },
  }));
}

function FitViewOnce({ nodeCount }: { nodeCount: number }) {
  const { fitView } = useReactFlow();
  const hasFit = useRef(false);

  useEffect(() => {
    if (hasFit.current || nodeCount === 0) return;

    const timer = window.setTimeout(() => {
      fitView({ padding: 0.22, duration: 280 });
      hasFit.current = true;
    }, 80);

    return () => window.clearTimeout(timer);
  }, [fitView, nodeCount]);

  return null;
}

export default function App() {
  const [graph, setGraph] = useState<AtlasGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AtlasGraphNode | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<AtlasNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const graphSigRef = useRef<string>("");
  const searchLower = search.trim().toLowerCase();

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
    const interval = window.setInterval(loadGraph, POLL_MS);
    return () => window.clearInterval(interval);
  }, [loadGraph]);

  useEffect(() => {
    if (!graph) return;

    const signature = graphSignature(graph);
    if (signature === graphSigRef.current) return;

    graphSigRef.current = signature;
    const built = buildFlowGraph(graph);

    setNodes((current) =>
      applyNodePresentation(mergeNodePositions(built.nodes, current), searchLower, selected),
    );
    setEdges(built.edges);
  }, [graph, searchLower, selected, setNodes, setEdges]);

  useEffect(() => {
    setNodes((current) => applyNodePresentation(current, searchLower, selected));
  }, [searchLower, selected, setNodes]);

  const visibleEdges = useMemo(
    () => applyEdgePresentation(edges, selected),
    [edges, selected],
  );

  const onNodeClick = useCallback(
    (_event: MouseEvent, node: Node<AtlasNodeData>) => {
      setSelected(node.data.graphNode);
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setSelected(null);
  }, []);

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
        panOnDrag
        panOnScroll
        zoomOnScroll
        minZoom={0.25}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <FitViewOnce nodeCount={nodes.length} />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#333333" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) =>
            typeColors[node.data.type as keyof typeof typeColors] ?? "#64748b"
          }
          maskColor="rgba(10, 15, 28, 0.82)"
          style={{ background: "#111827", border: "1px solid #334155", borderRadius: 10 }}
        />

        <Panel position="top-left" className="graph-panel">
          <h1>React Atlas</h1>
          <p>
            {graph.nodes.length} nodes · {graph.edges.length} edges
          </p>
          {graph.meta?.notice && (
            <p className="graph-notice">{graph.meta.notice}</p>
          )}
          <input
            className="graph-search"
            type="search"
            placeholder="Search nodes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
          <Panel position="top-right" className="graph-details-panel">
            <NodeDetails node={selected} onClose={() => setSelected(null)} />
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
