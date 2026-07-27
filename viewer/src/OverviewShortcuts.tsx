import { useCallback, useState, type ReactNode } from "react";
import type { FolderOverview, HubOverview, EntryOverview } from "./graphOverview";
import { InfoTip } from "./InfoTip";
import { formatRelativePath, truncatePath } from "./buildFlowGraph";
import {
  loadSidebarSections,
  saveSidebarSections,
  toggleSidebarSection,
  type SidebarSectionKey,
  type SidebarSectionPrefs,
} from "./sidebarPrefs";
import type { AtlasGraphNode } from "./types";

const DEFAULT_VISIBLE = 3;

type Props = {
  entries: EntryOverview<AtlasGraphNode>[];
  projectRoot?: string;
  folders: FolderOverview[];
  hubs: HubOverview[];
  spotlightFolder?: string | null;
  spotlightNodeId?: string | null;
  onEntryClick: (node: AtlasGraphNode) => void;
  onFolderClick: (folder: FolderOverview) => void;
  onHubClick: (node: AtlasGraphNode) => void;
};

function folderLabel(folder: string): string {
  return folder.split("/").pop() ?? folder;
}

type SectionProps<T> = {
  sectionKey: SidebarSectionKey;
  title: string;
  tip: string;
  items: T[];
  expanded: boolean;
  onToggleSection: (key: SidebarSectionKey) => void;
  renderItem: (item: T) => ReactNode;
  itemKey: (item: T) => string;
};

function OverviewSection<T>({
  sectionKey,
  title,
  tip,
  items,
  expanded,
  onToggleSection,
  renderItem,
  itemKey,
}: SectionProps<T>) {
  const [showAll, setShowAll] = useState(false);

  if (items.length === 0) return null;

  const visibleItems = expanded && (showAll || items.length <= DEFAULT_VISIBLE)
    ? items
    : expanded
      ? items.slice(0, DEFAULT_VISIBLE)
      : [];
  const hiddenCount = items.length - DEFAULT_VISIBLE;

  return (
    <section className="overview-shortcuts__section">
      <div className="overview-shortcuts__heading">
        <button
          type="button"
          className="overview-shortcuts__heading-toggle"
          onClick={() => onToggleSection(sectionKey)}
          aria-expanded={expanded}
        >
          <span className="overview-shortcuts__chevron" aria-hidden="true">
            {expanded ? "▾" : "▸"}
          </span>
          <span className="field-label">
            <span className="overview-shortcuts__heading-label">{title}</span>
            <InfoTip text={tip} nested />
          </span>
        </button>
        <span className="overview-shortcuts__count">{items.length}</span>
      </div>

      {expanded && (
        <>
          <ul className="overview-shortcuts__list">
            {visibleItems.map((item) => (
              <li key={itemKey(item)}>{renderItem(item)}</li>
            ))}
          </ul>
          {!showAll && hiddenCount > 0 && (
            <button
              type="button"
              className="overview-shortcuts__more"
              onClick={() => setShowAll(true)}
            >
              Show {hiddenCount} more
            </button>
          )}
        </>
      )}
    </section>
  );
}

export function OverviewShortcuts({
  entries,
  projectRoot,
  folders,
  hubs,
  spotlightFolder,
  spotlightNodeId,
  onEntryClick,
  onFolderClick,
  onHubClick,
}: Props) {
  const [sectionPrefs, setSectionPrefs] = useState<SidebarSectionPrefs>(loadSidebarSections);

  const onToggleSection = useCallback((key: SidebarSectionKey) => {
    setSectionPrefs((prev) => {
      const next = toggleSidebarSection(prev, key);
      saveSidebarSections(next);
      return next;
    });
  }, []);

  if (entries.length === 0 && folders.length === 0 && hubs.length === 0) {
    return null;
  }

  return (
    <div className="overview-shortcuts">
      <OverviewSection
        sectionKey="entries"
        title="Entry points"
        tip="Where the app starts — main.tsx, createRoot bootstrap, or Next.js root layouts. Click to spotlight on the canvas; click again to clear."
        items={entries}
        expanded={sectionPrefs.entries}
        onToggleSection={onToggleSection}
        itemKey={(entry) => entry.node.id}
        renderItem={(entry) => {
          const relativePath = truncatePath(formatRelativePath(entry.file, projectRoot));
          const exportSuffix =
            entry.exportCount > 1 ? ` · ${entry.exportCount} exports` : "";

          return (
            <button
              type="button"
              className={`overview-shortcuts__btn${spotlightNodeId === entry.node.id ? " overview-shortcuts__btn--active" : ""}`}
              onClick={() => onEntryClick(entry.node)}
              aria-pressed={spotlightNodeId === entry.node.id}
            >
              <span className="overview-shortcuts__label">{entry.node.name}</span>
              <span className="overview-shortcuts__meta" title={relativePath}>
                {relativePath}
                {exportSuffix}
              </span>
            </button>
          );
        }}
      />

      <OverviewSection
        sectionKey="folders"
        title="Top folders"
        tip="Folders with the most nodes — click to spotlight that folder on the canvas."
        items={folders}
        expanded={sectionPrefs.folders}
        onToggleSection={onToggleSection}
        itemKey={(folder) => folder.folder}
        renderItem={(folder) => (
          <button
            type="button"
            className={`overview-shortcuts__btn${spotlightFolder === folder.folder ? " overview-shortcuts__btn--active" : ""}`}
            onClick={() => onFolderClick(folder)}
            aria-pressed={spotlightFolder === folder.folder}
          >
            <span className="overview-shortcuts__label">{folderLabel(folder.folder)}</span>
            <span className="overview-shortcuts__meta" title={folder.folder}>
              {folder.count} node{folder.count === 1 ? "" : "s"} · {truncatePath(folder.folder)}
            </span>
          </button>
        )}
      />

      <OverviewSection
        sectionKey="hubs"
        title="Hub nodes"
        tip="Most connected nodes by incoming and outgoing edges. Click to spotlight on the canvas; click again to clear."
        items={hubs}
        expanded={sectionPrefs.hubs}
        onToggleSection={onToggleSection}
        itemKey={({ node }) => node.id}
        renderItem={({ node, degree }) => (
          <button
            type="button"
            className={`overview-shortcuts__btn${spotlightNodeId === node.id ? " overview-shortcuts__btn--active" : ""}`}
            onClick={() => onHubClick(node)}
            aria-pressed={spotlightNodeId === node.id}
          >
            <span className="overview-shortcuts__label">{node.name}</span>
            <span className="overview-shortcuts__meta">
              {degree} connection{degree === 1 ? "" : "s"} · {node.type}
            </span>
          </button>
        )}
      />
    </div>
  );
}
