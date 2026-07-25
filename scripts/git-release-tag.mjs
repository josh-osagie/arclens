import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  releaseCommitMessage,
  releaseTagFromVersion,
  releaseTagUrl,
} from "./release-utils.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const packageJsonPath = path.join(packageRoot, "package.json");
const dryRun = process.argv.includes("--dry-run");

function run(command, options = {}) {
  if (dryRun) {
    console.log(`[dry-run] ${command}`);
    return "";
  }
  return execSync(command, { cwd: packageRoot, stdio: "inherit", ...options });
}

function runOutput(command) {
  if (dryRun) {
    console.log(`[dry-run] ${command}`);
    return "";
  }
  return execSync(command, { cwd: packageRoot, encoding: "utf8" }).trim();
}

function runOutputSafe(command) {
  if (dryRun) {
    console.log(`[dry-run] ${command}`);
    return "";
  }
  try {
    return execSync(command, { cwd: packageRoot, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function tagExistsLocally(tag) {
  if (dryRun) {
    return false;
  }
  try {
    execSync(`git rev-parse --verify "refs/tags/${tag}"`, {
      cwd: packageRoot,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

function tagExistsOnRemote(tag) {
  const refs = runOutputSafe(`git ls-remote --tags origin "refs/tags/${tag}"`);
  return refs.length > 0;
}

function warn(message) {
  console.warn(`\n[warn] ${message}`);
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const version = pkg.version;
  const tag = releaseTagFromVersion(version);
  const commitMessage = releaseCommitMessage(version);

  console.log(`\nGit release step for ${tag}...`);

  run("git add package.json");
  if (fs.existsSync(path.join(packageRoot, "pnpm-lock.yaml"))) {
    run("git add pnpm-lock.yaml");
  }
  run("git add -u");

  const pending = runOutput("git status --porcelain");
  if (pending) {
    run(`git commit -m "${commitMessage}"`);
  } else {
    console.log("No tracked changes to commit (version may already be committed).");
  }

  if (tagExistsLocally(tag)) {
    console.log(`Tag ${tag} already exists locally.`);
  } else if (dryRun) {
    console.log(`[dry-run] Would create annotated tag ${tag}.`);
  } else {
    run(`git tag -a "${tag}" -m "${tag}"`);
    console.log(`Created annotated tag ${tag}.`);
  }

  try {
    run("git push --follow-tags");
  } catch (error) {
    warn(
      `Branch push with --follow-tags failed (${error.message ?? error}). Continuing with explicit tag push.`,
    );
  }

  if (tagExistsOnRemote(tag)) {
    warn(`Tag ${tag} already exists on origin — skipping explicit tag push.`);
  } else {
    try {
      run(`git push origin "${tag}"`);
      if (!dryRun) {
        console.log(`Pushed tag ${tag} to origin.`);
      }
    } catch (error) {
      warn(`Could not push tag ${tag} (${error.message ?? error}). Release may still be on npm.`);
    }
  }

  const tagUrl = releaseTagUrl(pkg.repository?.url, version);
  console.log("\n[ok] Git release step complete.");
  console.log(`     Version: ${version}`);
  console.log(`     Tag:     ${tag}`);
  if (tagUrl) {
    console.log(`     Tag URL: ${tagUrl}`);
  }
  console.log("");
}

main();
