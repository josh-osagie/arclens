---
title: Getting started
description: Install Arclens, run your first analysis, and open the viewer.
---

## Requirements

- Node.js 18+

## Install

Arclens is published on [npm](https://www.npmjs.com/package/arclens). Install it globally:

```bash
npm install -g arclens
```

Or run it without installing:

```bash
npx arclens analyze ./src --insights
```

## Analyze a project

From your app directory, analyze a source folder:

```bash
npx arclens analyze ./src --insights
```

This command:

1. Scans TypeScript and TSX files under `./src`
2. Prints a terminal report (node counts, relationships, external libraries, top connections)
3. Writes `graph.json` in the current working directory

Use `--insights` to include architecture suggestions and ESLint-style hints in the terminal output. Insights are always embedded in `graph.json` for the viewer.

## Gitignore

Arclens writes generated files into your project. Add these to `.gitignore` so they are not committed by mistake:

```gitignore
.arclens/
graph.json
```

- `.arclens/` — parse cache and optional snippet sidecars (with `--with-snippets`)
- `graph.json` — graph output from `analyze` or `watch`

## Open the viewer

After analysis, start the bundled viewer:

```bash
npx arclens view
```

Open the URL printed in the terminal (default `http://127.0.0.1:5173`). The viewer loads `graph.json` from your current directory.

Add `--open` to launch it in your default browser automatically.

## Watch mode

To re-analyze on file changes:

```bash
npx arclens watch ./src --insights
```

Run watch and the viewer together by opening a second terminal:

```bash
npx arclens view
```

Pass through CLI flags as needed:

```bash
npx arclens watch ./src --insights --no-cache
```

## Typical workflow

1. `npx arclens analyze ./src --insights` — generate `graph.json`
2. `npx arclens view` — explore the graph
3. Refactor, then re-run analyze or use `npx arclens watch` for live updates

## From source (contributors)

To work on Arclens itself, clone the repo and use pnpm:

```bash
git clone https://github.com/JCalmCrasher/arclens.git
cd arclens
pnpm install
```

From the repo, prefix commands with `pnpm arclens` (for example `pnpm arclens analyze ./samples --insights`). Use `pnpm dev:watch` to run watch mode and the viewer together during development.

## Next steps

- [CLI reference](/cli-reference/): all flags and commands
- [Viewer guide](/viewer-guide/): search, entry points, insights badge
- [Concepts](/concepts/): nodes, edges, and insight criteria
