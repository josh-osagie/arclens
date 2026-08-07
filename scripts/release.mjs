import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");

const kind = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

const VALID_KINDS = new Set(["publish", "patch", "minor", "major"]);

function run(command) {
  console.log(`\n> ${command}`);
  execSync(command, { cwd: packageRoot, stdio: "inherit" });
}

function usage() {
  console.error(
    "Usage: node scripts/release.mjs <publish|patch|minor|major> [--dry-run]"
  );
  process.exit(1);
}

if (!VALID_KINDS.has(kind)) {
  usage();
}

if (kind !== "publish") {
  if (dryRun) {
    console.log(
      `\n> [dry-run] would run: npm version ${kind} --no-git-tag-version`
    );
  } else {
    run(`npm version ${kind} --no-git-tag-version`);
  }
}

run("pnpm build");

if (dryRun) {
  run("npm publish --dry-run --access public");
  run("node scripts/git-release-tag.mjs --dry-run");
} else {
  run("npm publish --access public");
  run("node scripts/git-release-tag.mjs");
}
