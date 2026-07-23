import type { AtlasGraphNode } from "./types";
import { relFile } from "./buildFlowGraph";

type Props = {
  node: AtlasGraphNode;
  onClose: () => void;
};

function ConnectionGroup({
  title,
  items,
}: {
  title: string;
  items: AtlasGraphNode["connections"]["incoming"];
}) {
  if (items.length === 0) {
    return (
      <div className="details-section">
        <h3>{title}</h3>
        <p className="details-empty">none</p>
      </div>
    );
  }

  return (
    <div className="details-section">
      <h3>{title}</h3>
      <ul className="details-list">
        {items.map((conn) => (
          <li key={`${conn.nodeId}-${conn.edgeType}`}>
            <span className="details-list__name">{conn.name}</span>
            <span className="details-list__meta">
              {conn.edgeType} · {conn.file}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NodeDetails({ node, onClose }: Props) {
  const incoming = {
    imports: node.connections.incoming.filter((c) => c.edgeType === "imports"),
    renders: node.connections.incoming.filter((c) => c.edgeType === "renders"),
    uses: node.connections.incoming.filter((c) => c.edgeType === "uses"),
  };

  const outgoing = {
    imports: node.connections.outgoing.filter((c) => c.edgeType === "imports"),
    renders: node.connections.outgoing.filter((c) => c.edgeType === "renders"),
    uses: node.connections.outgoing.filter((c) => c.edgeType === "uses"),
  };

  return (
    <div className="graph-panel graph-details">
      <div className="graph-details__header">
        <h2>{node.name}</h2>
        <button type="button" className="graph-details__close" onClick={onClose}>
          ×
        </button>
      </div>

      <dl className="details-meta">
        <div>
          <dt>Type</dt>
          <dd>{node.type}</dd>
        </div>
        <div>
          <dt>File</dt>
          <dd>{relFile(node.file)}</dd>
        </div>
        {node.exportKind && (
          <div>
            <dt>Export</dt>
            <dd>{node.exportKind}</dd>
          </div>
        )}
        {node.kind && (
          <div>
            <dt>AST kind</dt>
            <dd>{node.kind}</dd>
          </div>
        )}
        <div>
          <dt>Usage</dt>
          <dd>
            {node.stats.incoming} incoming · {node.stats.outgoing} outgoing
          </dd>
        </div>
      </dl>

      <ConnectionGroup title="Imported by" items={incoming.imports} />
      <ConnectionGroup title="Rendered by" items={incoming.renders} />
      <ConnectionGroup title="Hook-used by" items={incoming.uses} />
      <ConnectionGroup title="Imports" items={outgoing.imports} />
      <ConnectionGroup title="Renders" items={outgoing.renders} />
      <ConnectionGroup title="Uses hooks" items={outgoing.uses} />
    </div>
  );
}
