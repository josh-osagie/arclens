import { describe, expect, it } from "vitest";
import {
  releaseCommitMessage,
  releaseTagFromVersion,
  releaseTagUrl,
} from "../scripts/release-utils.mjs";

describe("release-utils", () => {
  it("derives tag name from version", () => {
    expect(releaseTagFromVersion("2.1.0")).toBe("v2.1.0");
    expect(releaseTagFromVersion("0.0.1")).toBe("v0.0.1");
  });

  it("derives commit message from version", () => {
    expect(releaseCommitMessage("2.1.0")).toBe("chore: release v2.1.0");
  });

  it("derives GitHub tag URL from repository field", () => {
    expect(
      releaseTagUrl("git+https://github.com/josh-osagie/arclens.git", "2.1.0"),
    ).toBe("https://github.com/josh-osagie/arclens/releases/tag/v2.1.0");
    expect(releaseTagUrl(undefined, "1.0.0")).toBeNull();
  });
});
