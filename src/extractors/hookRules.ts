import {
  SyntaxKind,
  type ArrowFunction,
  type Block,
  type CallExpression,
  type FunctionDeclaration,
  type FunctionExpression,
  type Node,
  type SourceFile,
  type Statement,
} from "ts-morph";
import {
  FUNCTION_KINDS,
  getHookCallName,
  isReactFunctionRoot,
  isReactUseHook,
} from "./reactFunction";

/** Matches @eslint-react/rules-of-hooks — https://eslint-react.xyz/docs/rules/rules-of-hooks */
export const RULES_OF_HOOKS = "@eslint-react/rules-of-hooks" as const;

export type HookRuleViolation = {
  hook: string;
  file: string;
  line: number;
  context: string;
  eslintRule: typeof RULES_OF_HOOKS;
};

const INVALID_ANCESTOR_KINDS: ReadonlyMap<number, string> = new Map([
  [SyntaxKind.IfStatement, "inside a conditional (if)"],
  [SyntaxKind.ForStatement, "inside a loop (for)"],
  [SyntaxKind.ForOfStatement, "inside a loop (for...of)"],
  [SyntaxKind.ForInStatement, "inside a loop (for...in)"],
  [SyntaxKind.WhileStatement, "inside a loop (while)"],
  [SyntaxKind.DoStatement, "inside a loop (do...while)"],
  [SyntaxKind.SwitchStatement, "inside a switch"],
  [SyntaxKind.ConditionalExpression, "inside a ternary expression"],
]);

function findReactFunctionRoot(from: Node): Node | undefined {
  let current: Node | undefined = from;
  let root: Node | undefined;

  while (current) {
    if (FUNCTION_KINDS.has(current.getKind()) && isReactFunctionRoot(current)) {
      root = current;
    }
    current = current.getParent();
  }

  return root;
}

function getFunctionBodyBlock(fn: Node): Block | undefined {
  if (
    fn.getKind() === SyntaxKind.FunctionDeclaration ||
    fn.getKind() === SyntaxKind.FunctionExpression
  ) {
    const body = (fn as FunctionDeclaration | FunctionExpression).getBody();
    return body?.getKind() === SyntaxKind.Block ? (body as Block) : undefined;
  }

  if (fn.getKind() === SyntaxKind.ArrowFunction) {
    const body = (fn as ArrowFunction).getBody();
    return body.getKind() === SyntaxKind.Block ? (body as Block) : undefined;
  }

  return undefined;
}

function isDescendantOf(ancestor: Node, descendant: Node): boolean {
  let current: Node | undefined = descendant.getParent();

  while (current) {
    if (current === ancestor) return true;
    current = current.getParent();
  }

  return false;
}

function statementContainsReturn(stmt: Statement): boolean {
  for (const ret of stmt.getDescendantsOfKind(SyntaxKind.ReturnStatement)) {
    let parent: Node | undefined = ret.getParent();

    while (parent && parent !== stmt) {
      if (FUNCTION_KINDS.has(parent.getKind())) {
        break;
      }
      parent = parent.getParent();
    }

    if (parent === stmt) {
      return true;
    }
  }

  return false;
}

function findEarlyReturnViolation(
  call: CallExpression,
  rootFn: Node
): string | null {
  const body = getFunctionBodyBlock(rootFn);
  if (!body) return null;

  const statements = body.getStatements();

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!isDescendantOf(stmt, call)) continue;

    for (let j = 0; j < i; j++) {
      if (statementContainsReturn(statements[j])) {
        return "after an early return";
      }
    }

    return null;
  }

  return null;
}

function findNestedFunctionViolation(
  call: CallExpression,
  rootFn: Node
): string | null {
  let node: Node | undefined = call.getParent();

  while (node && node !== rootFn) {
    if (FUNCTION_KINDS.has(node.getKind())) {
      return "inside a nested function or callback";
    }
    node = node.getParent();
  }

  return null;
}

function findTryCatchViolation(
  call: CallExpression,
  hookName: string,
  rootFn: Node
): string | null {
  if (!isReactUseHook(hookName)) return null;

  let node: Node | undefined = call.getParent();

  while (node && node !== rootFn) {
    if (node.getKind() === SyntaxKind.TryStatement) {
      return "inside a try block";
    }
    node = node.getParent();
  }

  return null;
}

function findConditionalOrLoopViolation(
  call: CallExpression,
  hookName: string,
  rootFn: Node
): string | null {
  if (isReactUseHook(hookName)) return null;

  let node: Node | undefined = call.getParent();

  while (node && node !== rootFn) {
    const invalidContext = INVALID_ANCESTOR_KINDS.get(node.getKind());
    if (invalidContext) {
      return invalidContext;
    }
    node = node.getParent();
  }

  return null;
}

function findHookRuleViolation(
  call: CallExpression,
  hookName: string
): string | null {
  const rootFn = findReactFunctionRoot(call);
  if (!rootFn) return null;

  return (
    findNestedFunctionViolation(call, rootFn) ??
    findTryCatchViolation(call, hookName, rootFn) ??
    findEarlyReturnViolation(call, rootFn) ??
    findConditionalOrLoopViolation(call, hookName, rootFn)
  );
}

/**
 * Detect Rules of Hooks violations via AST structure.
 * Subset of @eslint-react/rules-of-hooks — we do not run ESLint.
 * @see https://eslint-react.xyz/docs/rules/rules-of-hooks
 */
export function detectHookRuleViolations(
  sourceFiles: SourceFile[]
): HookRuleViolation[] {
  const violations: HookRuleViolation[] = [];

  for (const sourceFile of sourceFiles) {
    for (const call of sourceFile.getDescendantsOfKind(
      SyntaxKind.CallExpression
    )) {
      const hookName = getHookCallName(call.getExpression());
      if (!hookName) continue;

      const context = findHookRuleViolation(call, hookName);
      if (!context) continue;

      violations.push({
        hook: hookName,
        file: sourceFile.getFilePath(),
        line: call.getStartLineNumber(),
        context,
        eslintRule: RULES_OF_HOOKS,
      });
    }
  }

  return violations;
}
