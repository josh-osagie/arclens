import path from "node:path";
import { Node, SourceFile, SyntaxKind } from "ts-morph";
import { classifyExport, resolveDefaultExportName } from "./reactFunction";

export type ExportRecord = {
  file: string;
  /** Resolved symbol name (e.g. App, not "default") */
  name: string;
  exportKind: "default" | "named";
  kind: string | undefined;
  type: "component" | "hook" | "utility" | "context" | "entry" | "config";
};

export type ReExportRecord = {
  file: string;
  exportName: string;
  targetFile: string;
  targetName: string;
};

const NON_RUNTIME_EXPORT_KINDS = new Set<SyntaxKind>([
  SyntaxKind.InterfaceDeclaration,
  SyntaxKind.TypeAliasDeclaration,
  SyntaxKind.TypeParameter,
  SyntaxKind.ModuleDeclaration,
  SyntaxKind.SourceFile,
]);

function hasInlineExportModifier(node: Node): boolean {
  let current: Node | undefined = node;
  while (current && !Node.isSourceFile(current)) {
    if (Node.isExportable(current) && current.isExported()) {
      return true;
    }
    if (Node.isVariableStatement(current) && current.isExported()) {
      return true;
    }
    current = current.getParent();
  }
  return false;
}

function collectTypeOnlyNamedExports(sourceFile: SourceFile): Set<string> {
  const typeOnly = new Set<string>();
  const valueNamed = new Set<string>();

  for (const decl of sourceFile.getExportDeclarations()) {
    const declTypeOnly = decl.isTypeOnly();
    for (const named of decl.getNamedExports()) {
      const name = (named.getAliasNode() ?? named.getNameNode()).getText();
      if (declTypeOnly || named.isTypeOnly()) {
        typeOnly.add(name);
      } else {
        valueNamed.add(name);
      }
    }
  }

  for (const name of valueNamed) {
    typeOnly.delete(name);
  }
  return typeOnly;
}

function isRuntimeLocalDeclaration(
  decl: Node,
  normalizedFilePath: string
): boolean {
  if (NON_RUNTIME_EXPORT_KINDS.has(decl.getKind())) return false;
  return path.normalize(decl.getSourceFile().getFilePath()) === normalizedFilePath;
}

function resolveReExportTargetName(
  decl: Node,
  exportKey: string,
  targetFile: string
): string {
  if (Node.isFunctionDeclaration(decl) || Node.isClassDeclaration(decl)) {
    return decl.getName() ?? resolveDefaultExportName(decl, targetFile);
  }
  if (Node.isVariableDeclaration(decl)) {
    return decl.getName();
  }
  if (exportKey === "default") {
    return resolveDefaultExportName(decl, targetFile);
  }
  return exportKey;
}

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
    defaultImport: i.isTypeOnly() ? undefined : i.getDefaultImport()?.getText(),
    namedImports: i.isTypeOnly()
      ? []
      : i
          .getNamedImports()
          .filter((n) => !n.isTypeOnly())
          .map((n) => n.getName()),
    line: i.getStartLineNumber(),
    isTypeOnly: i.isTypeOnly(),
    resolvedTo: i.getModuleSpecifierSourceFile()?.getFilePath(),
  }));
}

export function extractExportsDeclarations(
  sourceFile: SourceFile
): ExportRecord[] {
  const exported = sourceFile.getExportedDeclarations();
  const filePath = sourceFile.getFilePath();
  const normalizedFilePath = path.normalize(filePath);
  const typeOnlyNamedExports = collectTypeOnlyNamedExports(sourceFile);
  const records: ExportRecord[] = [];

  for (const [exportKey, declarations] of exported.entries()) {
    const runtimeDecls = declarations.filter((decl) =>
      isRuntimeLocalDeclaration(decl, normalizedFilePath)
    );
    if (runtimeDecls.length === 0) continue;

    if (
      typeOnlyNamedExports.has(exportKey) &&
      !runtimeDecls.some((decl) => hasInlineExportModifier(decl))
    ) {
      continue;
    }

    const isDefault = exportKey === "default";
    const name = isDefault
      ? resolveDefaultExportName(runtimeDecls[0], filePath)
      : exportKey;

    records.push({
      file: filePath,
      name,
      exportKind: isDefault ? "default" : "named",
      kind: runtimeDecls[0]?.getKindName(),
      type: classifyExport(name, runtimeDecls, filePath),
    });
  }

  return dedupeExports(records);
}

/** Capture barrel re-exports (`export { X } from "./X"`, `export * from "./X"`) without creating duplicate nodes. */
export function extractReExports(sourceFile: SourceFile): ReExportRecord[] {
  const exported = sourceFile.getExportedDeclarations();
  const filePath = sourceFile.getFilePath();
  const normalizedFilePath = path.normalize(filePath);
  const typeOnlyNamedExports = collectTypeOnlyNamedExports(sourceFile);
  const reExports: ReExportRecord[] = [];

  for (const [exportKey, declarations] of exported.entries()) {
    if (typeOnlyNamedExports.has(exportKey)) continue;

    const hasLocalRuntime = declarations.some((decl) =>
      isRuntimeLocalDeclaration(decl, normalizedFilePath)
    );
    if (hasLocalRuntime) continue;

    const externalRuntime = declarations.find((decl) => {
      if (NON_RUNTIME_EXPORT_KINDS.has(decl.getKind())) return false;
      const targetFile = path.normalize(decl.getSourceFile().getFilePath());
      return targetFile !== normalizedFilePath && !targetFile.includes(`${path.sep}node_modules${path.sep}`);
    });
    if (!externalRuntime) continue;

    const targetFile = externalRuntime.getSourceFile().getFilePath();
    reExports.push({
      file: filePath,
      exportName: exportKey,
      targetFile,
      targetName: resolveReExportTargetName(
        externalRuntime,
        exportKey,
        targetFile
      ),
    });
  }

  return reExports;
}

function topLevelStatement(node: Node): Node | undefined {
  let current: Node | undefined = node;
  while (current && current.getParent() && !Node.isSourceFile(current.getParent())) {
    current = current.getParent();
  }
  return current;
}

function isReferenceIdentifier(id: Node): boolean {
  const parent = id.getParent();
  if (!parent) return false;
  if (Node.isImportSpecifier(parent) || Node.isImportClause(parent)) return false;
  if (Node.isExportSpecifier(parent) || Node.isExportAssignment(parent)) return false;
  if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === id) {
    return false;
  }
  if (Node.isPropertyAssignment(parent) && parent.getNameNode() === id) {
    return false;
  }
  if (Node.isTypeReference(parent) || Node.isInterfaceDeclaration(parent) || Node.isTypeAliasDeclaration(parent)) {
    return false;
  }
  if (
    (Node.isFunctionDeclaration(parent) ||
      Node.isVariableDeclaration(parent) ||
      Node.isClassDeclaration(parent)) &&
    parent.getNameNode() === id
  ) {
    return false;
  }
  return true;
}

/** Exported symbols used by another top-level declaration in the same file (e.g. cva variants). */
export function extractSameFileExportRefs(
  sourceFile: SourceFile,
  exports: ExportRecord[]
): string[] {
  if (exports.length <= 1) return [];

  const filePath = path.normalize(sourceFile.getFilePath());
  const exportStatements = new Map<string, Set<Node>>();
  const exported = sourceFile.getExportedDeclarations();

  for (const exp of exports) {
    if (path.normalize(exp.file) !== filePath) continue;
    const key = exp.exportKind === "default" ? "default" : exp.name;
    const decls = exported.get(key) ?? exported.get(exp.name) ?? [];
    const stmts = new Set<Node>();
    for (const decl of decls) {
      const stmt = topLevelStatement(decl);
      if (stmt) stmts.add(stmt);
    }
    if (stmts.size > 0) {
      exportStatements.set(exp.name, stmts);
    }
  }

  const referenced = new Set<string>();
  for (const id of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
    const name = id.getText();
    const ownStmts = exportStatements.get(name);
    if (!ownStmts || referenced.has(name)) continue;
    if (!isReferenceIdentifier(id)) continue;

    const usageStmt = topLevelStatement(id);
    if (usageStmt && !ownStmts.has(usageStmt)) {
      referenced.add(name);
    }
  }

  return [...referenced];
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
