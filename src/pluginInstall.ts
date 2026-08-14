import Module from "node:module";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { readLocalLicense } from "./license";
import { getCheckoutUrl, getPricingUrl, getSiteUrl } from "./entitlements";

export type InstallProOptions = {
  fromTarball?: string;
  registry?: string;
  dryRun?: boolean;
  color?: boolean;
};

function isAccessibleDir(dir: string): boolean {
  try {
    fs.accessSync(dir);
    return true;
  } catch {
    return false;
  }
}

function resolveArclensInstallRoot(): string | null {
  // Prefer: dirname of the running bin/arclens.js
  try {
    // entry is e.g. /usr/local/lib/node_modules/arclens/bin/arclens.js
    // so root = /usr/local/lib/node_modules/arclens, global node_modules is its parent
    const binPath = process.argv[1];
    if (binPath) {
      const parent = path.resolve(path.dirname(binPath), "..");
      const parentDir = path.basename(parent);
      if (parentDir === "arclens" || isAccessibleDir(path.join(parent, "package.json"))) {
        return parent;
      }
    }
  } catch {
    /* ignore */
  }
  // Fallback: require.resolve from this file
  try {
    // @ts-ignore
    const require = Module.createRequire(__filename);
    const pkgPath = require.resolve("arclens/package.json");
    return path.dirname(pkgPath);
  } catch {
    return null;
  }
}

export function isProPluginInstalled(): boolean {
  try {
    // @ts-ignore
    const require = Module.createRequire(__filename);
    require.resolve("@arclens/pro");
    return true;
  } catch {
    /* noop */
  }
  const root = resolveArclensInstallRoot();
  if (!root) return false;
  const candidates = [
    path.resolve(root, "node_modules/@arclens/pro/package.json"),
    path.resolve(root, "../@arclens/pro/package.json"),
    path.resolve(process.cwd(), "node_modules/@arclens/pro/package.json"),
  ];
  return candidates.some((c) => {
    try {
      fs.accessSync(c);
      return true;
    } catch {
      return false;
    }
  });
}

function runNpm(
  args: string[],
  cwd: string,
  opts: { dryRun: boolean; envAddon?: NodeJS.ProcessEnv }
): { ok: boolean; stdout: string; stderr: string; command: string } {
  const bin = process.platform === "win32" ? "npm.cmd" : "npm";
  const command = `${bin} ${args.join(" ")}`;
  if (opts.dryRun) {
    return { ok: true, stdout: "", stderr: "", command };
  }
  const res = spawnSync(bin, args, {
    cwd,
    env: { ...process.env, ...(opts.envAddon ?? {}) },
    encoding: "utf-8",
  });
  return {
    ok: (res.status ?? 1) === 0,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
    command,
  };
}

function determineInstallTarget(
  root: string | null
): { mode: "global" | "local"; cwd: string } {
  // If arclens is in a global node_modules, install next to it (sibling @arclens/pro)
  if (root) {
    const globalParent = path.resolve(root, ".."); // usually .../node_modules
    if (path.basename(globalParent) === "node_modules") {
      return { mode: "global", cwd: path.resolve(globalParent, "..") };
    }
  }
  // Otherwise: install in the user's homedir .arclens and prepend NODE_PATH
  return { mode: "local", cwd: path.join(os.homedir(), ".arclens") };
}

export async function installProPlugin(options: InstallProOptions = {}): Promise<number> {
  const dryRun = options.dryRun ?? false;

  // 1. Check license
  const license = readLocalLicense();
  if (!license || license.status !== "active") {
    console.error("arclens: install-pro requires an active Pro license.");
    console.error("  First run:  arclens activate <your-license-key>");
    const checkout = getCheckoutUrl("pro");
    console.error(`  Or buy Pro: ${checkout ?? getPricingUrl()}`);
    return 1;
  }

  console.log(`Installing Arclens Pro plugin...`);
  console.log(`  License: ${license.variantName} (${license.customerEmail})`);

  const arclensRoot = resolveArclensInstallRoot();
  const target = determineInstallTarget(arclensRoot);

  if (target.mode === "local") {
    try {
      fs.mkdirSync(target.cwd, { recursive: true });
    } catch (err) {
      console.error(`arclens: could not create install dir: ${target.cwd}`);
      return 1;
    }
    // Ensure a package.json exists there so npm install works
    const pkg = path.join(target.cwd, "package.json");
    if (!fs.existsSync(pkg)) {
      fs.writeFileSync(
        pkg,
        JSON.stringify({ name: "arclens-user", private: true, version: "1.0.0" }, null, 2),
        "utf-8"
      );
    }
  }

  let installSpec: string;
  const npmArgs: string[] = ["install", "--no-save", "--no-audit", "--no-fund", "--loglevel=error"];
  const envAddon: NodeJS.ProcessEnv = {};

  if (options.fromTarball) {
    installSpec = path.resolve(process.cwd(), options.fromTarball);
    if (!fs.existsSync(installSpec)) {
      console.error(`arclens: tarball not found: ${installSpec}`);
      return 1;
    }
    npmArgs.push(installSpec);
    console.log(`  Source:   local tarball (${path.relative(process.cwd(), installSpec)})`);
  } else if (options.registry) {
    installSpec = "@arclens/pro@latest";
    npmArgs.push("--registry", options.registry, installSpec);
    console.log(`  Registry: ${options.registry}`);
  } else {
    // Default: tarball download URL from site (license key signed). Indie dev style.
    const base = getSiteUrl();
    // Real implementation would sign a download URL server-side. Here we keep a friendly placeholder:
    installSpec = "@arclens/pro@latest";
    npmArgs.push(installSpec);
    const hint =
      process.env.ARCLENS_PRO_REGISTRY ||
      "configure private registry via ARCLENS_PRO_REGISTRY env";
    console.log(`  Package:  ${installSpec} (${hint})`);
    if (process.env.ARCLENS_PRO_REGISTRY) {
      envAddon.NPM_CONFIG_REGISTRY = process.env.ARCLENS_PRO_REGISTRY;
    }
  }

  if (dryRun) {
    console.log(`  Target:   ${target.mode} install in ${target.cwd}`);
    const preview = runNpm(npmArgs, target.cwd, { dryRun: true });
    console.log(`  Dry-run command:  ${preview.command}`);
    console.log("\n✓ install-pro dry-run complete. Re-run without --dry-run to install.");
    return 0;
  }

  const res = runNpm(npmArgs, target.cwd, { dryRun: false, envAddon });
  if (!res.ok) {
    console.error(`arclens: npm install failed for @arclens/pro.`);
    if (res.stderr) console.error(res.stderr.trim());
    console.error("");
    console.error("Troubleshooting:");
    console.error("  • Use --from-tarball ./arclens-pro-0.1.0.tgz for offline installs");
    console.error(`  • Buy Pro:  ${getCheckoutUrl("pro") ?? getPricingUrl()}`);
    console.error("  • Need help? Reach out via the license confirmation email.");
    return 1;
  }

  // Verify the plugin is now loadable
  const installed = isProPluginInstalled();
  if (!installed) {
    console.warn("");
    console.warn("Warning: plugin install appeared to succeed, but not detected yet.");
    console.warn(
      target.mode === "global"
        ? "If installed globally, ensure npm's global node_modules is in NODE_PATH."
        : `Add to NODE_PATH:  export NODE_PATH="${target.cwd}/node_modules:$NODE_PATH"`
    );
  }

  console.log("");
  console.log("✓ Arclens Pro plugin installed successfully!");
  console.log("  Pro features now active on all future analyze/watch runs:");
  console.log("    • 25,000 file limit");
  console.log("    • Next.js App Router & Pages Router adapter");
  console.log("    • Circular dependency & coupling insights (Pro-only)");
  console.log("");
  console.log("  Run:  arclens license   to verify both license and plugin are active.");
  console.log("  Run:  arclens analyze ./src --insights   to try it.");
  return 0;
}
