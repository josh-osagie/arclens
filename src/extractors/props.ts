import { Node, ParameterDeclaration, SourceFile, SyntaxKind } from "ts-morph";
import type { ExportRecord } from "./exports";
import { nodeId } from "./find";
import { getExportFunctionNode, FUNCTION_KINDS } from "./reactFunction";
import type { GraphProp } from "../types";

const MAX_TYPE_LENGTH = 96;

function truncateType(typeText: string | undefined): string | undefined {
  if (!typeText) return undefined;
  const trimmed = typeText.replace(/\s+/g, " ").trim();
  if (trimmed.length <= MAX_TYPE_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_TYPE_LENGTH - 1)}…`;
}

function getFunctionParameters(fn: Node): ParameterDeclaration[] {
  if (Node.isFunctionDeclaration(fn)) return fn.getParameters();
  if (Node.isArrowFunction(fn)) return fn.getParameters();
  if (Node.isFunctionExpression(fn)) return fn.getParameters();
  return [];
}

function propsFromTypeChecker(param: ParameterDeclaration): GraphProp[] {
  const type = param.getType();
  if (type.isAny() || type.isUnknown()) return [];

  const props: GraphProp[] = [];

  for (const property of type.getProperties()) {
    const name = property.getName();
    if (name.startsWith("__")) continue;

    const propType = property.getTypeAtLocation(param);
    props.push({
      name,
      type: truncateType(propType.getText(param)),
      optional: property.isOptional(),
    });
  }

  return props;
}

function propsFromBindingPattern(param: ParameterDeclaration): GraphProp[] {
  const binding = param.getNameNode();
  if (!Node.isObjectBindingPattern(binding)) return [];

  const typed = propsFromTypeChecker(param);
  const typedByName = new Map(typed.map((prop) => [prop.name, prop]));

  return binding.getElements().map((element) => {
    const name = element.getName();
    const fromType = typedByName.get(name);

    return {
      name,
      type: fromType?.type,
      optional:
        fromType?.optional ??
        (element.hasInitializer() ||
          element.getChildrenOfKind(SyntaxKind.QuestionToken).length > 0),
      defaultValue: element.getInitializer()?.getText(),
    };
  });
}

function extractPropsFromParameter(param: ParameterDeclaration): GraphProp[] {
  const binding = param.getNameNode();

  if (binding.getKind() === SyntaxKind.ObjectBindingPattern) {
    const fromBinding = propsFromBindingPattern(param);
    if (fromBinding.length > 0) return fromBinding;
  }

  const fromType = propsFromTypeChecker(param);
  if (fromType.length > 0) return fromType;

  if (binding.getKind() === SyntaxKind.Identifier) {
    const name = binding.getText();
    if (name !== "props" && name !== "_props") {
      return [{ name, optional: param.isOptional() }];
    }
  }

  return [];
}

function exportDeclarationForRecord(
  sourceFile: SourceFile,
  exportRecord: ExportRecord
): Node | undefined {
  const exported = sourceFile.getExportedDeclarations();
  const key =
    exportRecord.exportKind === "default" ? "default" : exportRecord.name;
  const declarations = exported.get(key);
  return declarations?.[0];
}

export function extractPropsFromDeclaration(declaration: Node): GraphProp[] {
  const fn =
    getExportFunctionNode(declaration) ??
    (FUNCTION_KINDS.has(declaration.getKind()) ? declaration : undefined);
  if (!fn) return [];

  const [firstParam] = getFunctionParameters(fn);
  if (!firstParam) return [];

  return extractPropsFromParameter(firstParam);
}

export function extractComponentProps(
  sourceFiles: SourceFile[],
  exports: ExportRecord[]
): Map<string, GraphProp[]> {
  const byFile = new Map<string, SourceFile>(
    sourceFiles.map((file) => [String(file.getFilePath()), file])
  );
  const propsByNodeId = new Map<string, GraphProp[]>();

  for (const exportRecord of exports) {
    if (exportRecord.type !== "component") continue;

    const sourceFile = byFile.get(exportRecord.file);
    if (!sourceFile) continue;

    const declaration = exportDeclarationForRecord(sourceFile, exportRecord);
    if (!declaration) continue;

    try {
      const props = extractPropsFromDeclaration(declaration);
      if (props.length === 0) continue;
      propsByNodeId.set(nodeId(exportRecord), props);
    } catch {
      // Skip props for components with patterns we can't parse yet.
    }
  }

  return propsByNodeId;
}
