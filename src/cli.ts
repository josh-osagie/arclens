import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { analyzeProject } from "./analyzeProject";
import { UnsupportedProjectError } from "./discoverFiles";
import { createAnalyzeProgressReporter } from "./analyzeProgress";
import { printFocusReport } from "./focus";
import { printReport, writeReportFile } from "./report";
import { resolveTarget } from "./resolveTarget";
import { buildInsights } from "./insights";
import { slimGraphForExport } from "./slimGraph";
import { writeSnippetSidecars } from "./snippets";

const program = new Command();

program
  .name("react-atlas")
  .description("Interactive architecture explorer for React/TypeScript")
  .version("1.0.0");

program
  .command("analyze")
  .description("Analyze a React/TypeScript project and generate graph.json")
  .argument("[path]", "directory to analyze", "./samples")
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
  .option("--no-cache", "re-parse all files and ignore .react-atlas/cache.json")
  .option(
    "--with-snippets",
    "write truncated source sidecars to .react-atlas/snippets/ in the analyzed project",
  )
  .option("--reanalyze", "watch mode: show re-analyze progress", false)
  .action(
    (
      inputPath: string,
      options: {
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
      },
    ) => {
      const progress = createAnalyzeProgressReporter({
        quiet: options.quiet,
        verbose: options.verbose,
        reanalyze: options.reanalyze || Boolean(process.env.REACT_ATLAS_WATCH_TARGET),
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

        // Write graph.json by default, unless user only asked for --report-file
        const shouldWriteGraph = Boolean(options.output) || !options.reportFile;
        const graphPath = shouldWriteGraph
          ? path.resolve(process.cwd(), options.output ?? "graph.json")
          : null;

        if (graphPath) {
          const insights = buildInsights(result);
          fs.writeFileSync(
            graphPath,
            `${JSON.stringify(
              slimGraphForExport(result.graph, { insights }),
              null,
              2,
            )}\n`,
          );
        }

        if (options.withSnippets) {
          const snippetCount = writeSnippetSidecars(
            targetDir,
            result.graph.nodes.map((node) => node.file),
          );
          if (!options.quiet) {
            console.log(
              `Wrote ${snippetCount} snippet sidecar(s) to ${path.join(targetDir, ".react-atlas", "snippets")}`,
            );
          }
        }

        const reportPath = options.reportFile
          ? path.resolve(process.cwd(), options.reportFile)
          : null;

        if (reportPath) {
          writeReportFile(result, reportPath, {
            verbose: options.verbose,
            insights: true,
            color: false,
            graphOutput: graphPath,
            reportOutput: reportPath,
          });
        }

        if (options.focus) {
          printFocusReport(result, options.focus, { color: options.color });
        } else {
          printReport(result, {
            verbose: options.verbose,
            insights: options.insights,
            quiet: options.quiet,
            color: options.color,
            graphOutput: graphPath,
            reportOutput: reportPath,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof UnsupportedProjectError) {
          progress.stop();
          if (options.quiet) {
            console.error(`react-atlas: ${message.split("\n")[0]}`);
          } else {
            console.error(message);
          }
        } else if (options.quiet) {
          progress.stop();
          console.error(`react-atlas: ${message}`);
        } else {
          progress.fail(message);
        }
        process.exitCode = 1;
      }
    },
  );

program.parse();
