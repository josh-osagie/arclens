import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeProject, type AnalysisResult } from "../src/analyzeProject";
import { buildInsights } from "../src/insights";
import type { GraphNode } from "../src/types";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
export const fixturesDir = path.join(testsDir, "fixtures");
export const samplesDir = path.join(testsDir, "..", "samples");

export function fixturePath(name: string): string {
  return path.join(fixturesDir, name);
}

export async function analyzeFixture(
  name: string,
  options?: { maxFiles?: number; cache?: boolean }
): Promise<AnalysisResult> {
  return analyzeProject(fixturePath(name), { cache: false, ...options });
}

export async function analyzeSamples(options?: {
  maxFiles?: number;
  cache?: boolean;
}): Promise<AnalysisResult> {
  return analyzeProject(samplesDir, { cache: false, ...options });
}

export function nodeByName(
  result: AnalysisResult,
  name: string
): GraphNode | undefined {
  return result.graph.nodes.find((node) => node.name === name);
}

export function incomingCount(
  result: AnalysisResult,
  nodeName: string
): number {
  const node = nodeByName(result, nodeName);
  if (!node) return 0;
  return result.graph.edges.filter((edge) => edge.to === node.id).length;
}

export function outgoingEdges(
  result: AnalysisResult,
  nodeName: string,
  type?: "imports" | "renders" | "uses"
) {
  const node = nodeByName(result, nodeName);
  if (!node) return [];
  return result.graph.edges.filter(
    (edge) => edge.from === node.id && (type ? edge.type === type : true)
  );
}

export function insightTitles(result: AnalysisResult): string[] {
  return buildInsights(result).map((insight) => insight.title);
}

export function hasEdge(
  result: AnalysisResult,
  fromName: string,
  toName: string,
  type: "imports" | "renders" | "uses"
): boolean {
  const from = nodeByName(result, fromName);
  const to =
    nodeByName(result, toName) ??
    result.graph.nodes.find((n) => n.id === toName);
  if (!from || !to) return false;
  return result.graph.edges.some(
    (edge) => edge.from === from.id && edge.to === to.id && edge.type === type
  );
}
