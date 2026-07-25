import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const viewerDist = path.join(packageRoot, "viewer", "dist");
const outDir = path.join(packageRoot, "dist", "viewer");

if (!fs.existsSync(path.join(viewerDist, "index.html"))) {
  console.error("copy-viewer: viewer/dist not found. Run pnpm build:viewer first.");
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.cpSync(viewerDist, outDir, { recursive: true });
console.log(`Copied viewer build to ${outDir}`);
