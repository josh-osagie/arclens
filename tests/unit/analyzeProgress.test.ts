import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FILE_ACTION_VERBS,
  formatBuildGraphPhase,
  formatCacheLoadPhase,
  formatCacheSummary,
  formatComplete,
  formatDiscoveryDone,
  formatDiscoveryScan,
  formatEnrichGraphPhase,
  formatHooksCheckPhase,
  formatMergePhase,
  formatParsePhase,
  formatParseProgress,
  formatPhaseHeartbeat,
  formatRelativeFile,
  formatStartMessage,
  formatTargetLabel,
  isWatchProgressMode,
  LARGE_PROJECT_THRESHOLD,
  PARSE_UPDATE_BATCH,
  pickCycledVerb,
  shouldUpdateFileProgress
} from "../../src/analyzeProgress";

describe("analyzeProgress helpers", () => {
  const cwd = "/workspace/arclens";
  const targetDir = "/workspace/arclens/samples";

  it("formats project context label", () => {
    expect(formatTargetLabel("arclens", targetDir, cwd)).toBe(
      "arclens (samples)",
    );
  });

  it("formats discovery scan pattern from target dir", () => {
    expect(formatDiscoveryScan(targetDir, cwd)).toBe("Sweeping samples/**/*.{ts,tsx}...");
    expect(formatDiscoveryScan(cwd, cwd)).toBe("Sweeping **/*.{ts,tsx}...");
  });

  it("formats discovery file count", () => {
    expect(formatDiscoveryDone(1)).toBe("Harvested 1 TypeScript file");
    expect(formatDiscoveryDone(47)).toBe("Harvested 47 TypeScript files");
  });

  it("formats cache summary variants", () => {
    expect(formatCacheSummary(142, 3)).toBe("Cache: 142 hits, 3 misses");
    expect(formatCacheSummary(10, 0)).toBe("Cache: 10 hits");
    expect(formatCacheSummary(0, 5)).toBe("Cache: 5 misses");
  });

  it("formats per-file parse progress with cycled action verbs", () => {
    const file = path.join(targetDir, "Button.tsx");
    const line = formatParseProgress(file, 3, 47, targetDir, cwd);
    expect(line).toBe(
      `${pickCycledVerb(FILE_ACTION_VERBS, 3)} Button.tsx (3/47)...`,
    );
    expect(FILE_ACTION_VERBS).toContain(line.split(" ")[0]);
  });

  it("cycles file action verbs across consecutive files", () => {
    const file = path.join(targetDir, "App.tsx");
    const first = formatParseProgress(file, 1, 5, targetDir, cwd);
    const second = formatParseProgress(file, 2, 5, targetDir, cwd);
    expect(first.split(" ")[0]).not.toBe(second.split(" ")[0]);
  });

  it("formats phase messages with action verbs", () => {
    expect(formatCacheLoadPhase()).toBe("Unpacking cache...");
    expect(formatParsePhase(1)).toMatch(/1 source file...$/);
    expect(formatParsePhase(12)).toMatch(/12 source files...$/);
    expect(formatMergePhase(8)).toMatch(/relationships from 8 files...$/);
    expect(formatBuildGraphPhase()).toBe("Mapping dependency graph...");
    expect(formatEnrichGraphPhase()).toBe("Cataloging graph metadata...");
    expect(formatHooksCheckPhase()).toBe("Inspecting Rules of Hooks...");
  });

  it("prefers paths relative to target dir", () => {
    const file = path.join(targetDir, "components", "Button.tsx");
    expect(formatRelativeFile(file, targetDir, cwd)).toBe(
      path.join("components", "Button.tsx"),
    );
  });

  it("formats start vs re-analyze copy", () => {
    expect(formatStartMessage("lendha-onboarding", targetDir, false, cwd)).toMatch(
      /^(Charting|Mapping|Surveying|Tracing) lendha-onboarding \(samples\)...$/,
    );
    expect(formatStartMessage("lendha-onboarding", targetDir, true, cwd)).toBe(
      "Re-mapping lendha-onboarding (samples)...",
    );
  });

  it("formats completion with node and edge counts", () => {
    expect(formatComplete(12, 8, 450)).toBe("Done - 12 nodes, 8 edges in 450ms");
  });

  it("batches parse updates for large projects", () => {
    const total = LARGE_PROJECT_THRESHOLD + 100;

    expect(shouldUpdateFileProgress(1, total, 0)).toBe(true);
    expect(shouldUpdateFileProgress(PARSE_UPDATE_BATCH, total, 0)).toBe(true);
    expect(shouldUpdateFileProgress(PARSE_UPDATE_BATCH + 5, total, PARSE_UPDATE_BATCH)).toBe(
      false,
    );
    expect(shouldUpdateFileProgress(PARSE_UPDATE_BATCH * 2, total, PARSE_UPDATE_BATCH)).toBe(
      true,
    );
    expect(shouldUpdateFileProgress(total, total, total - 1)).toBe(true);
  });

  it("updates every file for small projects", () => {
    expect(shouldUpdateFileProgress(2, 50, 1)).toBe(true);
    expect(shouldUpdateFileProgress(3, 50, 2)).toBe(true);
  });

  it("formats phase heartbeat with elapsed time", () => {
    expect(formatPhaseHeartbeat(formatBuildGraphPhase(), 4500)).toBe(
      "Mapping dependency graph (4.5s)...",
    );
    expect(formatPhaseHeartbeat(formatCacheLoadPhase().slice(0, -3), 1200)).toBe(
      "Unpacking cache (1.2s)...",
    );
  });

  it("detects watch progress mode from env or reanalyze flag", () => {
    const original = process.env.ARCLENS_WATCH_TARGET;
    delete process.env.ARCLENS_WATCH_TARGET;
    expect(isWatchProgressMode({})).toBe(false);
    expect(isWatchProgressMode({ reanalyze: true })).toBe(true);

    process.env.ARCLENS_WATCH_TARGET = "/tmp/demo";
    expect(isWatchProgressMode({})).toBe(true);

    if (original === undefined) {
      delete process.env.ARCLENS_WATCH_TARGET;
    } else {
      process.env.ARCLENS_WATCH_TARGET = original;
    }
  });
});

describe("createAnalyzeProgressReporter quiet mode", () => {
  it("suppresses progress output when quiet", async () => {
    const { createAnalyzeProgressReporter } = await import("../../src/analyzeProgress");
    const reporter = createAnalyzeProgressReporter({ quiet: true });

    expect(() => {
      reporter.start("demo", "/tmp/demo");
      reporter.discoveryScan("/tmp/demo");
      reporter.parseFile("/tmp/demo/App.tsx", 1, 1, "/tmp/demo");
      reporter.complete(1, 0, 10);
      reporter.fail("nope");
      reporter.stop();
    }).not.toThrow();
  });
});

describe("createAnalyzeProgressReporter line mode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function captureProgressWrites(): string[] {
    const writes: string[] = [];
    vi.spyOn(fs, "writeSync").mockImplementation(((_fd, data) => {
      writes.push(String(data));
      return String(data).length;
    }) as typeof fs.writeSync);
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });
    return writes;
  }

  it("writes each progress step as its own line when stderr is not a TTY", async () => {
    const stderr = process.stderr as NodeJS.WriteStream & { isTTY?: boolean };
    const originalIsTTY = stderr.isTTY;
    Object.defineProperty(stderr, "isTTY", { value: false, configurable: true });

    const writes = captureProgressWrites();

    vi.resetModules();
    const { createAnalyzeProgressReporter } = await import("../../src/analyzeProgress");
    const reporter = createAnalyzeProgressReporter({ reanalyze: true });
    const cwd = process.cwd();
    const targetDir = path.join(cwd, "samples");

    reporter.start("demo", targetDir);
    reporter.discoveryScan(targetDir);
    reporter.discoveryDone(2);
    reporter.cacheSummary(1, 1);
    reporter.parseFile(path.join(targetDir, "App.tsx"), 1, 2, targetDir);
    reporter.phase(formatBuildGraphPhase());
    reporter.complete(3, 4, 120);

    Object.defineProperty(stderr, "isTTY", { value: originalIsTTY, configurable: true });

    const output = writes.join("");
    expect(output).toContain("Re-mapping demo (samples)...\n");
    expect(output).toContain(formatDiscoveryScan(targetDir, cwd) + "\n");
    expect(output).toContain("Harvested 2 TypeScript files\n");
    expect(output).toContain("Cache: 1 hit, 1 miss\n");
    expect(output).toMatch(
      new RegExp(`^${FILE_ACTION_VERBS.join("|")} App\\.tsx \\(1/2\\)...\\n`, "m"),
    );
    expect(output).toContain(formatBuildGraphPhase() + "\n");
    expect(output).toContain(formatComplete(3, 4, 120));
  });

  it("writes phased lines on a TTY when reanalyze is set (watch mode)", async () => {
    const stderr = process.stderr as NodeJS.WriteStream & { isTTY?: boolean };
    const originalIsTTY = stderr.isTTY;
    Object.defineProperty(stderr, "isTTY", { value: true, configurable: true });

    const writes = captureProgressWrites();

    vi.resetModules();
    const { createAnalyzeProgressReporter } = await import("../../src/analyzeProgress");
    const reporter = createAnalyzeProgressReporter({ reanalyze: true });
    const cwd = process.cwd();
    const targetDir = path.join(cwd, "samples");

    reporter.start("demo", targetDir);
    reporter.discoveryDone(5);
    reporter.cacheSummary(5, 0);
    reporter.phase(formatBuildGraphPhase());
    reporter.complete(6, 5, 200);

    Object.defineProperty(stderr, "isTTY", { value: originalIsTTY, configurable: true });

    const output = writes.join("");
    expect(output).toContain("Re-mapping demo (samples)...\n");
    expect(output).toContain("Harvested 5 TypeScript files\n");
    expect(output).toContain("Cache: 5 hits\n");
    expect(output).toContain(formatBuildGraphPhase() + "\n");
    expect(output).toContain(formatComplete(6, 5, 200));
  });

  it("uses sync stderr writes in watch mode", async () => {
    const stderr = process.stderr as NodeJS.WriteStream & { isTTY?: boolean };
    const originalIsTTY = stderr.isTTY;
    const originalWatchTarget = process.env.ARCLENS_WATCH_TARGET;
    const targetDir = path.join(process.cwd(), "watch-demo");
    process.env.ARCLENS_WATCH_TARGET = targetDir;
    Object.defineProperty(stderr, "isTTY", { value: false, configurable: true });

    const syncWrites: string[] = [];
    vi.spyOn(fs, "writeSync").mockImplementation(((_fd, data) => {
      syncWrites.push(String(data));
      return String(data).length;
    }) as typeof fs.writeSync);

    vi.resetModules();
    const { createAnalyzeProgressReporter } = await import("../../src/analyzeProgress");
    const reporter = createAnalyzeProgressReporter({ reanalyze: true });
    reporter.start("demo", targetDir);

    Object.defineProperty(stderr, "isTTY", { value: originalIsTTY, configurable: true });
    if (originalWatchTarget === undefined) {
      delete process.env.ARCLENS_WATCH_TARGET;
    } else {
      process.env.ARCLENS_WATCH_TARGET = originalWatchTarget;
    }

    expect(syncWrites.join("")).toContain(`Re-mapping demo (${path.relative(process.cwd(), targetDir) || "watch-demo"})...\n`);
  });

  it("emits heartbeat lines during long phases", async () => {
    vi.useFakeTimers();
    const writes = captureProgressWrites();

    vi.resetModules();
    const { runWithPhaseHeartbeat, createAnalyzeProgressReporter, PHASE_HEARTBEAT_MS } =
      await import("../../src/analyzeProgress");
    const reporter = createAnalyzeProgressReporter({ reanalyze: true });

    const buildPhase = formatBuildGraphPhase();
    const result = runWithPhaseHeartbeat(reporter, buildPhase, () => {
      vi.advanceTimersByTime(PHASE_HEARTBEAT_MS * 2);
      return "ok";
    }, PHASE_HEARTBEAT_MS);

    vi.useRealTimers();
    vi.restoreAllMocks();

    expect(result).toBe("ok");
    const output = writes.join("");
    expect(output).toContain(buildPhase + "\n");
    expect(output).toContain("Mapping dependency graph (3.0s)...\n");
  });
});
