import { relFile, typeColors } from "./buildFlowGraph";
import { DetailsFieldMenu, useDetailsFieldPrefs } from "./DetailsFieldMenu";
import type { DetailsFieldPrefs } from "./detailsPanelPrefs";
import { FileSnippetPreview } from "./FileSnippetPreview";
import { classifyHumanRole } from "./humanSemantics";
import { InfoTip } from "./InfoTip";
import type { AtlasGraphNode, GraphConnection } from "./types";

type Props = {
  node: AtlasGraphNode;
  projectRoot?: string;
  onSelectConnection?: (nodeId: string) => void;
  onClose: () => void;
};

export type DedupedConnection = GraphConnection & {
  count: number;
};

/** Collapse repeated edges between the same symbol pair (e.g. `<Input />` rendered 5×). */
export function dedupeConnections(
  items: readonly GraphConnection[]
): DedupedConnection[] {
  const byKey = new Map<string, DedupedConnection>();

  for (const item of items) {
    const key = `${item.nodeId}::${item.edgeType}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byKey.set(key, { ...item, count: 1 });
    }
  }

  return [...byKey.values()];
}

const CONNECTION_TIPS = {
  importedBy:
    "Static ES module imports pointing to this symbol (runtime call order is not statically confirmed).",
  renderedBy:
    "Directly analyzed JSX tags (<Component />) rendering this component.",
  calledFrom: "Directly analyzed hook call sites invoking this hook.",
  imports:
    "Static ES module imports from this file (does not confirm runtime execution order).",
  renders: "Directly analyzed JSX components rendered inside this file.",
  callsHooks: "Directly analyzed React/custom hooks called by this file.",
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
  evidenceTag,
  items,
  onSelectConnection,
}: {
  title: string;
  tip?: string;
  evidenceTag: string;
  items: GraphConnection[];
  onSelectConnection?: (nodeId: string) => void;
}) {
  const deduped = dedupeConnections(items);
  if (deduped.length === 0) return null;

  return (
    <div className="details-section">
      <h3>
        <FieldLabel label={`${title} (${deduped.length})`} tip={tip} />
      </h3>
      <ul className="details-list">
        {deduped.map((conn) => {
          const canJump =
            Boolean(onSelectConnection) && conn.file !== "external";

          const content = (
            <>
              <span className="details-list__head">
                <span className="details-list__name">{conn.name}</span>
                {conn.count > 1 && (
                  <span className="details-list__count">×{conn.count}</span>
                )}
              </span>
              <span className="details-list__meta">
                {evidenceTag} · {relFile(conn.file)}
              </span>
            </>
          );

          return (
            <li key={`${conn.nodeId}::${conn.edgeType}`}>
              {canJump ? (
                <button
                  type="button"
                  className="details-list__jump"
                  onClick={() => onSelectConnection?.(conn.nodeId)}
                >
                  {content}
                </button>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function NodeDetails({
  node,
  projectRoot,
  onSelectConnection,
  onClose,
}: Props) {
  const [fieldPrefs, setFieldPrefs] = useDetailsFieldPrefs();
  const roleInfo = classifyHumanRole(node);

  const incoming = {
    imports: (node.connections?.incoming ?? []).filter(
      (c) => c.edgeType === "imports"
    ),
    renders: (node.connections?.incoming ?? []).filter(
      (c) => c.edgeType === "renders"
    ),
    uses: (node.connections?.incoming ?? []).filter(
      (c) => c.edgeType === "uses"
    ),
  };

  const outgoing = {
    imports: (node.connections?.outgoing ?? []).filter(
      (c) => c.edgeType === "imports"
    ),
    renders: (node.connections?.outgoing ?? []).filter(
      (c) => c.edgeType === "renders"
    ),
    uses: (node.connections?.outgoing ?? []).filter(
      (c) => c.edgeType === "uses"
    ),
  };

  const usedByCount =
    node.stats?.incoming ?? node.connections?.incoming.length ?? 0;
  const dependsOnCount =
    node.stats?.outgoing ?? node.connections?.outgoing.length ?? 0;
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
          <div>
            <h2>{node.name}</h2>
            <p className="domain-summary__path">
              Technical inspector · {roleInfo.label}
            </p>
          </div>
        </div>
        <div className="graph-sidebar__header-actions">
          <DetailsFieldMenu prefs={fieldPrefs} onChange={setFieldPrefs} />
          <button
            type="button"
            className="graph-sidebar__close"
            onClick={onClose}
            aria-label="Close technical inspector"
          >
            ×
          </button>
        </div>
      </div>

      <div className="graph-sidebar__scroll atlas-scroll">
        <dl className="details-meta">
          <div>
            <dt>Role</dt>
            <dd>
              {roleInfo.label}{" "}
              <span className="details-evidence-pill">
                {roleInfo.certainty}
              </span>
            </dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd className="details-evidence-note">{roleInfo.reason}</dd>
          </div>
          <div>
            <dt>File</dt>
            <dd>{relFile(node.file)}</dd>
          </div>
          {node.exportKind && show("export") && (
            <div>
              <dt>
                <FieldLabel
                  label="Export"
                  tip="How this symbol is exported from its file."
                />
              </dt>
              <dd>{node.exportKind}</dd>
            </div>
          )}
          {node.kind && show("astKind") && (
            <div>
              <dt>
                <FieldLabel
                  label="AST kind"
                  tip="The declaration shape ts-morph found in source."
                />
              </dt>
              <dd>{node.kind}</dd>
            </div>
          )}
          {show("usedBy") && (
            <div>
              <dt>
                <FieldLabel
                  label="Used by"
                  tip="Incoming connections: JSX renders, hook calls, and static imports."
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
                  tip="Outgoing connections: JSX renders, hook calls, and static imports."
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
              <FieldLabel
                label="Props"
                tip="Prop names and types extracted from this component's parameter."
              />
            </h3>
            <ul className="details-props">
              {node.props.map((prop) => (
                <li key={prop.name} className="details-props__item">
                  <span className="details-props__name">
                    {prop.name}
                    {prop.optional ? "?" : ""}
                  </span>
                  {prop.type && (
                    <code className="details-props__type">{prop.type}</code>
                  )}
                  {prop.defaultValue && (
                    <span className="details-props__default">
                      = {prop.defaultValue}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {show("renderedBy") && (
          <ConnectionGroup
            title="Rendered in JSX by"
            tip={CONNECTION_TIPS.renderedBy}
            evidenceTag="Direct JSX"
            items={incoming.renders}
            onSelectConnection={onSelectConnection}
          />
        )}
        {show("calledFrom") && (
          <ConnectionGroup
            title="Hook called by"
            tip={CONNECTION_TIPS.calledFrom}
            evidenceTag="Direct hook call"
            items={incoming.uses}
            onSelectConnection={onSelectConnection}
          />
        )}
        {show("importedBy") && (
          <ConnectionGroup
            title="Statically imported by"
            tip={CONNECTION_TIPS.importedBy}
            evidenceTag="Static import"
            items={incoming.imports}
            onSelectConnection={onSelectConnection}
          />
        )}
        {show("renders") && (
          <ConnectionGroup
            title="Renders in JSX"
            tip={CONNECTION_TIPS.renders}
            evidenceTag="Direct JSX"
            items={outgoing.renders}
            onSelectConnection={onSelectConnection}
          />
        )}
        {show("callsHooks") && (
          <ConnectionGroup
            title="Calls hooks"
            tip={CONNECTION_TIPS.callsHooks}
            evidenceTag="Direct hook call"
            items={outgoing.uses}
            onSelectConnection={onSelectConnection}
          />
        )}
        {show("imports") && (
          <ConnectionGroup
            title="Statically imports"
            tip={CONNECTION_TIPS.imports}
            evidenceTag="Static import"
            items={outgoing.imports}
            onSelectConnection={onSelectConnection}
          />
        )}
      </div>
    </div>
  );
}
