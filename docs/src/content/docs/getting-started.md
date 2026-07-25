---
title: Getting started
description: Install Arclens, run your first analysis, and open the viewer.
---

## Requirements

- [pnpm](https://pnpm.io/) (recommended)
- Node.js 18+

## Install (from source)

Arclens is under active development. Clone the repo and install dependencies:

```bash
git clone <repo-url>
cd react-atlas
pnpm install
```

When the package is published to npm, you will be able to run `npx arclens analyze ./src` from any project. Until then, prefix commands with `pnpm arclens`.

## Analyze a project

Run analysis against the built-in sample project:

```bash
pnpm arclens analyze ./samples --insights
```

This command:

1. Scans TypeScript and TSX files under `./samples`
2. Prints a terminal report (node counts, relationships, external libraries, top connections)
3. Writes `graph.json` in the current working directory

Analyze your own app by pointing at a source folder:

```bash
pnpm arclens analyze ./src --insights
```

Use `--insights` to include architecture suggestions and ESLint-style hints in the terminal output. Insights are always embedded in `graph.json` for the viewer.

## Open the viewer

After analysis, start the Vite dev server for the bundled viewer:

```bash
pnpm dev:viewer
```

Open the URL Vite prints (usually `http://localhost:5173`). The viewer loads `graph.json` from the repo root and auto-refreshes when the file changes.

## Watch mode (recommended for development)

To re-analyze on file changes while the viewer stays open:

```bash
pnpm dev:watch
```

This runs analyze-watch and the viewer concurrently. For the built-in samples, it also re-runs when analyzer extractors under `src/` change.

Watch an external project:

```bash
pnpm dev:watch -- ../my-app/src
```

Or run watch alone:

```bash
pnpm analyze:watch -- ../my-app/src
```

Pass through CLI flags after `--`:

```bash
pnpm analyze:watch -- ./samples --insights --no-cache
```

## Typical workflow

1. `pnpm arclens analyze ./src --insights`: generate `graph.json`
2. `pnpm dev:viewer`: explore the graph
3. Refactor, then re-run analyze or use `pnpm dev:watch` for live updates

## Next steps

- [CLI reference](/cli-reference/): all flags and commands
- [Viewer guide](/viewer-guide/): search, entry points, insights badge
- [Concepts](/concepts/): nodes, edges, and insight criteria
