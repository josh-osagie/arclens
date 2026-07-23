import { useViewport } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import type { AtlasNodeData } from "./buildFlowGraph";

export type HelperLine = {
  orientation: "horizontal" | "vertical";
  position: number;
};

const SNAP = 8;
const NODE_W = 196;
const NODE_H = 88;
const LINE_EXTENT = 10000;

export function computeHelperLines(
  dragged: Node<AtlasNodeData>,
  others: Node<AtlasNodeData>[],
): { lines: HelperLine[]; snapX?: number; snapY?: number } {
  const cx = dragged.position.x + NODE_W / 2;
  const cy = dragged.position.y + NODE_H / 2;

  const lines: HelperLine[] = [];
  let snapX: number | undefined;
  let snapY: number | undefined;

  for (const node of others) {
    if (node.id === dragged.id) continue;
    const ocx = node.position.x + NODE_W / 2;
    const ocy = node.position.y + NODE_H / 2;

    if (Math.abs(cx - ocx) <= SNAP) {
      lines.push({ orientation: "vertical", position: ocx });
      snapX = ocx - NODE_W / 2;
    }
    if (Math.abs(cy - ocy) <= SNAP) {
      lines.push({ orientation: "horizontal", position: ocy });
      snapY = ocy - NODE_H / 2;
    }
  }

  return { lines, snapX, snapY };
}

export function HelperLinesOverlay({ lines }: { lines: HelperLine[] }) {
  const { x, y, zoom } = useViewport();

  if (lines.length === 0) return null;

  return (
    <svg className="helper-lines-svg" aria-hidden="true">
      <g transform={`translate(${x}, ${y}) scale(${zoom})`}>
        {lines.map((line, index) =>
          line.orientation === "vertical" ? (
            <line
              key={`v-${index}`}
              x1={line.position}
              y1={-LINE_EXTENT}
              x2={line.position}
              y2={LINE_EXTENT}
              className="helper-line"
            />
          ) : (
            <line
              key={`h-${index}`}
              x1={-LINE_EXTENT}
              y1={line.position}
              x2={LINE_EXTENT}
              y2={line.position}
              className="helper-line"
            />
          ),
        )}
      </g>
    </svg>
  );
}
