import path from "node:path";
import {
  SyntaxKind,
  type CallExpression,
  type ClassDeclaration,
  type FunctionDeclaration,
  type Identifier,
  type Node,
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

function isReactMountCall(call: CallExpression): boolean {
  const expression = call.getExpression();

  if (expression.getKind() === SyntaxKind.Identifier) {
    const name = expression.getText();
    return name === "createRoot" || name === "hydrateRoot" || name === "render";
  }

  if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
    const name = expression.getName();
    return name === "render" || name === "hydrate";
  }

  return false;
}

export function sourceFileBootstrapsReact(sourceFile: SourceFile): boolean {
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (isReactMountCall(call)) {
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

  if (sourceFileBootstrapsReact(sourceFile)) {
    return "entry";
  }

  if (isEntryFileName(filePath) && nodeHasJsx(sourceFile)) {
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

  const fn = getExportFunctionNode(node) ?? node;
  const hasJsx = nodeHasJsx(fn);
  const callsHooks = nodeCallsHooks(fn);
  const createsContext = nodeCreatesContext(fn) || nodeCreatesContext(node);

  if (hasJsx) return "component";

  if (createsContext) return "context";

  if (isCustomHookName(name) || callsHooks) return "hook";

  return "utility";
}
