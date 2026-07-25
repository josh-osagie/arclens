import fs from "node:fs";
import path from "node:path";

/**
 * Directory containing package.json for this install (repo root or node_modules/arclens).
 */
export function getPackageRoot(): string {
  let dir = __dirname;

  while (true) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(dir, "package.json"), "utf8"),
      ) as { name?: string };
      if (pkg.name === "arclens") {
        return dir;
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return path.resolve(__dirname, "..");
    }
    dir = parent;
  }
}
