# React Atlas

# React Atlas

Understand any React codebase in minutes.

React Atlas statically analyzes React and TypeScript applications and transforms them into an interactive architecture graph, making it easy to explore dependencies, trace component relationships, and understand unfamiliar codebases.

Unlike traditional IDE navigation, React Atlas gives you a high-level view of your application's architecture without executing your code.

## Why React Atlas?

As React applications grow, understanding architecture becomes harder.

Developers spend hours tracing imports, opening files, and searching for component relationships.

React Atlas turns your codebase into an interactive map, making onboarding, debugging, and refactoring significantly easier.

## Setup

### Requirements

- [pnpm](https://pnpm.io/) (recommended)

### Install

**From npm** (once published):

```bash
npm install -g react-atlas
```

Or run without a global install:

```bash
npx react-atlas analyze ./src --insights
```

**From source** (this repo):

```bash
git clone <repo-url>
cd react-atlas
pnpm install
```

When working from source, prefix CLI commands with `pnpm react-atlas` instead of `react-atlas`. See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup.

### Quick start

Analyze the built-in sample project and open the viewer:

```bash
pnpm react-atlas analyze ./samples --insights
pnpm dev:viewer
```

Open the URL Vite prints (usually `http://localhost:5173`).

This prints a terminal report, writes `graph.json` in the current working directory, and loads that graph in the viewer.

```bash
react-atlas analyze ./samples --insights
```

The CLI entry point is `src/cli.ts`. Invoke it with `pnpm react-atlas <command>` from this repo, or `react-atlas <command>` after npm publish.

### `analyze`

Scan a React project, print a terminal report, and write `graph.json`.

```bash
pnpm react-atlas analyze [path] [options]
```

| Argument | Default     | Description                                |
| -------- | ----------- | ------------------------------------------ |
| `[path]` | `./samples` | Directory to analyze (app root or `./src`) |

#### Examples

```bash
# Full report with architecture hints
pnpm react-atlas analyze ./src --insights

# Shorthand script (same as above)
pnpm analyze ./samples --insights

# Save a text report
pnpm react-atlas analyze ./src --insights --report-file report.txt

# Save structured JSON (includes graph + insights)
pnpm react-atlas analyze ./src --report-file report.json

# Write graph to a custom path
pnpm react-atlas analyze ./src -o output/graph.json

# See who uses a specific symbol
pnpm react-atlas analyze ./samples --focus Button

# Force full re-parse and write snippet sidecars
pnpm react-atlas analyze ./src --no-cache --with-snippets

# Help
pnpm react-atlas analyze -h
```

#### Options

**Output**

| Flag                   | Description                                                                  |
| ---------------------- | ---------------------------------------------------------------------------- |
| `-o, --output [file]`  | Write `graph.json` (default: `graph.json` in cwd)                            |
| `--report-file <file>` | Save a full report (`.txt` = readable, `.json` = structured)                 |
| `--with-snippets`      | Write source sidecars to `.react-atlas/snippets/` for faster viewer previews |

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
| `--no-cache`      | cache on | Re-parse all files and ignore `.react-atlas/cache.json` |
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

#### Watch scripts

There is no separate `watch` CLI subcommand. Re-analysis on file changes is handled by pnpm scripts:

| Script                                 | Description                                   |
| -------------------------------------- | --------------------------------------------- |
| `pnpm analyze:watch -- [path] [flags]` | Re-run `analyze` when TS/TSX files change     |
| `pnpm dev:watch -- [path] [flags]`     | Run `analyze:watch` and `dev:viewer` together |

```bash
pnpm analyze:watch -- ./samples --insights
pnpm dev:watch -- ../my-app/src --no-cache
```

While `analyze:watch` is running in an interactive terminal, press `r` to re-analyze immediately, `q` to stop, or `?` for help.

## Viewer

The viewer is a Vite + React Flow app in `viewer/`. It reads `graph.json` from the repo root and auto-refreshes when the file changes.

### Start the viewer

Run an analysis first, then start the dev server:

```bash
pnpm analyze ./samples --insights
pnpm dev:viewer
```

Open the URL Vite prints (usually `http://localhost:5173`).

### What you can do

- **Search** nodes by name in the left sidebar
- **Browse folders** and entry points on large graphs without rendering every node at once
- **Click a node** to open a details panel with file, type, connections, props, and source preview
- **Inspect insights** via the floating badge (mirrors CLI `--insights` output)
- **Auto-refresh** when `graph.json` changes — use `pnpm dev:watch` to re-analyze while the viewer stays open

### Watch while developing

```bash
# Built-in samples (also re-runs when analyzer extractors under src/ change)
pnpm dev:watch

# External project
pnpm dev:watch -- ../my-app/src
```

For analyze-only watch without the viewer:

```bash
pnpm analyze:watch -- ../my-app/src
```

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

```bash
pnpm test              # run unit tests
pnpm dev:docs          # start the docs site
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for pull request guidelines.

### Repo layout

| Path       | Role                        |
| ---------- | --------------------------- |
| `src/`     | CLI + static analyzer       |
| `viewer/`  | React Flow graph UI         |
| `docs/`    | Documentation site          |
| `samples/` | Sample project for analysis |

On npm publish, the build step compiles the CLI and bundles the viewer to static files under `dist/viewer/`. A `react-atlas view` command to serve those assets is planned.

## License

ISC
