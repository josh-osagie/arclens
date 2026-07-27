import { execSync } from "node:child_process";
import pc from "picocolors";
import {
  formatVersionBanner,
  getPackageVersion,
  isDevelopmentInstall,
} from "./versionBanner";

export function runUpdate(options: { color?: boolean } = {}): number {
  const useColor = options.color !== false;
  const muted = useColor ? pc.dim : (value: string) => value;

  console.log(formatVersionBanner(getPackageVersion(), { color: useColor }));
  console.log("");

  if (isDevelopmentInstall()) {
    console.log("Running from source: skipping npm global update.");
    console.log("");
    console.log("To update a global install:");
    console.log(`  ${muted("npm install -g arclens@latest")}`);
    console.log("");
    console.log("To update this repo:");
    console.log(`  ${muted("git pull && pnpm install && pnpm build")}`);
    return 0;
  }

  console.log("Updating global arclens via npm...");
  console.log(`${muted("npm install -g arclens@latest")}`);
  console.log("");

  try {
    execSync("npm install -g arclens@latest", { stdio: "inherit" });
    console.log("");
    console.log("✅Update complete.");
    return 0;
  } catch {
    console.error("");
    console.error(
      "❌ Update failed. Try manually: `npm install -g arclens@latest`",
    );
    return 1;
  }
}
