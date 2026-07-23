import { SourceFile, SyntaxKind } from "ts-morph";
import {
  classifyExport,
  resolveDefaultExportName,
} from "./reactFunction";

export type ExportRecord = {
  file: string;
  /** Resolved symbol name (e.g. App, not "default") */
  name: string;
  exportKind: "default" | "named";
  kind: string | undefined;
  type: "component" | "hook" | "utility" | "context" | "entry" | "config";
};

export function dedupeExports(exports: ExportRecord[]): ExportRecord[] {
  const byKey = new Map<string, ExportRecord>();

  for (const exp of exports) {
    const key = `${exp.file}::${exp.name}`;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, exp);
      continue;
    }

    if (existing.exportKind === "default" && exp.exportKind === "named") {
      byKey.set(key, exp);
    }
  }

  return [...byKey.values()];
}

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

export function extractExportsDeclarations(sourceFile: SourceFile): ExportRecord[] {
  const exported = sourceFile.getExportedDeclarations();
  const filePath = sourceFile.getFilePath();
  const records: ExportRecord[] = [];

  for (const [exportKey, declarations] of exported.entries()) {
    const isDefault = exportKey === "default";
    const name = isDefault
      ? resolveDefaultExportName(declarations[0], filePath)
      : exportKey;

    records.push({
      file: filePath,
      name,
      exportKind: isDefault ? "default" : "named",
      kind: declarations[0]?.getKindName(),
      type: classifyExport(name, declarations, filePath),
    });
  }

  return dedupeExports(records);
}

export { classifyExport } from "./reactFunction";

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
