import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { URL } from "node:url";
import { getPackageRoot } from "./packageRoot";
import {
  parseSnippetLinesParam,
  readSnippetFromDisk,
  resolveRelativeFile,
} from "./snippets";

export type ViewOptions = {
  port: number;
  graphPath: string;
  projectRoot?: string;
  open?: boolean;
  /** Prefer Vite dev server with HMR (viewer/ source). */
  dev?: boolean;
};

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readProjectRootFromGraph(graphPath: string): string | null {
  if (!fs.existsSync(graphPath)) {
    return null;
  }

  try {
    const graph = JSON.parse(fs.readFileSync(graphPath, "utf8")) as {
      meta?: { targetDir?: string };
    };
    const targetDir = graph.meta?.targetDir;
    return targetDir && fs.existsSync(targetDir)
      ? path.resolve(targetDir)
      : null;
  } catch {
    return null;
  }
}

export function resolveViewerDist(packageRoot: string): string | null {
  for (const candidate of [
    path.join(packageRoot, "dist", "viewer"),
    path.join(packageRoot, "viewer", "dist"),
  ]) {
    if (fs.existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }
  return null;
}

function resolveViewerSourceDir(packageRoot: string): string | null {
  const viewerDir = path.join(packageRoot, "viewer");
  for (const configName of [
    "vite.config.ts",
    "vite.config.mjs",
    "vite.config.js",
  ]) {
    if (fs.existsSync(path.join(viewerDir, configName))) {
      return viewerDir;
    }
  }
  return null;
}

/** Use Vite HMR when developing from source; static dist/viewer in published installs. */
export function shouldUseViteDev(
  packageRoot: string,
  options: Pick<ViewOptions, "dev">
): boolean {
  if (options.dev) {
    return true;
  }
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  return resolveViewerSourceDir(packageRoot) !== null;
}

function resolveProjectRoot(options: ViewOptions): string | null {
  if (options.projectRoot && fs.existsSync(options.projectRoot)) {
    return path.resolve(options.projectRoot);
  }
  return readProjectRootFromGraph(options.graphPath);
}

function serveStaticFile(
  distDir: string,
  requestPath: string,
  res: http.ServerResponse
): boolean {
  const safePath = path
    .normalize(requestPath.replace(/^\/+/, ""))
    .replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(distDir, safePath);

  if (!filePath.startsWith(distDir)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return true;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.statusCode = 200;
    res.setHeader(
      "Content-Type",
      MIME_TYPES[ext] ?? "application/octet-stream"
    );
    fs.createReadStream(filePath).pipe(res);
    return true;
  }

  return false;
}

function createStaticServer(
  distDir: string,
  options: ViewOptions
): http.Server {
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${options.port}`);

    if (url.pathname === "/graph.json") {
      if (!fs.existsSync(options.graphPath)) {
        sendJson(res, 404, {
          error: "graph.json not found. Run arclens analyze first.",
        });
        return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      res.end(fs.readFileSync(options.graphPath, "utf8"));
      return;
    }

    if (url.pathname === "/api/snippet") {
      if (req.method !== "GET") {
        sendJson(res, 405, { error: "Method not allowed" });
        return;
      }

      const projectRoot = resolveProjectRoot(options);
      if (!projectRoot) {
        sendJson(res, 503, {
          error:
            "Project root unavailable. Run analyze first or pass --project-root.",
        });
        return;
      }

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
        const snippet = readSnippetFromDisk(
          projectRoot,
          relativeFile,
          maxLines
        );
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
      return;
    }

    if (serveStaticFile(distDir, url.pathname, res)) {
      return;
    }

    const indexPath = path.join(distDir, "index.html");
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(fs.readFileSync(indexPath, "utf8"));
  });
}

async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  const command =
    platform === "win32"
      ? `start "" "${url}"`
      : platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;

  spawn(command, [], { shell: true, stdio: "ignore" }).unref();
}

function startViteDevServer(
  options: ViewOptions,
  packageRoot: string
): Promise<number> {
  const viewerDir = resolveViewerSourceDir(packageRoot);
  if (!viewerDir) {
    throw new Error(
      "Viewer source not found. Use a published install or clone the repo with viewer/."
    );
  }

  const viteCli = path.join(
    viewerDir,
    "node_modules",
    "vite",
    "bin",
    "vite.js"
  );

  if (!fs.existsSync(viteCli)) {
    throw new Error(
      "Viewer dev dependencies missing. From source run `pnpm install` in the repo, or build with `pnpm build:viewer` for static assets."
    );
  }

  const env = { ...process.env };
  env.VITE_ARCLENS_GRAPH_PATH = options.graphPath;
  const projectRoot = resolveProjectRoot(options);
  if (projectRoot) {
    env.VITE_ARCLENS_PROJECT_ROOT = projectRoot;
  }

  const url = `http://127.0.0.1:${options.port}`;
  console.log("Arclens view (dev server)");
  console.log(`  url:     ${url}`);
  console.log(`  graph:   ${options.graphPath}`);
  console.log(`  source:  ${viewerDir}`);
  if (projectRoot) {
    console.log(`  project: ${projectRoot}`);
  }
  console.log("");

  const viteArgs = [viteCli, "--port", String(options.port), "--host"];
  if (options.open) {
    viteArgs.push("--open");
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, viteArgs, {
      cwd: viewerDir,
      env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 0));
  });
}

export async function runView(options: ViewOptions): Promise<number> {
  const packageRoot = getPackageRoot();

  if (shouldUseViteDev(packageRoot, options)) {
    return startViteDevServer(options, packageRoot);
  }

  const distDir = resolveViewerDist(packageRoot);
  if (!distDir) {
    throw new Error(
      "Viewer not available. Run `pnpm build:viewer`, or from source use `arclens view --dev`."
    );
  }

  const url = `http://127.0.0.1:${options.port}`;
  const server = createStaticServer(distDir, options);

  await new Promise<void>((resolve, reject) => {
    server.listen(options.port, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });

  console.log("Arclens view");
  console.log(`  url:     ${url}`);
  console.log(`  graph:   ${options.graphPath}`);
  console.log(`  assets:  ${distDir}`);
  console.log("");

  if (options.open) {
    await openBrowser(url);
  }

  return await new Promise<number>((resolve) => {
    const onSignal = () => {
      server.close(() => resolve(0));
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
  });
}
