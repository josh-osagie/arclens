import type { FolderOverview, HubOverview, EntryOverview } from "./graphOverview";
import { InfoTip } from "./InfoTip";
import { formatRelativePath, truncatePath } from "./buildFlowGraph";
import type { AtlasGraphNode } from "./types";

type Props = {
  entries: EntryOverview<AtlasGraphNode>[];
  projectRoot?: string;
  folders: FolderOverview[];
  hubs: HubOverview[];
  onEntryClick: (node: AtlasGraphNode) => void;
  onFolderClick: (folder: FolderOverview) => void;
  onHubClick: (node: AtlasGraphNode) => void;
};
function folderLabel(folder: string): string {
  return folder.split("/").pop() ?? folder;
}

export function OverviewShortcuts({
  entries,
  projectRoot,
  folders,
  hubs,
  onEntryClick,
  onFolderClick,
  onHubClick,
}: Props) {  if (entries.length === 0 && folders.length === 0 && hubs.length === 0) {
    return null;
  }

  return (
    <div className="overview-shortcuts">
      {entries.length > 0 && (
        <section className="overview-shortcuts__section">
          <h3 className="overview-shortcuts__title">
            <span className="field-label">
              <span className="field-label__text">Entry points</span>
              <InfoTip text="App boot files and nodes marked as entry in the graph." />
            </span>
          </h3>
          <ul className="overview-shortcuts__list">
            {entries.map((entry) => {
              const relativePath = truncatePath(formatRelativePath(entry.file, projectRoot));
              const exportSuffix =
                entry.exportCount > 1 ? ` · ${entry.exportCount} exports` : "";

              return (
                <li key={entry.node.id}>
                  <button
                    type="button"
                    className="overview-shortcuts__btn"
                    onClick={() => onEntryClick(entry.node)}
                  >
                    <span className="overview-shortcuts__label">{entry.node.name}</span>
                    <span className="overview-shortcuts__meta" title={relativePath}>
                      {relativePath}
                      {exportSuffix}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>        </section>
      )}

      {folders.length > 0 && (
        <section className="overview-shortcuts__section">
          <h3 className="overview-shortcuts__title">
            <span className="field-label">
              <span className="field-label__text">Top folders</span>
              <InfoTip text="Folders with the most nodes — click to expand or focus on the canvas." />
            </span>
          </h3>
          <ul className="overview-shortcuts__list">
            {folders.map((folder) => (
              <li key={folder.folder}>
                <button
                  type="button"
                  className="overview-shortcuts__btn"
                  onClick={() => onFolderClick(folder)}
                >
                  <span className="overview-shortcuts__label">{folderLabel(folder.folder)}</span>
                  <span className="overview-shortcuts__meta">
                    {folder.count} node{folder.count === 1 ? "" : "s"} · {folder.folder}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hubs.length > 0 && (
        <section className="overview-shortcuts__section">
          <h3 className="overview-shortcuts__title">
            <span className="field-label">
              <span className="field-label__text">Hub nodes</span>
              <InfoTip text="Most connected nodes by incoming and outgoing edges." />
            </span>
          </h3>
          <ul className="overview-shortcuts__list">
            {hubs.map(({ node, degree }) => (
              <li key={node.id}>
                <button
                  type="button"
                  className="overview-shortcuts__btn"
                  onClick={() => onHubClick(node)}
                >
                  <span className="overview-shortcuts__label">{node.name}</span>
                  <span className="overview-shortcuts__meta">
                    {degree} connection{degree === 1 ? "" : "s"} · {node.type}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
