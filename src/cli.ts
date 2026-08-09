import path from "node:path";
import { Command } from "commander";
import {
  addAnalyzeOptions,
  runAnalyze,
  type AnalyzeOptions,
} from "./analyzeCommand";
import { runUpdate } from "./updateCommand";
import { runView } from "./viewServer";
import { runWatch } from "./watchCommand";
import { formatVersionBanner, getPackageVersion } from "./versionBanner";
import {
  activateLicense,
  deactivateLicense,
  validateLicense,
} from "./license";
import {
  getActiveEntitlements,
  getCheckoutUrl,
  getPricingUrl,
} from "./entitlements";

const program = new Command();
const version = getPackageVersion();

function wantsVersion(argv: string[]): boolean {
  if (!argv.includes("-v") && !argv.includes("--version")) {
    return false;
  }

  const commands = new Set([
    "analyze",
    "watch",
    "view",
    "update",
    "help",
    "activate",
    "deactivate",
    "license",
  ]);
  return !argv.some((arg) => commands.has(arg));
}

const argv = process.argv.slice(2);
if (wantsVersion(argv)) {
  console.log(formatVersionBanner(version));
  process.exit(0);
}

program
  .name("arclens")
  .description("Interactive architecture explorer for React/TypeScript")
  .option("-v, --version", "show version information");

program
  .command("activate")
  .description("Activate an Arclens Pro or Team license key")
  .argument("<key>", "Lemon Squeezy license key")
  .action(async (key: string) => {
    console.log("Activating Arclens license key...");
    const res = await activateLicense(key);
    if (res.success && res.data) {
      const entitlements = getActiveEntitlements();
      console.log(`\n✓ Arclens ${res.data.variantName} license activated!`);
      console.log(`  Customer:  ${res.data.customerEmail}`);
      console.log(`  Instance:  ${res.data.instanceName}`);
      console.log(`  Plan:      ${entitlements.label}`);
      console.log(`  Max files: ${entitlements.maxFiles.toLocaleString()}`);
      process.exitCode = 0;
    } else {
      console.error(`\n✗ License activation failed: ${res.error}`);
      console.error(`  Get a key: ${getPricingUrl()}`);
      process.exitCode = 1;
    }
  });

program
  .command("deactivate")
  .description("Deactivate local machine license")
  .action(async () => {
    const res = await deactivateLicense();
    if (res.success) {
      console.log("\n✓ Local Arclens license deactivated.");
      process.exitCode = 0;
    } else {
      console.error(`\n✗ Deactivation failed: ${res.error}`);
      process.exitCode = 1;
    }
  });

program
  .command("license")
  .description("Display local license status and plan information")
  .action(async () => {
    const res = await validateLicense();
    const entitlements = getActiveEntitlements();

    console.log("\nArclens License Status:");
    if (res.valid && res.data) {
      console.log(`  Plan:      ${entitlements.label} (${res.data.variantName})`);
      console.log(`  Status:    ${res.data.status}`);
      console.log(`  Email:     ${res.data.customerEmail}`);
      console.log(`  Machine:   ${res.data.instanceName}`);
      if (res.data.expiresAt) {
        console.log(`  Expires:   ${res.data.expiresAt}`);
      }
    } else {
      console.log(`  Plan:      ${entitlements.label}`);
      console.log("  Status:    Local-first free tier");
    }

    console.log(`  Max files: ${entitlements.maxFiles.toLocaleString()}`);
    console.log(
      `  Features:  large projects ${entitlements.features.largeProjects ? "on" : "off"}, ` +
        `CI ${entitlements.features.ciIntegration ? "on" : "reserved"}`
    );

    if (entitlements.plan === "free") {
      const checkout = getCheckoutUrl("pro");
      console.log("");
      console.log("  Upgrade:");
      console.log(`    ${checkout ?? getPricingUrl()}`);
      console.log("    Then: arclens activate <license-key>");
    }
    process.exitCode = 0;
  });

program
  .command("update")
  .description("update a global npm install to the latest version")
  .option("--no-color", "disable ANSI colors")
  .action((options: { color?: boolean }) => {
    process.exitCode = runUpdate({ color: options.color });
  });

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
    "graph.json"
  )
  .option(
    "--project-root <dir>",
    "project root for source snippets (default: from graph meta)"
  )
  .option("--open", "open the viewer in your default browser")
  .option(
    "--dev",
    "run Vite dev server with HMR (auto-detected when viewer/ source exists)"
  )
  .action(
    async (options: {
      port: string;
      graph: string;
      projectRoot?: string;
      open?: boolean;
      dev?: boolean;
    }) => {
      const port = Number.parseInt(options.port, 10);
      if (Number.isNaN(port) || port <= 0) {
        console.error("arclens: --port must be a positive number");
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
          dev: options.dev,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`arclens: ${message}`);
        process.exitCode = 1;
      }
    }
  );

program.parse();
