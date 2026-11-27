import { isAppEntryFile } from "../../src/entryPoints";
import { folderKey } from "./clusterGraph";
import type { EdgeVisibilityPrefs } from "./edgeVisibilityPrefs";
import type {
  AtlasGraph,
  AtlasGraphNode,
  GraphEdgeType,
} from "./types";

export type HumanRoleId =
  | "entry"
  | "screen"
  | "shared-ui"
  | "component"
  | "hook"
  | "context"
  | "service"
  | "helper"
  | "config";

export type EvidenceCertainty =
  | "direct"
  | "aggregated"
  | "inferred"
  | "static-import";

export type HumanRoleInfo = {
  role: HumanRoleId;
  label: string;
  shortLabel: string;
  certainty: "direct" | "inferred";
  reason: string;
};

export type HumanAreaDescription = {
  domain: string;
  title: string;
  categoryLabel: string;
  cardSubtitle: string;
  purposeSummary: string;
  evidenceNote: string;
  isNeutralFallback: boolean;
  startingScreens: AtlasGraphNode[];
  counts: {
    total: number;
    screens: number;
    components: number;
    sharedUi: number;
    hooks: number;
    contexts: number;
    services: number;
    helpers: number;
  };
};

export type RelationshipExplanation = {
  shortLabel: string;
  sentence: string;
  certainty: EvidenceCertainty;
  certaintyBadge: string;
};

const KNOWN_SLUG_TITLES: Record<string, string> = {
  auth: "Authentication",
  kyc: "Identity Verification",
  ui: "Shared UI Primitives",
  api: "API Services",
  nav: "Navigation",
  navigation: "Navigation",
  prefs: "Preferences",
  config: "Configuration",
  utils: "Shared Helpers",
  helpers: "Shared Helpers",
  hooks: "Shared Hooks",
  constants: "Constants & Config",
  layouts: "Page Layouts",
  typography: "Typography",
  common: "Common UI",
  shared: "Shared Components",
  assets: "Static Assets",
  icons: "Icons",
};

function titleCaseWords(raw: string): string {
  const lower = raw.toLowerCase();
  if (KNOWN_SLUG_TITLES[lower]) return KNOWN_SLUG_TITLES[lower]!;
  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[-_.\s/]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Count how many distinct domains render each component node so highly reused
 * primitives are identified by structural graph evidence as well as folder path.
 */
export function computeRenderConsumerDomainCounts(
  graph: AtlasGraph
): Map<string, number> {
  const byId = new Map(graph.nodes.map((node) => [node.id, node] as const));
  const domainsByTarget = new Map<string, Set<string>>();

  for (const edge of graph.edges) {
    if (edge.type !== "renders") continue;
    const source = byId.get(edge.from);
    if (!source || source.file === "external") continue;
    const srcDomain = folderKey(source.file);
    let set = domainsByTarget.get(edge.to);
    if (!set) {
      set = new Set<string>();
      domainsByTarget.set(edge.to, set);
    }
    set.add(srcDomain);
  }

  const counts = new Map<string, number>();
  for (const [id, set] of domainsByTarget) {
    counts.set(id, set.size);
  }
  return counts;
}

/**
 * Classify an analyzed symbol into a human-meaningful architectural role with
 * explicit confidence ("direct" AST fact vs "inferred" path/naming heuristic).
 */
export function classifyHumanRole(
  node: AtlasGraphNode,
  consumerDomainCount = 0
): HumanRoleInfo {
  if (node.file === "external") {
    return {
      role: "hook",
      label: "Library Hook",
      shortLabel: "Library hook",
      certainty: "direct",
      reason: "External hook call extracted from source AST",
    };
  }

  const normFile = node.file.replace(/\\/g, "/");

  if (node.type === "entry" || isAppEntryFile(normFile)) {
    return {
      role: "entry",
      label: "App Startup",
      shortLabel: "App startup",
      certainty: "direct",
      reason: "Application bootstrap / root entry file",
    };
  }

  if (node.type === "component") {
    const inRouteFolder = /(^|\/)(routes|pages|screens|views)(\/|$)/i.test(
      normFile
    );
    const hasScreenSuffix = /(Page|Screen|View|Router)$/.test(node.name);
    if (inRouteFolder || hasScreenSuffix) {
      return {
        role: "screen",
        label: "Screen / Route",
        shortLabel: "Screen",
        certainty: "inferred",
        reason: inRouteFolder
          ? "JSX component inside routes/pages directory (inferred screen)"
          : "JSX component named *Page/*Screen/*Router (inferred screen)",
      };
    }

    const inSharedUiFolder =
      /(^|\/)components\/(ui|common|typography|icons)(\/|$)/i.test(normFile);
    if (inSharedUiFolder) {
      return {
        role: "shared-ui",
        label: "Shared UI Component",
        shortLabel: "Shared UI",
        certainty: "direct",
        reason: "Reusable JSX component in shared interface directory",
      };
    }

    if (consumerDomainCount >= 3) {
      return {
        role: "shared-ui",
        label: "Shared UI Component",
        shortLabel: "Shared UI",
        certainty: "direct",
        reason: `JSX component rendered across ${consumerDomainCount} areas`,
      };
    }

    return {
      role: "component",
      label: "UI Component",
      shortLabel: "Component",
      certainty: "direct",
      reason: "Exported React JSX component",
    };
  }

  if (node.type === "hook") {
    return {
      role: "hook",
      label: "State / Logic Hook",
      shortLabel: "Hook",
      certainty: "direct",
      reason: "Exported custom React hook (use*)",
    };
  }

  if (node.type === "context") {
    return {
      role: "context",
      label: "Shared State Context",
      shortLabel: "Context",
      certainty: "direct",
      reason: "Exported React Context symbol",
    };
  }

  if (node.type === "config") {
    return {
      role: "config",
      label: "Configuration",
      shortLabel: "Config",
      certainty: "direct",
      reason: "Configuration module identified by analyzer",
    };
  }

  // `utility` symbols: distinguish service/API modules & config constants honestly as inferred
  const inServicePath =
    /(^|\/)(api|services|queries|mutations|client|http)(\/|$)/i.test(normFile);
  const hasServiceName = /(Api|Service|Client|Query|Mutation)$/i.test(
    node.name
  );
  if (inServicePath || hasServiceName) {
    return {
      role: "service",
      label: "Data / Service Module",
      shortLabel: "Data / service",
      certainty: "inferred",
      reason: inServicePath
        ? "Exported module in api/services path (static analysis — runtime network calls not confirmed)"
        : "Exported symbol with *Api/*Service/*Client naming (inferred)",
    };
  }

  if (/(^|\/)(config|constants|env)(\/|$)/i.test(normFile)) {
    return {
      role: "config",
      label: "Constants & Config",
      shortLabel: "Config",
      certainty: "inferred",
      reason: "Exported symbol inside constants/config path",
    };
  }

  return {
    role: "helper",
    label: "Helper Module",
    shortLabel: "Helper",
    certainty: "direct",
    reason: "Exported TypeScript/JavaScript helper or utility",
  };
}

/**
 * Derive a human-friendly area title without inventing business domains from weak evidence.
 */
export function humanizeAreaIdentity(domain: string): {
  title: string;
  categoryLabel: string;
  isNeutralFallback: boolean;
  evidenceNote: string;
} {
  const norm = domain.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const lower = norm.toLowerCase();

  if (lower === "src" || lower === "root") {
    return {
      title: "App Startup & Root",
      categoryLabel: "Startup & routing",
      isNeutralFallback: false,
      evidenceNote: `Root application bootstrap files in '${norm}'.`,
    };
  }

  if (lower === "src/app" || lower === "app") {
    return {
      title: "App Shell & Store",
      categoryLabel: "Startup & routing",
      isNeutralFallback: false,
      evidenceNote: `Application setup, providers, and state wiring in '${norm}'.`,
    };
  }

  if (lower === "src/routing" || lower === "src/router") {
    return {
      title: "App Routing",
      categoryLabel: "Startup & routing",
      isNeutralFallback: false,
      evidenceNote: `Route definitions in '${norm}'.`,
    };
  }

  const featureMatch = norm.match(
    /^(?:src\/)?(features|domains|modules|pages|routes|views|screens)\/(.+)$/i
  );
  if (featureMatch) {
    const container = featureMatch[1]!.toLowerCase();
    const slug = featureMatch[2]!;
    return {
      title: titleCaseWords(slug),
      categoryLabel:
        container === "pages" || container === "routes"
          ? "Screens & routes"
          : "Product feature",
      isNeutralFallback: false,
      evidenceNote: `Grouped from ${container} directory '${norm}'.`,
    };
  }

  const componentMatch = norm.match(/^(?:src\/)?components\/(.+)$/i);
  if (componentMatch) {
    const slug = componentMatch[1]!;
    const mapped = KNOWN_SLUG_TITLES[slug.toLowerCase()];
    return {
      title: mapped ?? `${titleCaseWords(slug)} UI`,
      categoryLabel: "Shared interface",
      isNeutralFallback: false,
      evidenceNote: `Shared interface components in '${norm}'.`,
    };
  }

  if (lower === "src/components" || lower === "components") {
    return {
      title: "Shared Components",
      categoryLabel: "Shared interface",
      isNeutralFallback: false,
      evidenceNote: `Shared React components in '${norm}'.`,
    };
  }

  const coreMatch = norm.match(
    /^src\/(hooks|utils|helpers|constants|config|services|api|assets|icons|styles|design)$/i
  );
  if (coreMatch) {
    const slug = coreMatch[1]!.toLowerCase();
    const isUi = slug === "assets" || slug === "icons" || slug === "styles" || slug === "design";
    return {
      title: KNOWN_SLUG_TITLES[slug] ?? titleCaseWords(slug),
      categoryLabel: isUi ? "Shared interface" : "Shared foundation",
      isNeutralFallback: false,
      evidenceNote: `Grouped from shared '${norm}' directory.`,
    };
  }

  const leaf = norm.split("/").pop() ?? norm;
  return {
    title: `${titleCaseWords(leaf)} Modules`,
    categoryLabel: "Folder group",
    isNeutralFallback: true,
    evidenceNote: `Grouped neutrally because these files share the '${norm}' directory (no specific feature or screen convention detected).`,
  };
}

/**
 * Build a complete human-readable description of a domain/area from analyzed graph evidence.
 */
export function describeAreaForHumans(
  domain: string,
  graph: AtlasGraph,
  consumerCounts?: ReadonlyMap<string, number>
): HumanAreaDescription {
  const identity = humanizeAreaIdentity(domain);
  const renderCounts =
    consumerCounts ?? computeRenderConsumerDomainCounts(graph);

  const members = graph.nodes.filter(
    (node) => node.file !== "external" && folderKey(node.file) === domain
  );

  const counts = {
    total: members.length,
    screens: 0,
    components: 0,
    sharedUi: 0,
    hooks: 0,
    contexts: 0,
    services: 0,
    helpers: 0,
  };

  const screenNodes: AtlasGraphNode[] = [];
  const componentNodes: AtlasGraphNode[] = [];

  for (const node of members) {
    const role = classifyHumanRole(node, renderCounts.get(node.id) ?? 0).role;
    if (role === "entry" || role === "screen") {
      counts.screens += 1;
      screenNodes.push(node);
    } else if (role === "shared-ui") {
      counts.sharedUi += 1;
      componentNodes.push(node);
    } else if (role === "component") {
      counts.components += 1;
      componentNodes.push(node);
    } else if (role === "hook") {
      counts.hooks += 1;
    } else if (role === "context") {
      counts.contexts += 1;
    } else if (role === "service") {
      counts.services += 1;
    } else {
      counts.helpers += 1;
    }
  }

  const outgoingCountById = new Map<string, number>();
  for (const edge of graph.edges) {
    outgoingCountById.set(
      edge.from,
      (outgoingCountById.get(edge.from) ?? 0) + 1
    );
  }

  const sortCandidates = (items: AtlasGraphNode[]) =>
    [...items].sort((a, b) => {
      if (a.type === "entry" && b.type !== "entry") return -1;
      if (b.type === "entry" && a.type !== "entry") return 1;
      const outDiff =
        (outgoingCountById.get(b.id) ?? 0) -
        (outgoingCountById.get(a.id) ?? 0);
      if (outDiff !== 0) return outDiff;
      return a.name.localeCompare(b.name);
    });

  const startingScreens =
    screenNodes.length > 0
      ? sortCandidates(screenNodes).slice(0, 6)
      : sortCandidates(componentNodes).slice(0, 4);

  // Build crisp 1-line subtitle for overview cards
  const pillParts: string[] = [];
  if (counts.screens > 0) {
    pillParts.push(
      `${counts.screens} ${counts.screens === 1 ? "screen" : "screens"}`
    );
  }
  if (counts.components > 0) {
    pillParts.push(`${counts.components} UI`);
  }
  if (counts.sharedUi > 0) {
    pillParts.push(`${counts.sharedUi} shared UI`);
  }
  if (counts.hooks + counts.contexts > 0) {
    const hc = counts.hooks + counts.contexts;
    pillParts.push(`${hc} ${hc === 1 ? "hook" : "hooks"}`);
  }
  if (counts.services > 0 && pillParts.length < 3) {
    pillParts.push(
      `${counts.services} ${counts.services === 1 ? "service" : "services"}`
    );
  }
  if (counts.helpers > 0 && pillParts.length < 3) {
    pillParts.push(
      `${counts.helpers} ${counts.helpers === 1 ? "helper" : "helpers"}`
    );
  }

  const cardSubtitle =
    pillParts.slice(0, 3).join(" · ") || `${counts.total} items`;

  // Build plain-English purpose paragraph
  const detailParts: string[] = [];
  if (counts.screens > 0) {
    const names = startingScreens
      .slice(0, 2)
      .map((n) => n.name)
      .join(", ");
    detailParts.push(
      `${counts.screens} ${counts.screens === 1 ? "screen/entry" : "screens"} (${names}${counts.screens > 2 ? ", …" : ""})`
    );
  }
  if (counts.components > 0) {
    detailParts.push(
      `${counts.components} feature ${counts.components === 1 ? "component" : "components"}`
    );
  }
  if (counts.sharedUi > 0) {
    detailParts.push(
      `${counts.sharedUi} reusable UI ${counts.sharedUi === 1 ? "component" : "components"}`
    );
  }
  if (counts.hooks > 0) {
    detailParts.push(
      `${counts.hooks} ${counts.hooks === 1 ? "hook" : "hooks"}`
    );
  }
  if (counts.contexts > 0) {
    detailParts.push(
      `${counts.contexts} state ${counts.contexts === 1 ? "context" : "contexts"}`
    );
  }
  if (counts.services > 0) {
    detailParts.push(
      `${counts.services} data/service ${counts.services === 1 ? "module" : "modules"}`
    );
  }
  if (counts.helpers > 0) {
    detailParts.push(
      `${counts.helpers} helper/config ${counts.helpers === 1 ? "module" : "modules"}`
    );
  }

  const joined =
    detailParts.length > 0
      ? `Contains ${detailParts.join(", ")}.`
      : `Contains ${counts.total} analyzed items.`;

  const purposeSummary = identity.isNeutralFallback
    ? `${joined} ${identity.evidenceNote}`
    : joined;

  return {
    domain,
    title: identity.title,
    categoryLabel: identity.categoryLabel,
    cardSubtitle,
    purposeSummary,
    evidenceNote: identity.evidenceNote,
    isNeutralFallback: identity.isNeutralFallback,
    startingScreens,
    counts,
  };
}

/**
 * Explain WHY two symbols are connected using only verified analyzer relationship types.
 * Never claims confirmed runtime function execution from static `imports` alone.
 */
export function explainSymbolRelationship(params: {
  sourceNode: AtlasGraphNode;
  targetNode: AtlasGraphNode;
  edgeTypes: readonly GraphEdgeType[];
  count?: number;
  perspective: "outgoing" | "incoming";
  targetRole?: HumanRoleId;
}): RelationshipExplanation {
  const {
    sourceNode,
    targetNode,
    edgeTypes,
    count = 1,
    perspective,
    targetRole,
  } = params;
  const hasRenders = edgeTypes.includes("renders");
  const hasUses = edgeTypes.includes("uses");

  if (hasRenders) {
    const mult = count > 1 ? ` ×${count}` : "";
    if (perspective === "outgoing") {
      return {
        shortLabel: `renders${mult}`,
        sentence:
          count > 1
            ? `Directly analyzed: ${sourceNode.name} renders <${targetNode.name} /> (${count} JSX tags).`
            : `Directly analyzed: ${sourceNode.name} renders <${targetNode.name} /> in JSX.`,
        certainty: "direct",
        certaintyBadge: "Direct JSX",
      };
    }
    return {
      shortLabel: `renders this${mult}`,
      sentence: `Directly analyzed: ${sourceNode.name} renders <${targetNode.name} /> in JSX.`,
      certainty: "direct",
      certaintyBadge: "Direct JSX",
    };
  }

  if (hasUses) {
    if (perspective === "outgoing") {
      return {
        shortLabel: "uses hook",
        sentence: `Directly analyzed: ${sourceNode.name} calls hook ${targetNode.name}().`,
        certainty: "direct",
        certaintyBadge: "Direct hook call",
      };
    }
    return {
      shortLabel: "calls this hook",
      sentence: `Directly analyzed: ${sourceNode.name} calls hook ${targetNode.name}().`,
      certainty: "direct",
      certaintyBadge: "Direct hook call",
    };
  }

  // Static ES module import only — be 100% transparent that runtime call order is not proven
  if (perspective === "outgoing") {
    const noun =
      targetRole === "service"
        ? "service module"
        : targetRole === "context"
          ? "state context"
          : targetRole === "config"
            ? "config/constants"
            : "helper module";
    return {
      shortLabel: `imports ${noun.split(" ")[0]}`,
      sentence: `Static import: ${sourceNode.name}'s file imports ${targetNode.name} (runtime call order is not confirmed statically).`,
      certainty: "static-import",
      certaintyBadge: "Static import",
    };
  }

  return {
    shortLabel: "imports this",
    sentence: `Static import: ${sourceNode.name}'s file imports ${targetNode.name}.`,
    certainty: "static-import",
    certaintyBadge: "Static import",
  };
}

/**
 * Summarize cross-area relationships in plain English for Overview edges and Area Summary.
 */
export function explainCrossAreaRelationship(
  fromDomain: string,
  toDomain: string,
  graph: AtlasGraph,
  visibility?: EdgeVisibilityPrefs
): RelationshipExplanation & { totalEdges: number } {
  const byId = new Map(graph.nodes.map((n) => [n.id, n] as const));
  const renderedTargets = new Set<string>();
  const usedHooks = new Set<string>();
  const importedModules = new Set<string>();
  let totalEdges = 0;

  for (const edge of graph.edges) {
    if (visibility && !visibility[edge.type]) continue;
    const src = byId.get(edge.from);
    const dst = byId.get(edge.to);
    if (!src || !dst || src.file === "external" || dst.file === "external") {
      continue;
    }
    if (folderKey(src.file) !== fromDomain || folderKey(dst.file) !== toDomain) {
      continue;
    }
    totalEdges += 1;
    if (edge.type === "renders") {
      renderedTargets.add(dst.id);
    } else if (edge.type === "uses") {
      usedHooks.add(dst.id);
    } else {
      importedModules.add(dst.id);
    }
  }

  const fromTitle = humanizeAreaIdentity(fromDomain).title;
  const toTitle = humanizeAreaIdentity(toDomain).title;

  const shortParts: string[] = [];
  const sentenceParts: string[] = [];

  if (renderedTargets.size > 0) {
    const n = renderedTargets.size;
    shortParts.push(`renders ${n} UI`);
    sentenceParts.push(
      `renders ${n} ${n === 1 ? "component" : "components"}`
    );
  }
  if (usedHooks.size > 0) {
    const n = usedHooks.size;
    shortParts.push(`uses ${n} ${n === 1 ? "hook" : "hooks"}`);
    sentenceParts.push(`calls ${n} ${n === 1 ? "hook" : "hooks"}`);
  }
  // Only count pure imports that weren't already explained by renders/uses
  const pureImports = [...importedModules].filter(
    (id) => !renderedTargets.has(id) && !usedHooks.has(id)
  );
  if (pureImports.length > 0) {
    const n = pureImports.length;
    shortParts.push(`imports ${n}`);
    sentenceParts.push(
      `statically imports ${n} ${n === 1 ? "module" : "modules"}`
    );
  }

  const shortLabel =
    shortParts.slice(0, 2).join(" · ") ||
    `${totalEdges} ${totalEdges === 1 ? "link" : "links"}`;
  const sentence =
    sentenceParts.length > 0
      ? `Aggregated: ${fromTitle} ${sentenceParts.join(" and ")} from ${toTitle}.`
      : `Aggregated: ${totalEdges} analyzed ${totalEdges === 1 ? "connection" : "connections"} from ${fromTitle} to ${toTitle}.`;

  return {
    shortLabel,
    sentence,
    certainty: "aggregated",
    certaintyBadge: "Aggregated",
    totalEdges,
  };
}
