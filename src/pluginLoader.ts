import Module from "node:module";
import path from "node:path";
import {
  getActiveEntitlements,
  getActivePlan,
  hasFeature,
  type Entitlements,
} from "./entitlements";
import { readLocalLicense } from "./license";
import type {
  ArclensPlugin,
  Graph,
  GraphExtendContext,
  GraphExtendResult,
  GraphMeta,
  GraphNode,
  GraphEdge,
  GraphInsight,
} from "./types";

const CANDIDATE_PACKAGES = ["@arclens/pro", "arclens-pro"];

export type LoadedPlugin = {
  plugin: ArclensPlugin;
  source: string;
};

function safeRequire(id: string, paths: string[]): unknown | null {
  try {
    // @ts-ignore - createRequire is available in Node 12+
    const require = Module.createRequire(path.join(paths[0] ?? process.cwd(), "__placeholder__.js"));
    return require(id);
  } catch {
    try {
      // @ts-ignore
      const require = Module.createRequire(__filename);
      return require(id);
    } catch {
      return null;
    }
  }
}

function resolvePluginSearchPaths(extra?: string[]): string[] {
  const paths = new Set<string>();
  paths.add(process.cwd());
  paths.add(path.resolve(__dirname, ".."));
  paths.add(path.resolve(__dirname, "../.."));
  try {
    const globalNodeModules = path.resolve(
      require.resolve("arclens/package.json").replace(/package\.json$/, ""),
      ".."
    );
    paths.add(globalNodeModules);
  } catch {
    /* ignore */
  }
  if (extra) for (const p of extra) paths.add(p);
  return [...paths];
}

export function loadInstalledPlugins(searchPaths?: string[]): LoadedPlugin[] {
  const paths = resolvePluginSearchPaths(searchPaths);
  const plan = getActivePlan();
  const plugins: LoadedPlugin[] = [];

  for (const candidate of CANDIDATE_PACKAGES) {
    const mod = safeRequire(candidate, paths);
    if (!mod) continue;
    const defaultExport =
      (mod as { default?: ArclensPlugin }).default ?? (mod as ArclensPlugin);
    if (defaultExport && typeof defaultExport === "object" && defaultExport.name) {
      plugins.push({ plugin: defaultExport, source: candidate });
    }
  }

  // Safety: no license active → only allow free-tier plugin hookpoints (not entitlements overrides)
  const licenseOk = Boolean(readLocalLicense());
  if (!licenseOk) return [];
  if (plan === "free") return [];

  return plugins;
}

export function applyPluginEntitlements(base: Entitlements, plugins: LoadedPlugin[]): Entitlements {
  let result: Entitlements = { ...base };
  for (const { plugin } of plugins) {
    if (!plugin.entitlements) continue;
    result =
      typeof plugin.entitlements === "function"
        ? plugin.entitlements(result)
        : {
            ...result,
            ...plugin.entitlements,
            features: {
              ...result.features,
              ...(plugin.entitlements.features ?? {}),
            },
          };
  }
  return result;
}

function mergeInsights(base: GraphInsight[] | undefined, extra: GraphInsight[] | undefined): GraphInsight[] {
  return [...(base ?? []), ...(extra ?? [])];
}

export async function runPluginExtendGraph(
  ctx: GraphExtendContext,
  plugins: LoadedPlugin[]
): Promise<{
  graph: Graph;
  warnings: string[];
}> {
  let { graph } = ctx;
  const warnings: string[] = [];

  for (const { plugin, source } of plugins) {
    if (!plugin.extendGraph) continue;
    try {
      const result: GraphExtendResult = await plugin.extendGraph(ctx);
      const nodes = (result.nodes ?? []) as GraphNode[];
      const edges = (result.edges ?? []) as GraphEdge[];
      const meta = result.meta as Partial<GraphMeta> | undefined;

      graph = {
        ...graph,
        nodes: [...graph.nodes, ...nodes],
        edges: [...graph.edges, ...edges],
        meta: {
          ...(graph.meta ?? {}),
          ...(meta ?? {}),
          insights: mergeInsights(
            meta?.insights ?? result.insights,
            graph.meta?.insights
          ),
        } as GraphMeta,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Plugin ${plugin.name} (${source}) extendGraph failed: ${msg}`);
    }
  }

  return { graph, warnings };
}

export function makeProMeta(): GraphMeta["pro"] {
  const tier = getActivePlan();
  const active = getActiveEntitlements();
  return {
    tier,
    framework: hasFeature("frameworkAdapters", active) ? "generic" : undefined,
  };
}
