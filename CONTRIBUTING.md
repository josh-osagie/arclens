# Contributing to React Atlas

Thanks for taking a look. This doc covers local setup, running tests, and what we expect in pull requests.

## Setup

```bash
pnpm install
```

You need Node.js 18 or newer.

## Run the analyzer locally

```bash
pnpm react-atlas analyze ./samples --insights
```

The `samples/` folder is the main fixture during development. Add or change files there to test extractors, then re-run analyze.

## Run tests

```bash
pnpm test
```

Watch mode:

```bash
pnpm test:watch
```

Tests live in `tests/`. Unit tests cover extractors and graph logic. Integration tests run the full pipeline against `samples/` and fixtures in `tests/fixtures/`.

When you change classification, graph shape, or CLI output, update or add tests.

## Project layout

```
src/
  cli.ts              CLI entry
  analyzeProject.ts   Orchestrates scan + graph build
  buildGraph.ts       Nodes and edges from AST data
  enrichGraph.ts      Per-node connections and stats
  focus.ts            --focus terminal output
  extractors/         AST extractors (exports, hooks, rules)
  insights.ts         Architecture hints
  report.ts           Terminal and file reports
samples/              Default analyze target
tests/fixtures/       Small projects for edge cases
viewer/               React Flow graph UI
```

## Adding detection logic

1. Extend or add an extractor under `src/extractors/`.
2. Wire it in `analyzeProject.ts` if it feeds the graph or insights.
3. Update `types.ts` if the graph schema changes.
4. Add a fixture under `tests/fixtures/` if the case is not covered by `samples/`.
5. Add tests and run `pnpm test`.

Keep extractors static. Do not import or execute code from the project being analyzed.

## Pull requests

- One logical change per PR when possible.
- Include tests for behavior changes.
- Run `pnpm test` before opening.
- Describe what you tested manually (e.g. "ran analyze on `./samples`").

## Reporting issues

Include:

- Command you ran
- Expected vs actual output
- A minimal file or snippet that reproduces the issue if you can

Bug reports with a small reproduction fixture are the easiest to fix.
