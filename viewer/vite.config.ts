import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const graphPath = path.resolve(rootDir, "../graph.json");

function serveGraphJson(): Plugin {
  return {
    name: "serve-graph-json",
    configureServer(server) {
      server.middlewares.use("/graph.json", (_req, res) => {
        if (!fs.existsSync(graphPath)) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "graph.json not found. Run pnpm analyze first." }));
          return;
        }

        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(fs.readFileSync(graphPath, "utf8"));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveGraphJson()],
  server: {
    watch: {
      ignored: ["**/node_modules/**", "**/dist/**"],
    },
  },
});
