import fs from "node:fs";
import path from "node:path";
import type { Command } from "commander";
import type { AnalysisResult } from "./analyzeProject";
import { analyzeProject } from "./analyzeProject";
import { UnsupportedProjectError } from "./discoverFiles";
import { createAnalyzeProgressReporter } from "./analyzeProgress";
import { printFocusReport } from "./focus";
import { printReport, writeReportFile } from "./report";
import { resolveTarget } from "./resolveTarget";
import { buildInsights } from "./insights";
import { slimGraphForExport } from "./slimGraph";
import { CACHE_DIR } from "./cache/fileCache";
import { writeSnippetSidecars, SNIPPETS_DIR } from "./snippets";

export type AnalyzeOptions = {
  output?: string;
  reportFile?: string;
  verbose?: boolean;
  insights?: boolean;
  quiet?: boolean;
  color?: boolean;
  focus?: string;
  maxFiles: string;
  cache?: boolean;
  withSnippets?: boolean;
  reanalyze?: boolean;
};

function formatWriteError(filePath: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `Could not write ${filePath}: ${message}`;
}

function printTerminalReport(
  result: AnalysisResult,
  options: AnalyzeOptions,
  graphPath: string | null,
  reportPath: string | null,
): void {
  if (options.focus) {
    printFocusReport(result, options.focus, { color: options.color });
    return;
  }

  printReport(result, {
    verbose: options.verbose,
    insights: options.insights,
    quiet: options.quiet,
    color: options.color,
    graphOutput: graphPath,
    reportOutput: reportPath,
  });
}

function writeGraphFile(
  result: AnalysisResult,
  graphPath: string,
): string | null {
  try {
    const insights = buildInsights(result);
    fs.writeFileSync(
      graphPath,
      `${JSON.stringify(slimGraphForExport(result.graph, { insights }), null, 2)}\n`,
    );
    return null;
  } catch (error) {
    return formatWriteError(graphPath, error);
  }
}

function writeReportFileSafe(
  result: AnalysisResult,
  reportPath: string,
  options: AnalyzeOptions,
  graphPath: string | null,
): string | null {
  try {
    writeReportFile(result, reportPath, {
      verbose: options.verbose,
      insights: true,
      color: false,
      graphOutput: graphPath,
      reportOutput: reportPath,
    });
    return null;
  } catch (error) {
    return formatWriteError(reportPath, error);
  }
}

function writeSnippetSidecarsSafe(
  targetDir: string,
  result: AnalysisResult,
  options: AnalyzeOptions,
): string | null {
  try {
    const snippetCount = writeSnippetSidecars(
      targetDir,
      result.graph.nodes.map((node) => node.file),
    );
    if (!options.quiet) {
      console.log(
        `Wrote ${snippetCount} snippet sidecar(s) to ${path.join(targetDir, SNIPPETS_DIR)}`,
      );
    }
    return null;
  } catch (error) {
    return formatWriteError(path.join(targetDir, SNIPPETS_DIR), error);
  }
}

function reportWriteErrors(
  errors: string[],
  options: AnalyzeOptions,
): void {
  for (const error of errors) {
    if (options.quiet) {
      console.error(`arclens: ${error}`);
    } else {
      console.error(`\narclens: ${error}`);
    }
  }
}

export function addAnalyzeOptions(command: Command): Command {
  return command
    .option(
      "-o, --output [file]",
      "write graph.json (default: graph.json unless --report-file is used alone)",
    )
    .option(
      "--report-file <file>",
      "write a full report (.txt = human-readable, .json = structured data)",
    )
    .option("-v, --verbose", "show scanned files and export kind breakdown")
    .option(
      "--insights",
      "show architecture suggestions and ESLint-style hints",
    )
    .option("-q, --quiet", "minimal output (written file paths only)")
    .option("--no-color", "disable ANSI colors in terminal output")
    .option(
      "--focus <name>",
      "show who imports, renders, or uses a specific node (e.g. Button)",
    )
    .option(
      "--max-files <number>",
      "refuse to scan more than N files (safety guard)",
      "3000",
    )
    .option("--no-cache", `re-parse all files and ignore ${CACHE_DIR}/cache.json`)
    .option(
      "--with-snippets",
      `write truncated source sidecars to ${SNIPPETS_DIR}/ in the analyzed project`,
    )
    .option("--reanalyze", "watch mode: show re-analyze progress", false);
}

export function runAnalyze(
  inputPath: string,
  options: AnalyzeOptions,
): number {
  const progress = createAnalyzeProgressReporter({
    quiet: options.quiet,
    verbose: options.verbose,
    reanalyze:
      options.reanalyze || Boolean(process.env.ARCLENS_WATCH_TARGET),
    color: options.color,
  });

  try {
    const targetDir = resolveTarget(inputPath);
    const maxFiles = Number.parseInt(options.maxFiles, 10);

    if (Number.isNaN(maxFiles) || maxFiles <= 0) {
      throw new Error("--max-files must be a positive number");
    }

    const result = analyzeProject(targetDir, {
      maxFiles,
      cache: options.cache,
      verbose: options.verbose,
      progress,
    });

    const shouldWriteGraph = Boolean(options.output) || !options.reportFile;
    const graphPath = shouldWriteGraph
      ? path.resolve(process.cwd(), options.output ?? "graph.json")
      : null;
    const reportPath = options.reportFile
      ? path.resolve(process.cwd(), options.reportFile)
      : null;

    printTerminalReport(result, options, graphPath, reportPath);

    const writeErrors: string[] = [];

    if (graphPath) {
      const error = writeGraphFile(result, graphPath);
      if (error) writeErrors.push(error);
    }

    if (reportPath) {
      const error = writeReportFileSafe(result, reportPath, options, graphPath);
      if (error) writeErrors.push(error);
    }

    if (options.withSnippets) {
      const error = writeSnippetSidecarsSafe(targetDir, result, options);
      if (error) writeErrors.push(error);
    }

    if (writeErrors.length > 0) {
      reportWriteErrors(writeErrors, options);
      return 1;
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof UnsupportedProjectError) {
      progress.stop();
      if (options.quiet) {
        console.error(`arclens: ${message.split("\n")[0]}`);
      } else {
        console.error(message);
      }
    } else if (options.quiet) {
      progress.stop();
      console.error(`arclens: ${message}`);
    } else {
      progress.fail(message);
    }
    return 1;
  }
}
