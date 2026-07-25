import path from "node:path";
import { Command } from "commander";
import { addAnalyzeOptions, runAnalyze, type AnalyzeOptions } from "./analyzeCommand";
import { runView } from "./viewServer";
import { runWatch } from "./watchCommand";

const program = new Command();

program
  .name("react-atlas")
  .description("Interactive architecture explorer for React/TypeScript")
  .version("1.0.0");

const analyzeCmd = program
  .command("analyze")
  .description("Analyze a React/TypeScript project and generate graph.json")
  .argument("[path]", "directory to analyze", "./samples");

addAnalyzeOptions(analyzeCmd);
analyzeCmd.action((inputPath: string, options: AnalyzeOptions) => {
  process.exitCode = runAnalyze(inputPath, options);
});

const watchCmd = program
  .command("watch")
  .description("Re-run analyze when .ts/.tsx files change")
  .argument("[path]", "directory to analyze", "./samples");

addAnalyzeOptions(watchCmd);
watchCmd.action(async (inputPath: string, options: AnalyzeOptions) => {
  process.exitCode = await runWatch(inputPath, options);
});

program
  .command("view")
  .description("Open the architecture graph viewer")
  .option("-p, --port <number>", "port for the viewer server", "5173")
  .option(
    "-g, --graph <file>",
    "path to graph.json (default: graph.json in cwd)",
    "graph.json",
  )
  .option(
    "--project-root <dir>",
    "project root for source snippets (default: from graph meta)",
  )
  .option("--open", "open the viewer in your default browser")
  .action(
    async (options: {
      port: string;
      graph: string;
      projectRoot?: string;
      open?: boolean;
    }) => {
      const port = Number.parseInt(options.port, 10);
      if (Number.isNaN(port) || port <= 0) {
        console.error("react-atlas: --port must be a positive number");
        process.exitCode = 1;
        return;
      }

      try {
        process.exitCode = await runView({
          port,
          graphPath: path.resolve(process.cwd(), options.graph),
          projectRoot: options.projectRoot
            ? path.resolve(process.cwd(), options.projectRoot)
            : undefined,
          open: options.open,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`react-atlas: ${message}`);
        process.exitCode = 1;
      }
    },
  );

program.parse();
