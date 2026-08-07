import { Project } from "ts-morph";
import {
  extractExportsDeclarations,
  extractHookUsage,
  extractImportEdges,
  extractJsxRenders,
} from "./exports";

export function extractRenders(project: Project) {
  return project.getSourceFiles().flatMap(extractJsxRenders);
}

export function extractHookUsages(project: Project) {
  return project.getSourceFiles().flatMap(extractHookUsage);
}

export function extractEdges(project: Project) {
  return project.getSourceFiles().flatMap(extractImportEdges);
}

export function extractExports(project: Project) {
  return project.getSourceFiles().flatMap(extractExportsDeclarations);
}
