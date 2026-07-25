import path from "node:path";
import { isAppEntryFile, isNonProductionFile } from "../entryPoints";
import {
  SyntaxKind,
  type CallExpression,
  type ClassDeclaration,
  type FunctionDeclaration,
  type Identifier,
  type Node,
  type PropertyAccessExpression,
  type SourceFile,
  type VariableDeclaration,
} from "ts-morph";

export const FUNCTION_KINDS = new Set<number>([
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.FunctionExpression,
  SyntaxKind.ArrowFunction,
]);

export function isCustomHookName(name: string): boolean {
  return /^use[A-Z]/.test(name);
}

export function isReactUseHook(name: string): boolean {
  return name === "use";
}

export function isPascalCase(name: string): boolean {
  return /^[A-Z]/.test(name);
}

export function nodeHasJsx(node: Node): boolean {
  return (
    node.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0 ||
    node.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0 ||
    node.getDescendantsOfKind(SyntaxKind.JsxFragment).length > 0
  );
}

export function getHookCallName(expression: Node): string | null {
  const text = expression.getText();

  if (/^use[A-Z]\w*$/.test(text) || text === "use") {
    return text;
  }

  if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
    const name = expression.getChildAtIndexIfKind(2, SyntaxKind.Identifier)?.getText();
    if (name && (/^use[A-Z]\w*$/.test(name) || name === "use")) {
      return name;
    }
  }

  return null;
}

export function nodeCallsHooks(node: Node): boolean {
  for (const call of node.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (getHookCallName(call.getExpression())) {
      return true;
    }
  }

  return false;
}

export function nodeCreatesContext(node: Node): boolean {
  for (const call of node.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const text = call.getExpression().getText();
    if (text === "createContext" || text.endsWith(".createContext")) {
      return true;
    }
  }

  return false;
}

/** Resolve the function node from an export declaration (handles `export const X = () => {}`). */
export function getExportFunctionNode(declaration: Node): Node | undefined {
  if (FUNCTION_KINDS.has(declaration.getKind())) {
    return declaration;
  }

  if (declaration.getKind() === SyntaxKind.VariableDeclaration) {
    const init = (declaration as VariableDeclaration).getInitializer();
    if (init && FUNCTION_KINDS.has(init.getKind())) {
      return init;
    }
  }

  return undefined;
}

/**
 * A React component or custom hook function — identified by structure, not naming.
 * Components return JSX; hooks call other hooks.
 */
export function isReactFunctionNode(fn: Node): boolean {
  return nodeHasJsx(fn) || nodeCallsHooks(fn);
}

export function resolveDefaultExportName(
  declaration: Node | undefined,
  filePath: string,
): string {
  const fallback = path.basename(filePath, path.extname(filePath));

  if (!declaration) return fallback;

  if (declaration.getKind() === SyntaxKind.FunctionDeclaration) {
    const name = (declaration as FunctionDeclaration).getName();
    if (name) return name;
  }

  if (declaration.getKind() === SyntaxKind.ClassDeclaration) {
    const name = (declaration as ClassDeclaration).getName();
    if (name) return name;
  }

  const fn = getExportFunctionNode(declaration);
  if (fn) {
    const boundName = getBoundExportName(fn);
    if (boundName) return boundName;
  }

  if (declaration.getKind() === SyntaxKind.Identifier) {
    return (declaration as Identifier).getText();
  }

  return fallback;
}

export function isConfigFile(filePath: string): boolean {
  return /\.config\.(ts|tsx|js|jsx|mts|mjs|cjs)$/i.test(path.basename(filePath));
}

const ENTRY_FILE_NAMES = new Set(["main", "index"]);

export function isEntryFileName(filePath: string): boolean {
  const base = path.basename(filePath, path.extname(filePath));
  return ENTRY_FILE_NAMES.has(base);
}

function isTestingLibraryModule(moduleSpecifier: string): boolean {
  return (
    moduleSpecifier === "@testing-library/react" ||
    moduleSpecifier.startsWith("@testing-library/react/") ||
    moduleSpecifier === "@testing-library/react-native" ||
    moduleSpecifier.startsWith("@testing-library/react-native/")
  );
}

function collectTestingLibraryRenderBindings(sourceFile: SourceFile): Set<string> {
  const bindings = new Set<string>();

  for (const importDecl of sourceFile.getImportDeclarations()) {
    if (!isTestingLibraryModule(importDecl.getModuleSpecifierValue())) continue;

    for (const named of importDecl.getNamedImports()) {
      if (named.getName() === "render") {
        bindings.add(named.getName());
      }
    }

    const defaultImport = importDecl.getDefaultImport();
    if (defaultImport?.getText() === "render") {
      bindings.add("render");
    }
  }

  return bindings;
}

function isCreateRootRenderChain(call: CallExpression): boolean {
  const expression = call.getExpression();
  if (expression.getKind() !== SyntaxKind.PropertyAccessExpression) return false;

  const access = expression as PropertyAccessExpression;
  if (access.getName() !== "render") return false;

  const target = access.getExpression();
  if (target.getKind() !== SyntaxKind.CallExpression) return false;

  const innerExpr = (target as CallExpression).getExpression();
  if (innerExpr.getKind() !== SyntaxKind.Identifier) return false;

  const name = innerExpr.getText();
  return name === "createRoot" || name === "hydrateRoot";
}

function isLegacyReactDomMount(call: CallExpression): boolean {
  const expression = call.getExpression();
  if (expression.getKind() !== SyntaxKind.PropertyAccessExpression) return false;

  const access = expression as PropertyAccessExpression;
  const method = access.getName();
  if (method !== "render" && method !== "hydrate") return false;

  const objectText = access.getExpression().getText();
  return objectText === "ReactDOM" || objectText.endsWith(".ReactDOM");
}

function isAppBootstrapMountCall(
  call: CallExpression,
  testingLibraryRenderBindings: Set<string>,
): boolean {
  if (isCreateRootRenderChain(call) || isLegacyReactDomMount(call)) {
    return true;
  }

  const expression = call.getExpression();
  if (expression.getKind() !== SyntaxKind.Identifier) return false;

  const name = expression.getText();
  if (name !== "render" && name !== "hydrate") return false;

  return !testingLibraryRenderBindings.has(name);
}

export function sourceFileBootstrapsReact(sourceFile: SourceFile): boolean {
  if (isNonProductionFile(sourceFile.getFilePath())) {
    return false;
  }

  const testingLibraryRenderBindings = collectTestingLibraryRenderBindings(sourceFile);

  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (isAppBootstrapMountCall(call, testingLibraryRenderBindings)) {
      return true;
    }
  }

  return false;
}

export function classifyFileModule(
  sourceFile: SourceFile,
): "entry" | "config" | "utility" {
  const filePath = sourceFile.getFilePath();

  if (isConfigFile(filePath)) {
    return "config";
  }

  if (isNonProductionFile(filePath)) {
    return "utility";
  }

  if (isAppEntryFile(filePath)) {
    return "entry";
  }

  if (sourceFileBootstrapsReact(sourceFile)) {
    return "entry";
  }

  return "utility";
}

export function getBoundExportName(fn: Node): string | undefined {
  if (fn.getKind() === SyntaxKind.FunctionDeclaration) {
    return (fn as FunctionDeclaration).getName();
  }

  const parent = fn.getParent();
  if (parent?.getKind() === SyntaxKind.VariableDeclaration) {
    return (parent as VariableDeclaration).getName();
  }

  return undefined;
}

export function isReactFunctionRoot(fn: Node): boolean {
  if (!FUNCTION_KINDS.has(fn.getKind())) {
    return false;
  }

  return isReactFunctionNode(fn);
}

const REACT_COMPONENT_WRAPPERS = new Set(["memo", "forwardRef", "lazy"]);

function unwrapReactWrapperCall(node: Node): Node | undefined {
  if (node.getKind() !== SyntaxKind.CallExpression) return undefined;

  const call = node as CallExpression;
  const expression = call.getExpression();
  let calleeName: string | undefined;

  if (expression.getKind() === SyntaxKind.Identifier) {
    calleeName = expression.getText();
  } else if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
    calleeName = (expression as PropertyAccessExpression).getName();
  }

  if (!calleeName || !REACT_COMPONENT_WRAPPERS.has(calleeName)) {
    return undefined;
  }

  const inner = call.getArguments()[0];
  if (!inner) return undefined;

  if (FUNCTION_KINDS.has(inner.getKind())) {
    return inner;
  }

  if (inner.getKind() === SyntaxKind.FunctionDeclaration) {
    return inner;
  }

  return undefined;
}

/**
 * The function/class wrapped by an export — not nested callbacks inside config objects.
 * Column defs and similar const exports stay utility even when a nested cell renderer has JSX.
 */
export function getComponentRoot(node: Node): Node | undefined {
  if (
    node.getKind() === SyntaxKind.FunctionDeclaration ||
    node.getKind() === SyntaxKind.ClassDeclaration
  ) {
    return node;
  }

  const fn = getExportFunctionNode(node);
  if (fn) return fn;

  if (node.getKind() === SyntaxKind.VariableDeclaration) {
    const init = (node as VariableDeclaration).getInitializer();
    if (!init) return undefined;
    if (FUNCTION_KINDS.has(init.getKind())) return init;
    return unwrapReactWrapperCall(init);
  }

  if (FUNCTION_KINDS.has(node.getKind())) {
    return node;
  }

  return undefined;
}

export function isComponentExport(node: Node): boolean {
  const root = getComponentRoot(node);
  if (!root) return false;
  return nodeHasJsx(root);
}

export function classifyExport(
  name: string,
  declarations: Node[],
  filePath?: string,
): "component" | "hook" | "utility" | "context" | "entry" | "config" {
  if (filePath && isConfigFile(filePath)) {
    return "config";
  }

  const node = declarations[0];
  if (!node) return "utility";

  const componentRoot = getComponentRoot(node);
  const hookCheckNode = componentRoot ?? getExportFunctionNode(node) ?? node;
  const createsContext =
    nodeCreatesContext(node) ||
    (componentRoot ? nodeCreatesContext(componentRoot) : false);

  if (componentRoot && nodeHasJsx(componentRoot)) return "component";

  if (createsContext) return "context";

  if (isCustomHookName(name) || nodeCallsHooks(hookCheckNode)) return "hook";

  return "utility";
}
