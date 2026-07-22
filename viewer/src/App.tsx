import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AtlasNode } from "./AtlasNode";
import { nodeTypes as legendTypes, rfEdges, rfNodes, typeColors } from "./utils";
import "./graph.css";

const nodeTypes = {
  atlas: AtlasNode,
};

export default function App() {
  return (
    <div className="graph-shell">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.4}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => typeColors[node.data.type as keyof typeof typeColors] ?? "#64748b"}
          maskColor="rgba(15, 23, 42, 0.75)"
          style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
        />

        <Panel position="top-left" className="graph-panel">
          <h1>React Atlas</h1>
          <p>Architecture graph from static analysis</p>
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
      </ReactFlow>
    </div>
  );
}
