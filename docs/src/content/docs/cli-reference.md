---
title: CLI reference
description: Commands, flags, and examples for the arclens CLI.
---

The CLI entry point is `src/cli.ts`. From this repo, invoke it with:

```bash
pnpm arclens <command> [options]
```

## Commands

### `analyze`

Analyze a React/TypeScript project and generate `graph.json`.

```bash
pnpm arclens analyze [path] [options]
```

| Argument | Default | Description |
| -------- | ------- | ----------- |
| `[path]` | `./samples` | Directory to analyze (app root or `./src`) |

#### Output options

| Flag | Description |
| ---- | ----------- |
| `-o, --output [file]` | Write graph JSON (default: `graph.json` in cwd). Omit graph output only when using `--report-file` alone. |
| `--report-file <file>` | Save a full report. `.txt` = human-readable, `.json` = structured data including the graph. |
| `--with-snippets` | Write truncated source sidecars to `.arclens/snippets/` inside the analyzed project for faster viewer previews. |

#### Report content

| Flag | Description |
| ---- | ----------- |
| `--insights` | Show architecture suggestions and ESLint-style hints in the terminal report. |
| `--focus <name>` | Show who imports, renders, or uses a specific node (e.g. `Button`). Replaces the default summary when set. |
| `-v, --verbose` | Include scanned file list and export AST kind breakdown. |
| `-q, --quiet` | Minimal output:written file paths only. |
| `--no-color` | Disable ANSI colors in terminal output. |

#### Analysis behavior

| Flag | Default | Description |
| ---- | ------- | ----------- |
| `--no-cache` | cache on | Re-parse all files and ignore `.arclens/cache.json`. |
| `--max-files <number>` | `3000` | Refuse to scan more than N files (safety guard). |
| `--reanalyze` | `false` | Watch mode: show re-analyze progress (used by `analyze:watch`). |

## Watch scripts

There is no separate `watch` subcommand in the CLI. Watch mode is provided by shell scripts:

| Script | Description |
| ------ | ----------- |
| `pnpm analyze:watch -- [path] [flags]` | Re-run `analyze` when TS/TSX files change (via chokidar). |
| `pnpm dev:watch -- [path] [flags]` | Runs `analyze:watch` and `dev:viewer` together. |

When watch runs, `ARCLENS_WATCH_TARGET` is set so progress output behaves like `--reanalyze`.

While watching (interactive terminal), use:

| Key | Action |
| --- | ------ |
| `r` | Re-run analyze immediately |
| `q` | Stop watching and exit |
| `?` | Show available commands |

Ctrl+C also stops watch. In non-interactive environments (CI, piped stdin), watch runs without the keyboard loop.

Examples:

```bash
pnpm analyze:watch -- ./samples --insights
pnpm dev:watch -- ../my-app/src --no-cache
```

## Examples

```bash
# Full report with insights
pnpm arclens analyze ./src --insights

# Quiet run, custom graph path
pnpm arclens analyze ./src -o output/graph.json -q

# Saved text report
pnpm arclens analyze ./src --insights --report-file report.txt

# Saved JSON report (includes graph + insights)
pnpm arclens analyze ./src --report-file report.json

# Focus on one symbol
pnpm arclens analyze ./samples --focus Button

# Force full re-parse and snippet sidecars
pnpm arclens analyze ./src --no-cache --with-snippets

# Verbose scan with insights
pnpm arclens analyze ./samples -v --insights
```

## Terminal report sections

A typical analyze run prints:

- **Summary**: node and edge counts, scan duration
- **Nodes by type**: components, hooks, contexts, utilities, entry, config
- **Relationships**: counts of `imports`, `renders`, and `uses` edges
- **External libraries**: npm packages referenced from the project
- **Top connections**: strongest links in the graph
- **Most referenced**: nodes with the most incoming edges
- **Insights**: when `--insights` is set (errors, warnings, info, tips)

## Exit codes

On failure (invalid path, `--max-files` exceeded, parse errors surfaced as fatal), the CLI sets exit code `1`. In `--quiet` mode, errors print to stderr as `arclens: <message>`.

## Help

```bash
pnpm arclens analyze -h
```
