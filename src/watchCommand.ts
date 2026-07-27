import fs from "node:fs";
import path from "node:path";
import chokidar from "chokidar";
import type { AnalyzeOptions } from "./analyzeCommand";
import { runAnalyze } from "./analyzeCommand";
import { getPackageRoot } from "./packageRoot";
import { resolveTarget } from "./resolveTarget";

const WATCH_IGNORE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/.next/**",
  "**/out/**",
];

const WATCH_HELP = `Watching for .ts/.tsx changes. Interactive commands:
  r  restart — re-run analyze now
  q  exit     — stop watching
  ?  help     — show this message

Ctrl+C also stops watch.`;

export function getWatchGlobs(targetDir: string, packageRoot: string): string[] {
  const target = path.resolve(targetDir);
  const samplesDir = path.resolve(path.join(packageRoot, "samples"));
  const isSamples =
    target === samplesDir ||
    (path.basename(target) === "samples" && fs.existsSync(samplesDir));

  if (isSamples) {
    return [
      path.join(packageRoot, "samples", "**", "*.{ts,tsx}"),
      path.join(packageRoot, "src", "**", "*.ts"),
    ];
  }

  const srcDir = path.join(target, "src");
  if (fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()) {
    return [path.join(target, "src", "**", "*.{ts,tsx}")];
  }

  return [path.join(target, "**", "*.{ts,tsx}")];
}

function printWatchBanner(targetDir: string, globs: string[]): void {
  console.log("Arclens watch");
  console.log(`  target:  ${targetDir}`);
  console.log(`  globs:   ${globs.join(" ")}`);
  console.log("  note:    watches .ts/.tsx only (React/TypeScript projects)");
  console.log("");
}

function startInteractiveControls(handlers: {
  onRestart: () => void;
  onQuit: () => void;
}): () => void {
  if (!process.stdin.isTTY) {
    return () => {};
  }

  console.log("");
  console.log(WATCH_HELP);
  console.log("");

  const stdin = process.stdin;
  stdin.setRawMode?.(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  const onData = (key: string) => {
    if (key === "\u0003") {
      return;
    }

    switch (key.toLowerCase()) {
      case "r":
        console.log("");
        handlers.onRestart();
        break;
      case "q":
        console.log("");
        handlers.onQuit();
        break;
      case "?":
      case "h":
        console.log("");
        console.log(WATCH_HELP);
        console.log("");
        break;
      default:
        break;
    }
  };

  stdin.on("data", onData);

  return () => {
    stdin.off("data", onData);
    stdin.setRawMode?.(false);
    stdin.pause();
  };
}

export async function runWatch(
  inputPath: string,
  analyzeOptions: AnalyzeOptions,
): Promise<number> {
  const packageRoot = getPackageRoot();
  const targetDir = resolveTarget(inputPath);
  const globs = getWatchGlobs(targetDir, packageRoot);

  printWatchBanner(targetDir, globs);

  const watchOptions: AnalyzeOptions = {
    ...analyzeOptions,
    reanalyze: true,
  };

  process.env.ARCLENS_WATCH_TARGET = targetDir;

  const initialStatus = runAnalyze(inputPath, watchOptions);
  if (initialStatus !== 0) {
    delete process.env.ARCLENS_WATCH_TARGET;
    return initialStatus;
  }

  let running = false;
  let stopped = false;
  let pending = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const runReanalyze = () => {
    if (stopped) {
      return;
    }
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      runAnalyze(inputPath, watchOptions);
    } finally {
      running = false;
      if (pending) {
        pending = false;
        runReanalyze();
      }
    }
  };

  const queueReanalyze = () => {
    if (stopped) {
      return;
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      runReanalyze();
    }, 300);
  };

  const watcher = chokidar.watch(globs, {
    ignored: WATCH_IGNORE,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    usePolling: process.platform === "win32",
    interval: 300,
  });

  watcher.on("all", (event, filePath) => {
    if (process.env.ARCLENS_WATCH_DEBUG) {
      console.log(`watch: ${event} ${filePath}`);
    }
    queueReanalyze();
  });

  const stop = async () => {
    if (stopped) {
      return;
    }
    stopped = true;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    delete process.env.ARCLENS_WATCH_TARGET;
    await watcher.close();
  };

  const cleanupInteractive = startInteractiveControls({
    onRestart: queueReanalyze,
    onQuit: () => {
      void stop().then(() => process.exit(0));
    },
  });

  const onSignal = () => {
    void stop().then(() => process.exit(0));
  };

  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  await new Promise<void>((resolve) => {
    watcher.on("ready", () => resolve());
  });

  await new Promise<void>((resolve) => {
    watcher.on("close", () => resolve());
  });

  cleanupInteractive();
  process.off("SIGINT", onSignal);
  process.off("SIGTERM", onSignal);

  return 0;
}
