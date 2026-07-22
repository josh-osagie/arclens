import {
  JsxOpeningElement,
  JsxSelfClosingElement,
  Project,
  SyntaxKind,
  type Node,
  type SourceFile,
} from "ts-morph";
import path from "node:path";

const samplesDir = path.resolve(__dirname, "../samples");

const project = new Project({
  tsConfigFilePath: path.resolve(samplesDir, "tsconfig.json"),
});
project.addSourceFilesAtPaths(`${samplesDir}/**/*.{ts,tsx}`);

const edges = project.getSourceFiles().flatMap(extractImportEdges);
const exportsEdges = project.getSourceFiles().flatMap(extractExports);
const renders = project.getSourceFiles().flatMap(extractJsxRenders);
const hookUsages = project.getSourceFiles().flatMap(extractHookUsage);

function extractImportEdges(sourceFile: SourceFile) {
  return sourceFile.getImportDeclarations().map((i) => ({
    from: sourceFile.getFilePath(),
    to: i.getModuleSpecifierValue(),
    defaultImport: i.getDefaultImport()?.getText(),
    namedImports: i.getNamedImports().map((n) => n.getName()),
    line: i.getStartLineNumber(),
    isTypeOnly: i.isTypeOnly(),
    resolvedTo: i.getModuleSpecifierSourceFile()?.getFilePath(),
  }));
}

function extractExports(sourceFile: SourceFile) {
  const exported = sourceFile.getExportedDeclarations();

  return [...exported.entries()].map(([name, declarations]) => ({
    file: sourceFile.getFilePath(),
    name,
    kind: declarations[0]?.getKindName(),
    type: classifyExport(name, declarations),
  }));
}

function getJsxTagName(
  element: JsxSelfClosingElement | JsxOpeningElement,
): string | undefined {
  const tagNameNode = element.getTagNameNode();
  return tagNameNode?.getText(); // "Button", "div", "p"
}

function isComponentTag(name: string): boolean {
  return /^[A-Z]/.test(name);
}

function extractJsxRenders(sourceFile: SourceFile) {
  const jsxElements = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
  ];

  return jsxElements
    .map((element) => {
      const tagName = element.getTagNameNode()?.getText();
      if (!tagName || !/^[A-Z]/.test(tagName)) return null;

      return {
        file: sourceFile.getFilePath(),
        renders: tagName,
        line: element.getStartLineNumber(),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

function classifyExport(
  name: string,
  declarations: Node[],
): "component" | "hook" | "service" {
  if (/^use[A-Z]/.test(name)) return "hook";

  const node = declarations[0];
  if (!node) return "service";

  const hasJsx =
    node.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0 ||
    node.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0;

  if (/^[A-Z]/.test(name) && hasJsx) return "component";

  return "service";
}

function extractHookUsage(sourceFile: SourceFile) {
  return sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .map((call) => {
      const name = call.getExpression().getText();
      if (!/^use[A-Z]/.test(name)) return null;

      return {
        file: sourceFile.getFilePath(),
        uses: name,
        line: call.getStartLineNumber(),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

type GraphNode = {
  id: string;
  name: string;
  file: string;
  type: "component" | "hook" | "service";
};

type GraphEdge = {
  from: string;
  to: string;
  type: "imports" | "renders" | "uses";
};

type Graph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

type ExportRecord = ReturnType<typeof extractExports>[number];

function findExportByFile(exports: ExportRecord[], file: string) {
  return exports.find((e) => e.file === file);
}

function findExportByName(exports: ExportRecord[], name: string) {
  return exports.find((e) => e.name === name);
}

function buildGraph(
  importEdges: ReturnType<typeof extractImportEdges>,
  exports: ExportRecord[],
  renders: ReturnType<typeof extractJsxRenders>,
  uses: ReturnType<typeof extractHookUsage>,
): Graph {
  const nodes: GraphNode[] = exports.map((e) => ({
    id: `${e.file}::${e.name}`,
    name: e.name,
    file: e.file,
    type: e.type,
  }));

  const graphEdges: GraphEdge[] = [];

  for (const imp of importEdges) {
    const fromNode = findExportByFile(exports, imp.from);
    if (!fromNode || !imp.resolvedTo || imp.resolvedTo.includes("node_modules")) {
      continue;
    }

    const symbols = [
      ...(imp.defaultImport ? [imp.defaultImport] : []),
      ...imp.namedImports,
    ];

    for (const symbol of symbols) {
      const toNode = findExportByName(exports, symbol);
      if (toNode) {
        graphEdges.push({
          from: nodeId(fromNode),
          to: nodeId(toNode),
          type: "imports",
        });
      }
    }
  }

  for (const render of renders) {
    const fromNode = findExportByFile(exports, render.file);
    const toNode = findExportByName(exports, render.renders);
    if (!fromNode || !toNode) continue;

    graphEdges.push({
      from: fromNode.name,
      to: toNode.name,
      type: "renders",
    });
  }

  for (const use of uses) {
    const fromNode = findExportByFile(exports, use.file);
    if (!fromNode) continue;

    if (!nodes.some((node) => node.id === use.uses)) {
      nodes.push({
        id: use.uses,
        name: use.uses,
        file: "external",
        type: "hook",
      });
    }

    graphEdges.push({
      from: fromNode.name,
      to: use.uses,
      type: "uses",
    });
  }

  return { nodes, edges: graphEdges };
}

function nodeId(exportRecord: ExportRecord) {
  return `${exportRecord.file}::${exportRecord.name}`;
}

import fs from "node:fs";
const graph = buildGraph(edges, exportsEdges, renders, hookUsages);
fs.writeFileSync(
  path.resolve(__dirname, "../graph.json"),
  JSON.stringify(graph, null, 2),
);
console.log("Wrote graph.json");