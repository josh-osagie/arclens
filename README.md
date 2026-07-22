# React Atlas

Static analysis for React and TypeScript codebases. React Atlas scans your project, builds a dependency graph of components, hooks, contexts, and utilities, and prints a summary in the terminal. It also writes `graph.json` for the bundled viewer.

Code is parsed with ts-morph. Nothing from your project is executed.

## Requirements

- pnpm (recommended)

## Install

### Using the package (target workflow)

Once published to npm:

```bash
npm install -g react-atlas
```

Then from any React/TypeScript project:

```bash
react-atlas analyze ./src --insights
react-atlas view
```

Or without a global install:

```bash
npx react-atlas analyze ./src
npx react-atlas view ./graph.json
```

### Working on this repo

If you are contributing or running from source, clone and install dependencies:

```bash
git clone <repo-url>
cd react-atlas
pnpm install
```

Use `pnpm react-atlas` instead of `react-atlas` until the package is published. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Quick start

Analyze the sample project:

```bash
# from source
pnpm react-atlas analyze ./samples --insights

# after npm publish
react-atlas analyze ./samples --insights
```

This prints a terminal report and writes `graph.json` in the current working directory.

## CLI

```bash
react-atlas analyze [path] [options]
react-atlas view [graph.json]   # planned
```

While developing from source, prefix commands with `pnpm react-atlas`.

Common examples:

```bash
# Full report with architecture hints
pnpm react-atlas analyze ./src --insights

# Save a text report
pnpm react-atlas analyze ./src --insights --report-file report.txt

# Save structured JSON (includes graph + insights)
pnpm react-atlas analyze ./src --insights --report-file report.json

# Write graph to a custom path
pnpm react-atlas analyze ./src -o output/graph.json

# See who uses a specific symbol
pnpm react-atlas analyze ./samples --focus Button

# Help for analyze options
pnpm react-atlas analyze -h
```

### Options

| Flag | Description |
|------|-------------|
| `-o, --output [file]` | Write `graph.json` (default: `graph.json`) |
| `--report-file <file>` | Save report (`.txt` = readable, `.json` = structured) |
| `--insights` | Show architecture suggestions and hook rule hints |
| `--focus <name>` | Show imports, renders, and hook usage for one node |
| `-v, --verbose` | Include scanned files and export AST kinds |
| `-q, --quiet` | Minimal output |
| `--no-color` | Plain terminal output |
| `--max-files <n>` | Safety limit (default: 3000) |

## Terminal output

A typical run includes:

- **Summary** - node and edge counts
- **Nodes by type** - components, hooks, contexts, utilities
- **Relationships** - imports, renders, hook uses
- **External libraries** - npm packages referenced
- **Top connections** - strongest links in the graph
- **Most referenced** - nodes with the most incoming edges
- **Insights** - optional, with `--insights`

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
      { "nodeId": "...", "name": "Button", "edgeType": "renders", "file": "..." }
    ]
  },
  "stats": { "incoming": 0, "outgoing": 3 }
}
```

## Viewer

### Planned (npm package)

The viewer ships inside the `react-atlas` package. You analyze first, then open the UI:

```bash
react-atlas analyze ./src
react-atlas view              # serves viewer, loads ./graph.json
react-atlas view out/graph.json
```

`view` will start a local static server and open your browser. No separate install.

### Development
The viewer lives in `viewer/` in this same repository.

```bash
pnpm analyze ./samples
pnpm dev:viewer
```

Open the URL Vite prints (the url from your terminal). During dev, the viewer reads `graph.json` from the repo root.

To re-analyze on file changes while building the viewer:

```bash
pnpm dev:watch
```

## Packaging layout

This repo is a monorepo with two parts that ship together:

| Path | Role | Published? |
|------|------|------------|
| `src/` | CLI + static analyzer | yes, as `react-atlas` |
| `viewer/` | React Flow UI | yes, built to `dist/viewer/` and bundled in the package |

On publish, the build step compiles the CLI and builds the viewer to static files. The npm package exposes:

- `react-atlas` binary (`analyze`, `view`, ...)
- analyzer code for programmatic use (optional later)
- prebuilt viewer assets (served by `view`)

The viewer stays in this repo so graph schema changes and UI changes land in one place.

```
your-app/
  graph.json          ← written by analyze

react-atlas (npm)/
  dist/cli.js
  dist/viewer/        ← static HTML/JS/CSS
```

## What gets detected

| Type | How |
|------|-----|
| Component | Exported function that returns JSX |
| Hook | `use*` prefix or calls hooks without JSX |
| Context | Exported `createContext(...)` |
| Utility | Other exported functions (API helpers, formatters, etc.) |

Relationships:

- **imports** - module imports between project files
- **renders** - JSX usage (`<Button />`)
- **uses** - hook calls (`useState`, `useEffect`, etc.)

## Tests

```bash
pnpm test
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and pull request guidelines.

## License

ISC
