<p align="center">
  <img src="https://raw.githubusercontent.com/JCalmCrasher/arclens/main/assets/arclens-logo.png" alt="Arclens" width="48" />
</p>

# Arclens
Arclens statically analyzes React and TypeScript applications and transforms them into an interactive architecture graph, making it easy to explore dependencies, trace component relationships, and understand unfamiliar codebases.

Unlike traditional IDE navigation, Arclens gives you a high-level view of your application's architecture without executing your code.

## Why Arclens?

As React applications grow, understanding architecture becomes harder.

Developers spend hours tracing imports, opening files, and searching for component relationships.

Arclens turns your codebase into an interactive map, making onboarding, debugging, and refactoring significantly easier.

## Setup

### Requirements

- Node.js 18 or newer

### Install

**From npm** (published on npm):

```bash
npm install -g arclens
```

Or run without a global install:

```bash
npx arclens analyze ./src --insights
```

**From source** (this repo):

```bash
git clone <repo-url>
cd arclens
pnpm install
```

When working from source, use `pnpm arclens <command>` (same flags as the published CLI). See [Development](#development) for contributor scripts.

### Quick start

Analyze your project, then open the viewer:

```bash
npx arclens analyze ./src --insights
npx arclens view
```

Open the URL printed in the terminal (default `http://127.0.0.1:5173`).

This prints a terminal report, writes `graph.json` in the current working directory, and loads that graph in the viewer.

From this repo:

```bash
pnpm arclens analyze ./samples --insights
pnpm arclens view
```

## Commands

### `analyze`

Scan a React project, print a terminal report, and write `graph.json`.

```bash
npx arclens analyze [path] [options]
```

| Argument | Default     | Description                                |
| -------- | ----------- | ------------------------------------------ |
| `[path]` | `./samples` | Directory to analyze (app root or `./src`) |

#### Examples

```bash
# Full report with architecture hints
npx arclens analyze ./src --insights

# Save a text report
npx arclens analyze ./src --insights --report-file report.txt

# Save structured JSON (includes graph + insights)
npx arclens analyze ./src --report-file report.json

# Write graph to a custom path
npx arclens analyze ./src -o output/graph.json

# See who uses a specific symbol
npx arclens analyze ./src --focus Button

# Force full re-parse and write snippet sidecars
npx arclens analyze ./src --no-cache --with-snippets

# Help
npx arclens analyze -h
```

#### Options

**Output**

| Flag                   | Description                                                                  |
| ---------------------- | ---------------------------------------------------------------------------- |
| `-o, --output [file]`  | Write `graph.json` (default: `graph.json` in cwd)                            |
| `--report-file <file>` | Save a full report (`.txt` = readable, `.json` = structured)                 |
| `--with-snippets`      | Write source sidecars to `.arclens/snippets/` for faster viewer previews |

**Report content**

| Flag             | Description                                                                       |
| ---------------- | --------------------------------------------------------------------------------- |
| `--insights`     | Show architecture suggestions and hook rule hints                                 |
| `--focus <name>` | Show imports, renders, and hook usage for one node (replaces the default summary) |
| `-v, --verbose`  | Include scanned files and export AST kinds                                        |
| `-q, --quiet`    | Minimal output (written file paths only)                                          |
| `--no-color`     | Plain terminal output                                                             |

**Analysis behavior**

| Flag              | Default  | Description                                             |
| ----------------- | -------- | ------------------------------------------------------- |
| `--no-cache`      | cache on | Re-parse all files and ignore `.arclens/cache.json` |
| `--max-files <n>` | `3000`   | Refuse to scan more than N files (safety guard)         |

#### Terminal output

A typical run includes:

- **Summary** — node and edge counts
- **Nodes by type** — components, hooks, contexts, utilities
- **Relationships** — imports, renders, hook uses
- **External libraries** — npm packages referenced
- **Top connections** — strongest links in the graph
- **Most referenced** — nodes with the most incoming edges
- **Insights** — with `--insights`

### `watch`

Re-run `analyze` when `.ts`/`.tsx` files change. Accepts the same flags as `analyze`.

```bash
npx arclens watch ./src --insights
```

While watch is running in an interactive terminal, press `r` to re-analyze immediately, `q` to stop, or `?` for help.

Analyze and view together:

```bash
npx arclens watch ./src --insights
# in another terminal
npx arclens view
```

The viewer auto-refreshes when `graph.json` changes.

### `view`

Serve the architecture graph viewer for the current `graph.json`.

```bash
npx arclens view
npx arclens view --graph ./output/graph.json --open
```

| Flag                 | Default      | Description                          |
| -------------------- | ------------ | ------------------------------------ |
| `-p, --port <n>`     | `5173`       | Port for the viewer server           |
| `-g, --graph <file>` | `graph.json` | Path to the graph file               |
| `--project-root`     | from graph   | Project root for live source snippets |
| `--open`             | off          | Open the viewer in your browser      |
| `--dev`              | auto*        | Vite dev server with HMR from `viewer/` |

\*From this repo, dev mode is auto-detected when `viewer/vite.config.ts` exists. Published installs serve static assets from `dist/viewer/`.

Run `analyze` first so `graph.json` exists.

## Viewer

The viewer is a React Flow app that reads `graph.json` and auto-refreshes when the file changes.

### What you can do

- **Search** nodes by name in the left sidebar
- **Browse folders** and entry points on large graphs without rendering every node at once
- **Click a node** to open a details panel with file, type, connections, props, and source preview
- **Inspect insights** via the floating badge (mirrors CLI `--insights` output)
- **Auto-refresh** when `graph.json` changes — pair `watch` and `view` while developing

## graph.json

Each node includes metadata for the viewer and for tooling:

```json
{
  "id": "samples/Counter.tsx::counter",
  "name": "counter",
  "file": "samples/Counter.tsx",
  "type": "component",
  "exportKind": "named",
  "kind": "VariableDeclaration",
  "connections": {
    "incoming": [],
    "outgoing": [
      {
        "nodeId": "...",
        "name": "Button",
        "edgeType": "renders",
        "file": "..."
      }
    ]
  },
  "stats": { "incoming": 0, "outgoing": 3 }
}
```

Insights and entry node ids are attached under `meta` for the viewer sidebar and badge.

## What gets detected

| Type      | How                                                      |
| --------- | -------------------------------------------------------- |
| Component | Exported function that returns JSX                       |
| Hook      | `use*` prefix or calls hooks without JSX                 |
| Context   | Exported `createContext(...)`                            |
| Utility   | Other exported functions (API helpers, formatters, etc.) |

Relationships:

- **imports** — module imports between project files
- **renders** — JSX usage (`<Button />`)
- **uses** — hook calls (`useState`, `useEffect`, etc.)

## Development

Contributor setup uses [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm test              # run unit and integration tests
pnpm arclens analyze ./samples --insights
pnpm arclens watch ./samples --insights
pnpm arclens view --dev   # Vite dev server with HMR (viewer/ source)
pnpm build             # compile CLI + bundle viewer to dist/
pnpm dev:docs          # start the docs site
```

Shorthand scripts (same CLI, useful in this repo):

| Script            | Equivalent                          |
| ----------------- | ----------------------------------- |
| `pnpm analyze`    | `pnpm arclens analyze`          |
| `pnpm analyze:watch` | `pnpm arclens watch`         |
| `pnpm dev:viewer` | `pnpm arclens view --dev` (Vite HMR from `viewer/`) |
| `pnpm dev:watch`  | watch + view together (see script)  |

**Viewer dev vs production:** From this repo, `pnpm dev:viewer` (or `arclens view --dev`) runs the Vite dev server in `viewer/` so favicon, title, and UI changes hot-reload. `graph.json` is served from your current working directory. After `pnpm build`, or from the published npm package (no `viewer/` folder), `arclens view` serves the static bundle in `dist/viewer/`.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for pull request guidelines.

### Docs site & deployment

The documentation and marketing landing page live in `docs/` (Astro + Starlight). Local preview:

```bash
pnpm dev:docs
```

### Repo layout

| Path       | Role                        |
| ---------- | --------------------------- |
| `src/`     | CLI + static analyzer       |
| `viewer/`  | React Flow graph UI         |
| `docs/`    | Documentation site          |
| `samples/` | Sample project for analysis |

Publishing runs `pnpm build`, which compiles the CLI to `dist/` and copies the viewer build to `dist/viewer/`. The `arclens` bin works from the compiled output or falls back to `tsx` when developing from source.

## License

ISC
