import { describe, expect, it } from "vitest";
import { buildFeatureStoryView } from "../../viewer/src/storyGraph";
import type { AtlasGraph } from "../../viewer/src/types";

const storyFixture: AtlasGraph = {
  nodes: [
    {
      id: "router",
      name: "LendhaRouter",
      file: "/repo/src/routing/LendhaRouter.tsx",
      type: "component",
    },
    {
      id: "applyPage",
      name: "ApplyLoanPage",
      file: "/repo/src/features/loans/routes/ApplyLoanPage.tsx",
      type: "component",
    },
    {
      id: "step1",
      name: "LoanParametersStep",
      file: "/repo/src/features/loans/steps/LoanParametersStep.tsx",
      type: "component",
    },
    {
      id: "useSubmit",
      name: "useLoanSubmission",
      file: "/repo/src/features/loans/hooks/useLoanSubmission.ts",
      type: "hook",
    },
    {
      id: "uiBtn",
      name: "Button",
      file: "/repo/src/components/ui/button.tsx",
      type: "component",
    },
    {
      id: "uiInput",
      name: "Input",
      file: "/repo/src/components/ui/input.tsx",
      type: "component",
    },
    {
      id: "uiSelect",
      name: "Select",
      file: "/repo/src/components/ui/select.tsx",
      type: "component",
    },
    {
      id: "uiCard",
      name: "Card",
      file: "/repo/src/components/ui/card.tsx",
      type: "component",
    },
  ],
  edges: [
    { from: "router", to: "applyPage", type: "renders" },
    { from: "applyPage", to: "step1", type: "renders" },
    { from: "applyPage", to: "useSubmit", type: "uses" },
    { from: "applyPage", to: "uiBtn", type: "renders" },
    { from: "applyPage", to: "uiBtn", type: "renders" },
    { from: "applyPage", to: "uiInput", type: "renders" },
    { from: "applyPage", to: "uiSelect", type: "renders" },
    { from: "applyPage", to: "uiCard", type: "renders" },
  ],
};

describe("storyGraph", () => {
  it("arranges upstream callers on left, focus anchor in center, and collapses >=3 shared UI primitives on right", () => {
    const built = buildFeatureStoryView(storyFixture, "applyPage");
    expect(built).not.toBeNull();

    const ids = built!.nodes.map((n) => n.id);
    expect(ids).toContain("router");
    expect(ids).toContain("applyPage");
    expect(ids).toContain("step1");
    expect(ids).toContain("useSubmit");
    expect(ids).toContain("story-group::shared-ui");

    // Individual shared UI primitives are folded into the expandable group at rest
    expect(ids).not.toContain("uiBtn");
    expect(ids).not.toContain("uiInput");

    const routerNode = built!.nodes.find((n) => n.id === "router")!;
    const anchorNode = built!.nodes.find((n) => n.id === "applyPage")!;
    const stepNode = built!.nodes.find((n) => n.id === "step1")!;
    expect(routerNode.position.x).toBeLessThan(anchorNode.position.x);
    expect(anchorNode.position.x).toBeLessThan(stepNode.position.x);
  });

  it("reveals all grouped shared UI primitives when expandedGroups includes shared-ui", () => {
    const expanded = buildFeatureStoryView(
      storyFixture,
      "applyPage",
      new Set(["shared-ui"])
    );
    const ids = expanded!.nodes.map((n) => n.id);
    expect(ids).toContain("story-group::shared-ui");
    expect(ids).toContain("uiBtn");
    expect(ids).toContain("uiInput");
    expect(ids).toContain("uiSelect");
    expect(ids).toContain("uiCard");
  });

  it("uses import wording instead of claiming renders when components are only statically imported", () => {
    const importOnlyFixture: AtlasGraph = {
      nodes: storyFixture.nodes,
      edges: [
        { from: "applyPage", to: "step1", type: "imports" },
        { from: "applyPage", to: "uiBtn", type: "imports" },
        { from: "applyPage", to: "uiInput", type: "imports" },
        { from: "applyPage", to: "uiSelect", type: "imports" },
      ],
    };

    const built = buildFeatureStoryView(importOnlyFixture, "applyPage");
    expect(built).not.toBeNull();

    const anchor = built!.nodes.find((n) => n.id === "applyPage")!;
    const summary = String(
      (anchor.data as unknown as { summary: string }).summary
    );
    expect(summary).toContain("imports 1 feature component");
    expect(summary).toContain("imports 3 shared UI primitives");
    expect(summary).not.toContain("Directly renders");

    const sharedEdge = built!.edges.find(
      (e) => e.id === "story-out::shared-ui"
    )!;
    expect(sharedEdge.label).toBe("imports 3 shared UI");
  });
});
