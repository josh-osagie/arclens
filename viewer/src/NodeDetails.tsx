import { DetailsFieldMenu, useDetailsFieldPrefs } from "./DetailsFieldMenu";
import { FileSnippetPreview } from "./FileSnippetPreview";
import { InfoTip } from "./InfoTip";
import type { DetailsFieldPrefs } from "./detailsPanelPrefs";
import type { AtlasGraphNode, GraphConnection } from "./types";
import { relFile, typeColors } from "./buildFlowGraph";

type Props = {
  node: AtlasGraphNode;
  projectRoot?: string;
  onClose: () => void;
};

const CONNECTION_TIPS = {
  importedBy: "Files that import this symbol.",
  renderedBy: "Components that use this in JSX. Each tag counts separately.",
  calledFrom: "Files that call this hook.",
  imports: "Symbols this file imports.",
  renders: "Components this file renders in JSX.",
  callsHooks: "Hooks this file calls.",
} as const;

function FieldLabel({ label, tip }: { label: string; tip?: string }) {
  return (
    <span className="field-label">
      <span className="field-label__text">{label}</span>
      {tip ? <InfoTip text={tip} /> : null}
    </span>
  );
}

function ConnectionGroup({
  title,
  tip,
  items,
}: {
  title: string;
  tip?: string;
  items: GraphConnection[];
}) {
  const heading = (
    <h3>
      <FieldLabel label={title} tip={tip} />
    </h3>
  );

  if (items.length === 0) {
    return (
      <div className="details-section">
        {heading}
        <p className="details-empty">none</p>
      </div>
    );
  }

  return (
    <div className="details-section">
      {heading}
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

export function NodeDetails({ node, projectRoot, onClose }: Props) {
  const [fieldPrefs, setFieldPrefs] = useDetailsFieldPrefs();

  const incoming = {
    imports: (node.connections?.incoming ?? []).filter((c) => c.edgeType === "imports"),
    renders: (node.connections?.incoming ?? []).filter((c) => c.edgeType === "renders"),
    uses: (node.connections?.incoming ?? []).filter((c) => c.edgeType === "uses"),
  };

  const outgoing = {
    imports: (node.connections?.outgoing ?? []).filter((c) => c.edgeType === "imports"),
    renders: (node.connections?.outgoing ?? []).filter((c) => c.edgeType === "renders"),
    uses: (node.connections?.outgoing ?? []).filter((c) => c.edgeType === "uses"),
  };

  const usedByCount = node.stats?.incoming ?? node.connections?.incoming.length ?? 0;
  const dependsOnCount = node.stats?.outgoing ?? node.connections?.outgoing.length ?? 0;
  const accent = typeColors[node.type] ?? typeColors.utility;
  const show = (key: keyof DetailsFieldPrefs) => fieldPrefs[key];

  return (
    <div className="graph-sidebar graph-sidebar--details">
      <div className="graph-sidebar__header">
        <div className="graph-sidebar__title-row">
          <span
            className="graph-sidebar__type-dot"
            style={{ background: accent }}
            aria-hidden="true"
          />
          <h2>{node.name}</h2>
        </div>
        <div className="graph-sidebar__header-actions">
          <DetailsFieldMenu prefs={fieldPrefs} onChange={setFieldPrefs} />
          <button type="button" className="graph-sidebar__close" onClick={onClose}>
            ×
          </button>
        </div>
      </div>

      <div className="graph-sidebar__scroll atlas-scroll">
        <dl className="details-meta">
          <div>
            <dt>Type</dt>
            <dd>{node.type}</dd>
          </div>
          <div>
            <dt>File</dt>
            <dd>{relFile(node.file)}</dd>
          </div>
          {node.exportKind && show("export") && (
            <div>
              <dt>
                <FieldLabel label="Export" tip="How this symbol is exported from its file." />
              </dt>
              <dd>{node.exportKind}</dd>
            </div>
          )}
          {node.kind && show("astKind") && (
            <div>
              <dt>
                <FieldLabel label="AST kind" tip="The declaration shape ts-morph found in source." />
              </dt>
              <dd>{node.kind}</dd>
            </div>
          )}
          {show("usedBy") && (
            <div>
              <dt>
                <FieldLabel
                  label="Used by"
                  tip="Incoming connections: imports, JSX renders, and hook calls. Each JSX tag counts once."
                />
              </dt>
              <dd>{usedByCount}</dd>
            </div>
          )}
          {show("dependsOn") && (
            <div>
              <dt>
                <FieldLabel
                  label="Depends on"
                  tip="Outgoing connections: imports, JSX renders, and hook calls from this file."
                />
              </dt>
              <dd>{dependsOnCount}</dd>
            </div>
          )}
        </dl>

        <FileSnippetPreview nodeFile={node.file} projectRoot={projectRoot} />

        {show("props") && node.props && node.props.length > 0 && (
          <div className="details-section">
            <h3>
              <FieldLabel label="Props" tip="Prop names and types from this component's parameter." />
            </h3>
            <ul className="details-props">
              {node.props.map((prop) => (
                <li key={prop.name} className="details-props__item">
                  <span className="details-props__name">
                    {prop.name}
                    {prop.optional ? "?" : ""}
                  </span>
                  {prop.type && <code className="details-props__type">{prop.type}</code>}
                  {prop.defaultValue && (
                    <span className="details-props__default">= {prop.defaultValue}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {show("importedBy") && (
          <ConnectionGroup title="Imported by" tip={CONNECTION_TIPS.importedBy} items={incoming.imports} />
        )}
        {show("renderedBy") && (
          <ConnectionGroup title="Rendered by" tip={CONNECTION_TIPS.renderedBy} items={incoming.renders} />
        )}
        {show("calledFrom") && (
          <ConnectionGroup title="Called from" tip={CONNECTION_TIPS.calledFrom} items={incoming.uses} />
        )}
        {show("imports") && (
          <ConnectionGroup title="Imports" tip={CONNECTION_TIPS.imports} items={outgoing.imports} />
        )}
        {show("renders") && (
          <ConnectionGroup title="Renders" tip={CONNECTION_TIPS.renders} items={outgoing.renders} />
        )}
        {show("callsHooks") && (
          <ConnectionGroup title="Calls hooks" tip={CONNECTION_TIPS.callsHooks} items={outgoing.uses} />
        )}
      </div>
    </div>
  );
}
