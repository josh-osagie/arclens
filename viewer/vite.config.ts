import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import {
  parseSnippetLinesParam,
  readSnippetFromDisk,
  resolveRelativeFile,
} from "../src/snippets.js";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const graphPath = path.resolve(rootDir, "../graph.json");

function readProjectRootFromGraph(): string | null {
  if (!fs.existsSync(graphPath)) {
    return null;
  }

  try {
    const graph = JSON.parse(fs.readFileSync(graphPath, "utf8")) as {
      meta?: { targetDir?: string };
    };
    const targetDir = graph.meta?.targetDir;
    return targetDir && fs.existsSync(targetDir) ? path.resolve(targetDir) : null;
  } catch {
    return null;
  }
}

function resolveProjectRoot(): string | null {
  const fromEnv = process.env.VITE_ATLAS_PROJECT_ROOT;
  if (fromEnv && fs.existsSync(fromEnv)) {
    return path.resolve(fromEnv);
  }
  return readProjectRootFromGraph();
}

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

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

function serveSnippetApi(): Plugin {
  return {
    name: "serve-snippet-api",
    configureServer(server) {
      server.middlewares.use("/api/snippet", (req, res) => {
        if (req.method !== "GET") {
          sendJson(res, 405, { error: "Method not allowed" });
          return;
        }

        const projectRoot = resolveProjectRoot();
        if (!projectRoot) {
          sendJson(res, 503, {
            error:
              "Project root unavailable. Set VITE_ATLAS_PROJECT_ROOT or analyze with meta.targetDir in graph.json.",
          });
          return;
        }

        const url = new URL(req.url ?? "/", "http://localhost");
        const fileParam = url.searchParams.get("file");
        if (!fileParam) {
          sendJson(res, 400, { error: "Missing file query parameter" });
          return;
        }

        const relativeFile = resolveRelativeFile(projectRoot, fileParam);
        if (!relativeFile) {
          sendJson(res, 400, { error: "Invalid file path" });
          return;
        }

        const maxLines = parseSnippetLinesParam(url.searchParams.get("lines"));

        try {
          const snippet = readSnippetFromDisk(projectRoot, relativeFile, maxLines);
          sendJson(res, 200, {
            file: relativeFile,
            content: snippet.content,
            lines: snippet.lineCount,
            totalLines: snippet.totalLines,
            truncated: snippet.truncated,
            source: snippet.source,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          sendJson(res, 404, { error: message, file: relativeFile });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serveGraphJson(), serveSnippetApi()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  server: {
    watch: {
      ignored: ["**/node_modules/**", "**/dist/**"],
    },
  },
});
