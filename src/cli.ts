import fs from "node:fs";
import path from "node:path";
import ora from "ora";
import { Command } from "commander";
import { analyzeProject } from "./analyzeProject";
import { printFocusReport } from "./focus";
import { printReport, writeReportFile } from "./report";
import { resolveTarget } from "./resolveTarget";
import { slimGraphForExport } from "./slimGraph";

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
      },
    ) => {
      const spinner = options.quiet ? null : ora({ color: "cyan" }).start();

      try {
        const targetDir = resolveTarget(inputPath);
        const maxFiles = Number.parseInt(options.maxFiles, 10);

        if (Number.isNaN(maxFiles) || maxFiles <= 0) {
          throw new Error("--max-files must be a positive number");
        }

        const result = analyzeProject(targetDir, {
          maxFiles,
          onProgress: (message) => {
            if (spinner) spinner.text = message;
          },
        });

        // Write graph.json by default, unless user only asked for --report-file
        const shouldWriteGraph = Boolean(options.output) || !options.reportFile;
        const graphPath = shouldWriteGraph
          ? path.resolve(process.cwd(), options.output ?? "graph.json")
          : null;

        if (graphPath) {
          fs.writeFileSync(
            graphPath,
            `${JSON.stringify(slimGraphForExport(result.graph), null, 2)}\n`,
          );
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

        spinner?.stop();

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
        spinner?.stop();
        const message = error instanceof Error ? error.message : String(error);
        console.error(`react-atlas: ${message}`);
        process.exitCode = 1;
      }
    },
  );

program.parse();
