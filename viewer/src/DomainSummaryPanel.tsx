import { useMemo } from "react";
import { folderKey } from "./clusterGraph";
import { relFile, typeColors } from "./buildFlowGraph";
import type { AtlasGraph, AtlasGraphNode, GraphNodeType } from "./types";

type Props = {
  domain: string;
  graph: AtlasGraph;
  onOpenDomain: (domain: string) => void;
  onSelectSymbol: (node: AtlasGraphNode) => void;
  onSelectNeighborDomain: (domain: string) => void;
  onClose: () => void;
};

type DomainLinkSummary = {
  domain: string;
  count: number;
};

const TYPE_PLURAL_LABELS: Record<GraphNodeType, string> = {
  entry: "entries",
  component: "components",
  hook: "hooks",
  context: "contexts",
  utility: "utilities",
  config: "configs",
};

export function DomainSummaryPanel({
  domain,
  graph,
  onOpenDomain,
  onSelectSymbol,
  onSelectNeighborDomain,
  onClose,
}: Props) {
  const summary = useMemo(() => {
    const members: AtlasGraphNode[] = [];
    const memberIds = new Set<string>();
    const byType: Partial<Record<GraphNodeType, number>> = {};

    for (const node of graph.nodes) {
      if (node.file === "external") continue;
      if (folderKey(node.file) !== domain) continue;
      members.push(node);
      memberIds.add(node.id);
      byType[node.type] = (byType[node.type] ?? 0) + 1;
    }

    const degreeById = new Map<string, number>();
    const outgoingDomains = new Map<string, number>();
    const incomingDomains = new Map<string, number>();
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

    for (const edge of graph.edges) {
      const fromIn = memberIds.has(edge.from);
      const toIn = memberIds.has(edge.to);
      if (fromIn) {
        degreeById.set(edge.from, (degreeById.get(edge.from) ?? 0) + 1);
      }
      if (toIn) {
        degreeById.set(edge.to, (degreeById.get(edge.to) ?? 0) + 1);
      }

      if (fromIn && !toIn) {
        const target = nodeById.get(edge.to);
        if (target && target.file !== "external") {
          const other = folderKey(target.file);
          outgoingDomains.set(other, (outgoingDomains.get(other) ?? 0) + 1);
        }
      } else if (!fromIn && toIn) {
        const source = nodeById.get(edge.from);
        if (source && source.file !== "external") {
          const other = folderKey(source.file);
          incomingDomains.set(other, (incomingDomains.get(other) ?? 0) + 1);
        }
      }
    }

    const topSymbols = [...members]
      .sort(
        (a, b) =>
          (degreeById.get(b.id) ?? 0) - (degreeById.get(a.id) ?? 0) ||
          a.name.localeCompare(b.name)
      )
      .slice(0, 8)
      .map((node) => ({
        node,
        degree: degreeById.get(node.id) ?? 0,
      }));

    const toSortedLinks = (map: Map<string, number>): DomainLinkSummary[] =>
      [...map.entries()]
        .map(([d, count]) => ({ domain: d, count }))
        .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));

    return {
      total: members.length,
      byType,
      topSymbols,
      dependsOn: toSortedLinks(outgoingDomains),
      usedBy: toSortedLinks(incomingDomains),
    };
  }, [domain, graph]);

  const title = domain.split("/").pop() ?? domain;

  return (
    <div className="graph-sidebar graph-sidebar--details domain-summary">
      <div className="graph-sidebar__header">
        <div className="graph-sidebar__title-row">
          <span
            className="graph-sidebar__type-dot"
            style={{ background: "var(--atlas-accent)" }}
            aria-hidden="true"
          />
          <div>
            <h2>{title}</h2>
            <p className="domain-summary__path">{domain}</p>
          </div>
        </div>
        <div className="graph-sidebar__header-actions">
          <button
            type="button"
            className="graph-sidebar__close"
            onClick={onClose}
            aria-label="Close domain summary"
          >
            ×
          </button>
        </div>
      </div>

      <div className="graph-sidebar__scroll atlas-scroll">
        <button
          type="button"
          className="domain-summary__open-cta"
          onClick={() => onOpenDomain(domain)}
        >
          <span>Open {domain}</span>
          <span aria-hidden="true">→</span>
        </button>

        <dl className="details-meta">
          <div>
            <dt>Symbols</dt>
            <dd>{summary.total}</dd>
          </div>
          {Object.entries(summary.byType).map(([type, count]) =>
            count ? (
              <div key={type}>
                <dt>
                  {TYPE_PLURAL_LABELS[type as GraphNodeType] ?? `${type}s`}
                </dt>
                <dd>{count}</dd>
              </div>
            ) : null
          )}
        </dl>

        {summary.topSymbols.length > 0 && (
          <div className="details-section">
            <h3>Key symbols</h3>
            <ul className="details-list">
              {summary.topSymbols.map(({ node, degree }) => (
                <li key={node.id}>
                  <button
                    type="button"
                    className="details-list__jump"
                    onClick={() => onSelectSymbol(node)}
                  >
                    <span className="details-list__head">
                      <span
                        className="details-list__dot"
                        style={{
                          background:
                            typeColors[node.type] ?? typeColors.utility,
                        }}
                      />
                      <span className="details-list__name">{node.name}</span>
                    </span>
                    <span className="details-list__meta">
                      {node.type} · {degree} link{degree === 1 ? "" : "s"} ·{" "}
                      {relFile(node.file)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="details-section">
          <h3>Used by domains ({summary.usedBy.length})</h3>
          {summary.usedBy.length === 0 ? (
            <p className="details-empty">none</p>
          ) : (
            <ul className="details-list">
              {summary.usedBy.map((item) => (
                <li key={item.domain}>
                  <button
                    type="button"
                    className="details-list__jump"
                    onClick={() => onSelectNeighborDomain(item.domain)}
                  >
                    <span className="details-list__name">{item.domain}</span>
                    <span className="details-list__meta">
                      {item.count} incoming edge{item.count === 1 ? "" : "s"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="details-section">
          <h3>Depends on domains ({summary.dependsOn.length})</h3>
          {summary.dependsOn.length === 0 ? (
            <p className="details-empty">none</p>
          ) : (
            <ul className="details-list">
              {summary.dependsOn.map((item) => (
                <li key={item.domain}>
                  <button
                    type="button"
                    className="details-list__jump"
                    onClick={() => onSelectNeighborDomain(item.domain)}
                  >
                    <span className="details-list__name">{item.domain}</span>
                    <span className="details-list__meta">
                      {item.count} outgoing edge{item.count === 1 ? "" : "s"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
