import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { extractComponentProps, extractPropsFromDeclaration } from "../../src/extractors/props";
import { extractExportsDeclarations } from "../../src/extractors/exports";
import { analyzeSamples, nodeByName } from "../helpers";

describe("extractPropsFromDeclaration", () => {
  it("reads inline destructured prop types", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "Button.tsx",
      `export const Button = ({ onClick }: { onClick: () => void }) => <button onClick={onClick} />;`,
    );
    const [declaration] = sourceFile.getExportedDeclarations().get("Button") ?? [];
    const props = extractPropsFromDeclaration(declaration!);

    expect(props).toEqual([
      expect.objectContaining({ name: "onClick", type: "() => void", optional: false }),
    ]);
  });

  it("marks destructured defaults as optional when type info is missing", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "Badge.tsx",
      `export const Badge = ({ label = "new" }) => <span>{label}</span>;`,
    );
    const [declaration] = sourceFile.getExportedDeclarations().get("Badge") ?? [];
    const props = extractPropsFromDeclaration(declaration!);

    expect(props).toEqual([
      expect.objectContaining({ name: "label", optional: true, defaultValue: '"new"' }),
    ]);
  });

  it("reads props from a named Props interface", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "Card.tsx",
      `
        type CardProps = { title: string; count?: number };
        export function Card(props: CardProps) {
          return <div>{props.title}</div>;
        }
      `,
    );
    const [declaration] = sourceFile.getExportedDeclarations().get("Card") ?? [];
    const props = extractPropsFromDeclaration(declaration!);

    expect(props.map((prop) => prop.name)).toEqual(["title", "count"]);
    expect(props.find((prop) => prop.name === "count")?.optional).toBe(true);
  });

  it("returns no props for components without a props parameter", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "Shell.tsx",
      `export const Shell = () => <div />;`,
    );
    const [declaration] = sourceFile.getExportedDeclarations().get("Shell") ?? [];
    expect(extractPropsFromDeclaration(declaration!)).toEqual([]);
  });
});

describe("extractComponentProps integration", () => {
  it("attaches Button props in samples graph", () => {
    const result = analyzeSamples();
    const button = nodeByName(result, "Button");

    expect(button?.props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "onClick", type: "() => void" }),
        expect.objectContaining({ name: "label", type: "string" }),
      ]),
    );
  });

  it("omits props on components without parameters", () => {
    const result = analyzeSamples();
    const counter = nodeByName(result, "Counter");
    expect(counter?.props).toBeUndefined();
  });
});

describe("extractComponentProps map", () => {
  it("indexes props by node id", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "Widget.tsx",
      `export const Widget = ({ label }: { label: string }) => <span>{label}</span>;`,
    );
    const exports = extractExportsDeclarations(sourceFile);
    const propsByNodeId = extractComponentProps([sourceFile], exports);

    expect([...propsByNodeId.values()][0]).toEqual([
      expect.objectContaining({ name: "label", type: "string" }),
    ]);
  });
});
