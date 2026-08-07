import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { getPackageRoot } from "./packageRoot";

const BANNER = String.raw`
    ___    ____  ________    _______   _______
   /   |  / __ \/ ____/ /   / ____/ | / / ___/
  / /| | / /_/ / /   / /   / __/ /  |/ /\__ \ 
 / ___ |/ _, _/ /___/ /___/ /___/ /|  /___/ / 
/_/  |_/_/ |_|\____/_____/_____/_/ |_//____/  
`.trimEnd();

export function getPackageVersion(): string {
  const packageJsonPath = path.join(getPackageRoot(), "package.json");
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    version?: string;
  };
  return pkg.version ?? "0.0.0";
}

export function formatVersionBanner(
  version: string = getPackageVersion(),
  options: { color?: boolean } = {}
): string {
  const useColor = options.color !== false && process.stdout.isTTY;
  const accent = useColor ? pc.cyan : (value: string) => value;
  const muted = useColor ? pc.dim : (value: string) => value;
  const bold = useColor ? pc.bold : (value: string) => value;

  return [
    accent(BANNER),
    "",
    muted("Interactive architecture explorer for React/TypeScript"),
    `${bold("Version")} ${version}`,
    muted("https://arclens.vercel.app"),
  ].join("\n");
}

export function isDevelopmentInstall(root: string = getPackageRoot()): boolean {
  return fs.existsSync(path.join(root, "src", "cli.ts"));
}
