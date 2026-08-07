import { useEffect, useRef, useState } from "react";
import { NodeToolbar, Position, useReactFlow } from "@xyflow/react";
import type { AtlasGraphNode } from "./types";

type Props = {
  node: AtlasGraphNode;
  onFocus: () => void;
};

type CopiedAction = "name" | "path";

const COPY_FEEDBACK_MS = 1400;

function CheckIcon() {
  return (
    <svg
      className="node-toolbar__check"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
    >
      <path
        d="M3 8.5 6.5 12 13 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NodeToolbarActions({ node, onFocus }: Props) {
  const { fitView } = useReactFlow();
  const [copied, setCopied] = useState<CopiedAction | null>(null);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const showCopied = (action: CopiedAction) => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    setCopied(action);
    resetTimerRef.current = window.setTimeout(() => {
      setCopied(null);
      resetTimerRef.current = null;
    }, COPY_FEEDBACK_MS);
  };

  const copyText = async (text: string, action: CopiedAction) => {
    try {
      await navigator.clipboard.writeText(text);
      showCopied(action);
    } catch {
      // clipboard may be blocked
    }
  };

  const focusNode = () => {
    onFocus();
    fitView({
      nodes: [{ id: node.id }],
      padding: 0.55,
      duration: 350,
      maxZoom: 1.4,
    });
  };

  return (
    <NodeToolbar nodeId={node.id} position={Position.Top} isVisible offset={8}>
      <div className="node-toolbar">
        <button type="button" onClick={focusNode} title="Focus node">
          focus
        </button>
        <button
          type="button"
          className={
            copied === "name" ? "node-toolbar__btn--copied" : undefined
          }
          onClick={() => copyText(node.name, "name")}
          title="Copy symbol name"
        >
          {copied === "name" ? (
            <>
              <CheckIcon />
              copied
            </>
          ) : (
            "copy name"
          )}
        </button>
        <button
          type="button"
          className={
            copied === "path" ? "node-toolbar__btn--copied" : undefined
          }
          onClick={() => copyText(node.file, "path")}
          title="Copy file path"
        >
          {copied === "path" ? (
            <>
              <CheckIcon />
              copied
            </>
          ) : (
            "copy path"
          )}
        </button>
      </div>
    </NodeToolbar>
  );
}
