import { describe, expect, it } from "vitest";
import {
  classifyHumanRole,
  describeAreaForHumans,
  explainCrossAreaRelationship,
  explainSymbolRelationship,
  humanizeAreaIdentity,
} from "../../viewer/src/humanSemantics";
import type { AtlasGraph, AtlasGraphNode } from "../../viewer/src/types";

const sampleNodes: AtlasGraphNode[] = [
  {
    id: "main",
    name: "main",
    file: "/repo/src/main.tsx",
    type: "entry",
  },
  {
    id: "loanPage",
    name: "ApplyLoanPage",
    file: "/repo/src/features/loans/routes/ApplyLoanPage.tsx",
    type: "component",
  },
  {
    id: "loanStep",
    name: "LoanParametersStep",
    file: "/repo/src/features/loans/steps/LoanParametersStep.tsx",
    type: "component",
  },
  {
    id: "useLoan",
    name: "useLoanSubmission",
    file: "/repo/src/features/loans/hooks/useLoanSubmission.ts",
    type: "hook",
  },
  {
    id: "loanApi",
    name: "loanApi",
    file: "/repo/src/features/loans/api/loanApi.ts",
    type: "utility",
  },
  {
    id: "btn",
    name: "Button",
    file: "/repo/src/components/ui/button.tsx",
    type: "component",
  },
  {
    id: "miscLib",
    name: "queryClient",
    file: "/repo/src/lib/react-query.ts",
    type: "utility",
  },
];

const sampleGraph: AtlasGraph = {
  nodes: sampleNodes,
  edges: [
    { from: "main", to: "loanPage", type: "renders" },
    { from: "loanPage", to: "loanStep", type: "renders" },
    { from: "loanPage", to: "useLoan", type: "uses" },
    { from: "useLoan", to: "loanApi", type: "imports" },
    { from: "loanPage", to: "btn", type: "renders" },
    { from: "loanPage", to: "btn", type: "renders" },
  ],
};

describe("humanSemantics", () => {
  it("classifies human roles and distinguishes direct AST facts from path/naming inferences", () => {
    expect(classifyHumanRole(sampleNodes[0]!)).toMatchObject({
      role: "entry",
      certainty: "direct",
    });

    expect(classifyHumanRole(sampleNodes[1]!)).toMatchObject({
      role: "screen",
      label: "Screen / Route",
      certainty: "inferred",
    });

    expect(classifyHumanRole(sampleNodes[2]!)).toMatchObject({
      role: "component",
      certainty: "direct",
    });

    expect(classifyHumanRole(sampleNodes[3]!)).toMatchObject({
      role: "hook",
      certainty: "direct",
    });

    expect(classifyHumanRole(sampleNodes[4]!)).toMatchObject({
      role: "service",
      certainty: "inferred",
    });

    expect(classifyHumanRole(sampleNodes[5]!)).toMatchObject({
      role: "shared-ui",
      certainty: "direct",
    });
  });

  it("uses neutral fallback labels and explains grouping evidence when folder purpose is uncertain", () => {
    const known = humanizeAreaIdentity("features/loans");
    expect(known.title).toBe("Loans");
    expect(known.isNeutralFallback).toBe(false);

    const neutral = humanizeAreaIdentity("src/lib");
    expect(neutral.title).toBe("Lib Modules");
    expect(neutral.isNeutralFallback).toBe(true);
    expect(neutral.evidenceNote).toContain("src/lib");

    const area = describeAreaForHumans("features/loans", sampleGraph);
    expect(area.startingScreens.map((n) => n.id)).toEqual(["loanPage"]);
    expect(area.purposeSummary).toContain("ApplyLoanPage");

    // Object.prototype keys like "constructor" must not resolve to Object function
    expect(humanizeAreaIdentity("features/constructor").title).toBe(
      "Constructor"
    );
    expect(humanizeAreaIdentity("components/constructor").title).toBe(
      "Constructor UI"
    );

    // Context-only area must not label its count as "1 hook"
    const contextOnlyGraph: AtlasGraph = {
      nodes: [
        {
          id: "authCtx",
          name: "AuthContext",
          file: "/repo/src/features/auth/AuthContext.tsx",
          type: "context",
        },
      ],
      edges: [],
    };
    const ctxArea = describeAreaForHumans("features/auth", contextOnlyGraph);
    expect(ctxArea.cardSubtitle).toBe("1 context");
  });

  it("explains JSX renders, hook calls, and static imports without fabricating runtime execution", () => {
    const renderExp = explainSymbolRelationship({
      sourceNode: sampleNodes[1]!,
      targetNode: sampleNodes[5]!,
      edgeTypes: ["renders"],
      count: 2,
      perspective: "outgoing",
    });
    expect(renderExp.certainty).toBe("direct");
    expect(renderExp.shortLabel).toBe("renders ×2");

    const hookExp = explainSymbolRelationship({
      sourceNode: sampleNodes[1]!,
      targetNode: sampleNodes[3]!,
      edgeTypes: ["uses"],
      perspective: "outgoing",
    });
    expect(hookExp.certainty).toBe("direct");
    expect(hookExp.shortLabel).toBe("uses hook");

    const staticImportExp = explainSymbolRelationship({
      sourceNode: sampleNodes[3]!,
      targetNode: sampleNodes[4]!,
      edgeTypes: ["imports"],
      perspective: "outgoing",
      targetRole: "service",
    });
    expect(staticImportExp.certainty).toBe("static-import");
    expect(staticImportExp.sentence).toContain("not confirmed statically");
  });

  it("summarizes cross-area relationships in plain English", () => {
    const cross = explainCrossAreaRelationship(
      "features/loans",
      "components/ui",
      sampleGraph
    );
    expect(cross.certainty).toBe("aggregated");
    expect(cross.shortLabel).toBe("renders 1 UI");
    expect(cross.sentence).toContain("Loans renders 1 component");
  });
});
