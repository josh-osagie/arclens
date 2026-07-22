import fs from "node:fs";
import path from "node:path";
import { Project } from "ts-morph";
import { buildGraph } from "./buildGraph";
import {
  extractEdges,
  extractExports,
  extractHookUsages,
  extractRenders,
} from "./extractors/extracts";

const samplesDir = path.resolve(__dirname, "../samples");

const project = new Project({
  tsConfigFilePath: path.resolve(samplesDir, "tsconfig.json"),
});
project.addSourceFilesAtPaths(`${samplesDir}/**/*.{ts,tsx}`);

const graph = buildGraph(
  extractEdges(project),
  extractExports(project),
  extractRenders(project),
  extractHookUsages(project),
);

fs.writeFileSync(
  path.resolve(__dirname, "../graph.json"),
  JSON.stringify(graph, null, 2),
);
console.log("Wrote graph.json");
