import { useMemo } from "react";
import { typeColors } from "./buildFlowGraph";
import { folderKey } from "./clusterGraph";
import {
  classifyHumanRole,
  computeRenderConsumerDomainCounts,
  describeAreaForHumans,
  explainCrossAreaRelationship,
  humanizeAreaIdentity,
} from "./humanSemantics";
import type { AtlasGraph, AtlasGraphNode } from "./types";

type Props = {
  domain: string;
  graph: AtlasGraph;
  onOpenDomain: (domain: string) => void;
  onSelectSymbol: (node: AtlasGraphNode) => void;
  onSelectNeighborDomain: (domain: string) => void;
  onClose: () => void;
};

type ConnectedAreaSummary = {
  domain: string;
  title: string;
  explanationLabel: string;
  explanationSentence: string;
  totalEdges: number;
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
    const renderCounts = computeRenderConsumerDomainCounts(graph);
    const areaDesc = describeAreaForHumans(domain, graph, renderCounts);

    const outgoingSet = new Set<string>();
    const incomingSet = new Set<string>();
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

    for (const edge of graph.edges) {
      const src = nodeById.get(edge.from);
      const dst = nodeById.get(edge.to);
      if (!src || !dst || src.file === "external" || dst.file === "external") {
        continue;
      }
      const srcDomain = folderKey(src.file);
      const dstDomain = folderKey(dst.file);
      if (srcDomain === domain && dstDomain !== domain) {
        outgoingSet.add(dstDomain);
      } else if (dstDomain === domain && srcDomain !== domain) {
        incomingSet.add(srcDomain);
      }
    }

    const buildAreaLinks = (
      domains: Set<string>,
      direction: "outgoing" | "incoming"
    ): ConnectedAreaSummary[] =>
      [...domains]
        .map((otherDomain) => {
          const exp =
            direction === "outgoing"
              ? explainCrossAreaRelationship(domain, otherDomain, graph)
              : explainCrossAreaRelationship(otherDomain, domain, graph);
          return {
            domain: otherDomain,
            title: humanizeAreaIdentity(otherDomain).title,
            explanationLabel: exp.shortLabel,
            explanationSentence: exp.sentence,
            totalEdges: exp.totalEdges,
          };
        })
        .sort(
          (a, b) =>
            b.totalEdges - a.totalEdges || a.title.localeCompare(b.title)
        );

    const startingItems = areaDesc.startingScreens.map((node) => ({
      node,
      roleInfo: classifyHumanRole(node, renderCounts.get(node.id) ?? 0),
    }));

    return {
      areaDesc,
      startingItems,
      dependsOn: buildAreaLinks(outgoingSet, "outgoing"),
      usedBy: buildAreaLinks(incomingSet, "incoming"),
    };
  }, [domain, graph]);

  const { areaDesc } = summary;

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
            <h2>{areaDesc.title}</h2>
            <p className="domain-summary__path">
              {areaDesc.categoryLabel} · {domain}
            </p>
          </div>
        </div>
        <div className="graph-sidebar__header-actions">
          <button
            type="button"
            className="graph-sidebar__close"
            onClick={onClose}
            aria-label="Close area summary"
          >
            ×
          </button>
        </div>
      </div>

      <div className="graph-sidebar__scroll atlas-scroll">
        <p className="domain-summary__purpose">{areaDesc.purposeSummary}</p>

        <button
          type="button"
          className="domain-summary__open-cta"
          onClick={() => onOpenDomain(domain)}
        >
          <span>
            Explore {areaDesc.title} ({areaDesc.counts.total})
          </span>
          <span aria-hidden="true">→</span>
        </button>

        {summary.startingItems.length > 0 && (
          <div className="details-section">
            <h3>
              {areaDesc.counts.screens > 0
                ? "Features & screens to explore"
                : "Key elements to explore"}
            </h3>
            <ul className="details-list">
              {summary.startingItems.map(({ node, roleInfo }) => (
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
                      <span className="details-list__count">Story →</span>
                    </span>
                    <span className="details-list__meta">
                      {roleInfo.label}
                      {roleInfo.certainty === "inferred" ? " (inferred)" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="details-section">
          <h3>Used by other areas ({summary.usedBy.length})</h3>
          {summary.usedBy.length === 0 ? (
            <p className="details-empty">
              No other areas reference {areaDesc.title} directly.
            </p>
          ) : (
            <ul className="details-list">
              {summary.usedBy.map((item) => (
                <li key={item.domain}>
                  <button
                    type="button"
                    className="details-list__jump"
                    onClick={() => onSelectNeighborDomain(item.domain)}
                    title={item.explanationSentence}
                  >
                    <span className="details-list__head">
                      <span className="details-list__name">{item.title}</span>
                      <span className="details-list__count">
                        {item.explanationLabel}
                      </span>
                    </span>
                    <span className="details-list__meta">
                      {item.explanationSentence}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="details-section">
          <h3>Depends on other areas ({summary.dependsOn.length})</h3>
          {summary.dependsOn.length === 0 ? (
            <p className="details-empty">Self-contained area.</p>
          ) : (
            <ul className="details-list">
              {summary.dependsOn.map((item) => (
                <li key={item.domain}>
                  <button
                    type="button"
                    className="details-list__jump"
                    onClick={() => onSelectNeighborDomain(item.domain)}
                    title={item.explanationSentence}
                  >
                    <span className="details-list__head">
                      <span className="details-list__name">{item.title}</span>
                      <span className="details-list__count">
                        {item.explanationLabel}
                      </span>
                    </span>
                    <span className="details-list__meta">
                      {item.explanationSentence}
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
