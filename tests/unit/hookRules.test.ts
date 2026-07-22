import { describe, expect, it } from "vitest";
import { detectHookRuleViolations } from "../../src/extractors/hookRules";
import { Project } from "ts-morph";

function analyzeSource(source: string, fileName = "/Component.tsx") {
  const project = new Project({ useInMemoryFileSystem: true });
  const file = project.createSourceFile(fileName, source);
  return detectHookRuleViolations([file]);
}

describe("hookRules", () => {
  it("flags useEffect inside a conditional", () => {
    const violations = analyzeSource(`
      export function Counter() {
        const [count, setCount] = useState(0);
        if (count > 10) {
          useEffect(() => {}, [count]);
        }
        return <div>{count}</div>;
      }
    `);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.hook).toBe("useEffect");
    expect(violations[0]?.context).toContain("conditional");
    expect(violations[0]?.eslintRule).toBe("@eslint-react/rules-of-hooks");
  });

  it("flags hooks in lowercase-named components", () => {
    const violations = analyzeSource(`
      export const counter = () => {
        if (true) {
          useState(0);
        }
        return <div />;
      };
    `);

    expect(violations.some((v) => v.hook === "useState")).toBe(true);
  });

  it("flags hooks inside nested callbacks", () => {
    const violations = analyzeSource(`
      export function Comp() {
        return <button onClick={() => { useState(0); }} />;
      }
    `);

    expect(violations.some((v) => v.context.includes("nested function"))).toBe(true);
  });

  it("flags hooks after early return", () => {
    const violations = analyzeSource(`
      export function Comp({ data }: { data?: string }) {
        if (!data) return null;
        useState(data);
        return <div>{data}</div>;
      }
    `);

    expect(violations.some((v) => v.context.includes("early return"))).toBe(true);
  });

  it("allows valid top-level hook usage", () => {
    const violations = analyzeSource(`
      export function Comp() {
        const [x, setX] = useState(0);
        useEffect(() => {}, [x]);
        return <div onClick={() => setX(x + 1)}>{x}</div>;
      }
    `);

    expect(violations).toHaveLength(0);
  });
});
