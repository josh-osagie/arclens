import { SourceFile, SyntaxKind, type Node } from "ts-morph";

export type ExportRecord = ReturnType<typeof extractExportsDeclarations>[number];

export function extractImportEdges(sourceFile: SourceFile) {
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

export function extractExportsDeclarations(sourceFile: SourceFile) {
  const exported = sourceFile.getExportedDeclarations();

  return [...exported.entries()].map(([name, declarations]) => ({
    file: sourceFile.getFilePath(),
    name,
    kind: declarations[0]?.getKindName(),
    type: classifyExport(name, declarations),
  }));
}

export function classifyExport(
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

export function extractHookUsage(sourceFile: SourceFile) {
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

export function extractJsxRenders(sourceFile: SourceFile) {
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
