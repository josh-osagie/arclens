import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { analyzeProject } from "./analyzeProject";
import { printReport } from "./report";
import { resolveTarget } from "./resolveTarget";

const program = new Command();

program
  .name("react-atlas")
  .description("Interactive architecture explorer for React/TypeScript")
  .version("1.0.0");

program
  .command("analyze")
  .description("Analyze a React/TypeScript project and generate graph.json")
  .argument("[path]", "directory to analyze", "./samples")
  .option("-o, --output <file>", "output path for graph.json", "graph.json")
  .action((inputPath: string, options: { output: string }) => {
    try {
      const targetDir = resolveTarget(inputPath);
      const outputPath = path.resolve(process.cwd(), options.output);

      const result = analyzeProject(targetDir);

      fs.writeFileSync(outputPath, JSON.stringify(result.graph, null, 2));

      printReport(result, outputPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`react-atlas: ${message}`);
      process.exitCode = 1;
    }
  });

program.parse();
