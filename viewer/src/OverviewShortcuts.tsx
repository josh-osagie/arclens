import { useCallback, useState, type ReactNode } from "react";
import { formatRelativePath, truncatePath } from "./buildFlowGraph";
import type {
  EntryOverview,
  FolderOverview,
  HubOverview,
} from "./graphOverview";
import { classifyHumanRole, humanizeAreaIdentity } from "./humanSemantics";
import { InfoTip } from "./InfoTip";
import {
  loadSidebarSections,
  saveSidebarSections,
  toggleSidebarSection,
  type SidebarSectionKey,
  type SidebarSectionPrefs,
} from "./sidebarPrefs";
import type { AtlasGraphNode } from "./types";

const DEFAULT_VISIBLE = 5;

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

  const visibleItems =
    expanded && (showAll || items.length <= DEFAULT_VISIBLE)
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
  const [sectionPrefs, setSectionPrefs] =
    useState<SidebarSectionPrefs>(loadSidebarSections);

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
        title="Start here"
        tip="Where the application boots up — click to follow the story from the root entry point."
        items={entries}
        expanded={sectionPrefs.entries}
        onToggleSection={onToggleSection}
        itemKey={(entry) => entry.node.id}
        renderItem={(entry) => {
          const relativePath = truncatePath(
            formatRelativePath(entry.file, projectRoot)
          );

          return (
            <button
              type="button"
              className={`overview-shortcuts__btn${spotlightNodeId === entry.node.id ? " overview-shortcuts__btn--active" : ""}`}
              onClick={() => onEntryClick(entry.node)}
              aria-pressed={spotlightNodeId === entry.node.id}
            >
              <span className="overview-shortcuts__label">
                Application Startup ({entry.node.name})
              </span>
              <span className="overview-shortcuts__meta" title={relativePath}>
                App entry point · {relativePath}
              </span>
            </button>
          );
        }}
      />

      <OverviewSection
        sectionKey="folders"
        title="Application areas"
        tip="Major functional areas of the project — click any area to explore its features and screens."
        items={folders}
        expanded={sectionPrefs.folders}
        onToggleSection={onToggleSection}
        itemKey={(folder) => folder.folder}
        renderItem={(folder) => {
          const identity = humanizeAreaIdentity(folder.folder);
          return (
            <button
              type="button"
              className={`overview-shortcuts__btn${spotlightFolder === folder.folder ? " overview-shortcuts__btn--active" : ""}`}
              onClick={() => onFolderClick(folder)}
              aria-pressed={spotlightFolder === folder.folder}
            >
              <span className="overview-shortcuts__label">
                {identity.title}
              </span>
              <span className="overview-shortcuts__meta" title={folder.folder}>
                {identity.categoryLabel} · {folder.count}{" "}
                {folder.count === 1 ? "item" : "items"}
              </span>
            </button>
          );
        }}
      />

      <OverviewSection
        sectionKey="hubs"
        title="Most connected"
        tip="Shared components, hooks, and modules used heavily across the project — click to inspect how they connect."
        items={hubs}
        expanded={sectionPrefs.hubs}
        onToggleSection={onToggleSection}
        itemKey={({ node }) => node.id}
        renderItem={({ node, degree }) => {
          const role = classifyHumanRole(node);
          return (
            <button
              type="button"
              className={`overview-shortcuts__btn${spotlightNodeId === node.id ? " overview-shortcuts__btn--active" : ""}`}
              onClick={() => onHubClick(node)}
              aria-pressed={spotlightNodeId === node.id}
            >
              <span className="overview-shortcuts__label">{node.name}</span>
              <span className="overview-shortcuts__meta">
                {role.shortLabel} · {degree}{" "}
                {degree === 1 ? "connection" : "connections"}
              </span>
            </button>
          );
        }}
      />
    </div>
  );
}
