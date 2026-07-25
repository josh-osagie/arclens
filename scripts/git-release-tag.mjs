import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const packageJsonPath = path.join(packageRoot, "package.json");

function run(command, options = {}) {
  execSync(command, { cwd: packageRoot, stdio: "inherit", ...options });
}

function runOutput(command) {
  return execSync(command, { cwd: packageRoot, encoding: "utf8" }).trim();
}

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const version = pkg.version;
const tag = `v${version}`;

console.log(`\nTagging and pushing release ${tag} to GitHub...`);

run("git add package.json");
if (fs.existsSync(path.join(packageRoot, "pnpm-lock.yaml"))) {
  run("git add pnpm-lock.yaml");
}
run("git add -u");

const pending = runOutput("git status --porcelain");
if (pending) {
  run(`git commit -m "chore: release ${tag}"`);
} else {
  console.log("No tracked changes to commit (version may already be committed).");
}

const existingTag = runOutput(`git tag -l "${tag}"`);
if (existingTag) {
  console.error(`Git tag ${tag} already exists. Skipping tag creation.`);
  process.exit(1);
}

run(`git tag ${tag}`);
run("git push");
run("git push --tags");

console.log(`\n[ok] Released ${tag} on npm and pushed to GitHub.`);
