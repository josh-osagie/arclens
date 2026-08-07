import { describe, expect, it } from "vitest";
import {
  isKebabCaseSymbol,
  isLikelyStateExport,
  isTestOrHocUtility,
} from "../../src/exportHeuristics";

describe("exportHeuristics", () => {
  it("detects redux-style slice exports", () => {
    expect(isLikelyStateExport("appSlice", "/src/app/appSlice.ts")).toBe(true);
    expect(
      isLikelyStateExport("toggleWebsiteNavbarOpen", "/src/app/appSlice.ts")
    ).toBe(true);
    expect(isLikelyStateExport("fetchUser", "/src/api.ts")).toBe(false);
  });

  it("detects test and hoc utilities", () => {
    expect(
      isTestOrHocUtility(
        "renderWithRouter",
        "/src/utils/components/hoc/renderWithRouter.tsx"
      )
    ).toBe(true);
    expect(isTestOrHocUtility("App", "/src/App.test.tsx")).toBe(true);
  });

  it("detects kebab-case symbols", () => {
    expect(isKebabCaseSymbol("form-input")).toBe(true);
    expect(isKebabCaseSymbol("FormInput")).toBe(false);
  });
});
