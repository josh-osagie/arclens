import type { Edge, Node } from "@xyflow/react";
import {
  DEFAULT_LAYOUT_PRESET,
  getDagreLayoutedNodes,
  getDagreLayoutedNodesAsync,
  layoutNodesByPreset,
  layoutNodesByPresetAsync,
  nodeLayoutDimensions,
  type LayoutContext,
  type LayoutPreset,
} from "./layoutPresets";
import {
  formatEdgeTypeLabel,
  mergeSameDirectionEdges,
  primaryEdgeType,
  strokeColorForEdgeTypes,
} from "./mergeFlowEdges";
import type { AtlasGraph, AtlasGraphNode } from "./types";

export { edgeColors, nodeTypes, typeColors, typeLabels } from "./design/tokens";

export type AtlasNodeData = {
  label: string;
  type: AtlasGraphNode["type"];
  fileLabel?: string;
  nodeId: string;
  compact?: boolean;
  selected?: boolean;
  dimmed?: boolean;
};

export type ClusterNodeData = {
  label: string;
  folder: string;
  count: number;
  selected?: boolean;
  dimmed?: boolean;
};

function applyEmbeddedLayouts(
  graph: AtlasGraph,
  nodes: Node<AtlasNodeData>[]
): Node<AtlasNodeData>[] | null {
  const positionById = new Map(
    graph.nodes
      .filter((node) => node.layout)
      .map((node) => [node.id, node.layout!])
  );

  // Cluster bubbles and filtered views lack graph.json layout — use dagre for everyone.
  const allHaveEmbeddedLayout =
    positionById.size > 0 && nodes.every((node) => positionById.has(node.id));

  if (!allHaveEmbeddedLayout) return null;

  return nodes.map((node) => {
    const saved = positionById.get(node.id)!;
    const { width, height } = nodeLayoutDimensions(node);
    return {
      ...node,
      position: {
        x: saved.x - width / 2,
        y: saved.y - height / 2,
      },
    };
  });
}

function layoutNodes(
  graph: AtlasGraph,
  nodes: Node<AtlasNodeData>[],
  edges: Edge[],
  entryIds: string[] = []
) {
  if (nodes.length === 0) return nodes;

  const embedded = applyEmbeddedLayouts(graph, nodes);
  if (embedded) return embedded;

  return getDagreLayoutedNodes(nodes, edges, "TB", entryIds);
}

/** Async layout for interactive builds — worker-backed dagre with sync fallback. */
export async function layoutFlowGraphNodesAsync(
  graph: AtlasGraph,
  nodes: Node<AtlasNodeData>[],
  edges: Edge[],
  entryIds: string[] = []
): Promise<Node<AtlasNodeData>[]> {
  if (nodes.length === 0) return nodes;

  const embedded = applyEmbeddedLayouts(graph, nodes);
  if (embedded) return embedded;

  return getDagreLayoutedNodesAsync(nodes, edges, "TB", entryIds);
}

export type RelayoutOptions = LayoutContext & {
  mode?: LayoutPreset;
  /** @deprecated Use mode instead */
  compact?: boolean;
};

/** Re-layout visible nodes; ignores saved graph.json positions. */
export function relayoutFlowNodes(
  nodes: Node<AtlasNodeData>[],
  edges: Edge[],
  options: RelayoutOptions = {}
): Node<AtlasNodeData>[] {
  if (nodes.length === 0) return nodes;

  const mode = options.mode ?? DEFAULT_LAYOUT_PRESET;
  return layoutNodesByPreset(nodes, edges, mode, {
    entryIds: options.entryIds,
    graph: options.graph,
  });
}

/** Async re-layout for interactive preset changes. */
export async function relayoutFlowNodesAsync(
  nodes: Node<AtlasNodeData>[],
  edges: Edge[],
  options: RelayoutOptions = {}
): Promise<Node<AtlasNodeData>[]> {
  if (nodes.length === 0) return nodes;

  const mode = options.mode ?? DEFAULT_LAYOUT_PRESET;
  return layoutNodesByPresetAsync(nodes, edges, mode, {
    entryIds: options.entryIds,
    graph: options.graph,
  });
}

export function buildFlowGraph(
  graph: AtlasGraph,
  options: { compact?: boolean; entryIds?: string[]; skipLayout?: boolean } = {}
): {
  nodes: Node<AtlasNodeData>[];
  edges: Edge[];
} {
  const compact = options.compact ?? false;
  const entryIds = options.entryIds ?? graph.meta?.entryNodeIds ?? [];
  const skipLayout = options.skipLayout ?? false;

  const initialNodes: Node<AtlasNodeData>[] = graph.nodes.map((node) => {
    if (node.cluster) {
      return {
        id: node.id,
        type: "cluster",
        position: { x: 0, y: 0 },
        draggable: true,
        data: {
          label: node.name,
          folder: node.cluster.folder,
          count: node.cluster.count,
        },
      } as unknown as Node<AtlasNodeData>;
    }

    return {
      id: node.id,
      type: "atlas",
      position: { x: 0, y: 0 },
      draggable: true,
      data: {
        label: node.name,
        type: node.type,
        fileLabel: node.file === "external" ? undefined : relFile(node.file),
        nodeId: node.id,
        compact,
      },
    };
  });

  const mergedEdges = mergeSameDirectionEdges(graph.edges);
  const initialEdges: Edge[] = mergedEdges.map((edge, i) => {
    const stroke = strokeColorForEdgeTypes(edge.types);
    const primaryType = primaryEdgeType(edge.types);

    return {
      id: `e${i}`,
      source: edge.from,
      target: edge.to,
      data: {
        edgeType: primaryType,
        edgeTypes: edge.types,
      },
      label: compact ? undefined : formatEdgeTypeLabel(edge.types),
      type: "smoothstep",
      pathOptions: { borderRadius: 0, offset: 24 },
      animated: false,
      style: {
        stroke,
        strokeWidth: compact ? 1.25 : 2,
      },
      ...(compact
        ? {}
        : {
            labelStyle: {
              fill: "#e2e8f0",
              fontSize: 11,
              fontWeight: 600,
            },
            labelBgStyle: {
              fill: "#1e293b",
              fillOpacity: 0.9,
            },
            labelBgPadding: [6, 4] as [number, number],
            labelBgBorderRadius: 4,
          }),
      markerEnd: {
        type: "arrowclosed" as const,
        color: stroke,
      },
    };
  });

  return {
    nodes: skipLayout
      ? initialNodes
      : layoutNodes(graph, initialNodes, initialEdges, entryIds),
    edges: initialEdges,
  };
}

export function relFile(filePath: string): string {
  if (filePath === "external") return "external";
  const parts = filePath.replace(/\\/g, "/").split("/");
  const samplesIdx = parts.lastIndexOf("samples");
  if (samplesIdx >= 0) {
    return parts.slice(samplesIdx).join("/");
  }
  return parts.slice(-2).join("/") || filePath;
}

export function formatRelativePath(
  filePath: string,
  projectRoot?: string
): string {
  const normalized = filePath.replace(/\\/g, "/");

  if (projectRoot) {
    const root = projectRoot.replace(/\\/g, "/").replace(/\/+$/, "");
    const rootLower = root.toLowerCase();
    const fileLower = normalized.toLowerCase();

    if (fileLower === rootLower) {
      const slash = normalized.lastIndexOf("/");
      return slash >= 0 ? normalized.slice(slash + 1) : normalized;
    }

    const prefix = `${rootLower}/`;
    if (fileLower.startsWith(prefix)) {
      return normalized.slice(root.length + 1);
    }
  }

  const srcMatch = normalized.match(/(?:^|\/)((?:src|app|pages)\/.+)$/);
  if (srcMatch?.[1]) {
    return srcMatch[1];
  }

  return relFile(normalized);
}

export function truncatePath(filePath: string, maxLength = 42): string {
  if (filePath.length <= maxLength) return filePath;
  return `…${filePath.slice(-(maxLength - 1))}`;
}
