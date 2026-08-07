---
title: Concepts
description: Graph nodes, edges, entry points, and how insights are computed.
---

Arclens builds a directed graph from static analysis. Understanding nodes and edges helps you interpret both terminal reports and the viewer.

## Nodes

Each node represents an exported symbol or external module reference in your codebase.

| Type          | How it is detected                                                   |
| ------------- | -------------------------------------------------------------------- |
| **component** | Exported function or variable that returns JSX                       |
| **hook**      | `use*` prefix or calls hooks without returning JSX                   |
| **context**   | Exported `createContext(...)`                                        |
| **utility**   | Other exported functions (helpers, API clients, formatters)          |
| **entry**     | Bootstrap files such as `main.tsx` or app router roots               |
| **config**    | Config-like exports (vite config, test setup, etc.)                  |
| **external**  | npm package (e.g. `react`, `lodash`):shown as a single external node |

Each node stores:

- `id`:unique key (`file::symbol`)
- `name`, `file`, `type`
- `connections.incoming` / `connections.outgoing`:summarized edges
- `stats.incoming` / `stats.outgoing`:edge counts for quick ranking

## Edges

Edges describe how nodes relate:

| Edge type   | Meaning                     | Example                             |
| ----------- | --------------------------- | ----------------------------------- |
| **imports** | Module import between files | `import { Button } from './Button'` |
| **renders** | JSX usage                   | `<Button />`                        |
| **uses**    | Hook invocation             | `useState(...)`, `useEffect(...)`   |

The analyzer does not yet build a general function **calls** graph:only hook **uses** and component **renders** are tracked for JSX/React patterns.

## graph.json

Analyze writes a slim export suitable for the viewer:

```json
{
  "meta": {
    "targetDir": "samples",
    "isReactProject": true,
    "insights": [],
    "entryNodeIds": []
  },
  "nodes": [],
  "edges": []
}
```

Nodes may include pre-computed `layout` coordinates (Dagre layout runs during analyze). Insights and entry node ids are attached under `meta` for the viewer sidebar and badge.

## Entry points

Entry points are files where the app likely starts. Detection uses path heuristics:

- `main.tsx` / `main.jsx`
- `src/index.tsx`, `app/index.tsx`
- Next.js App Router: `app/layout.tsx`, `app/page.tsx`
- Pages router: `pages/_app.tsx`, `pages/_document.tsx`

Files matching test, story, mock, or setup patterns are excluded. Each entry has a confidence rank (high / medium / low) used when deduplicating multiple exports in the same file.

## Insights

Insights are architecture hints computed after the graph is built. They appear in:

- Terminal output when you pass `--insights`
- `graph.json` → `meta.insights` (always)
- The viewer insights badge and drawer

### Severity levels

| Severity    | Typical examples                                                     |
| ----------- | -------------------------------------------------------------------- |
| **error**   | Rules of Hooks violations, analyzing `node_modules`                  |
| **warning** | Component not PascalCase, hook not `use*` prefixed, missing tsconfig |
| **info**    | Orphan exports, component imported but not rendered                  |
| **tip**     | Large codebase warnings, type-only React imports                     |

### Criteria (current)

- **Missing tsconfig**:module resolution may be incomplete
- **Codebase size**:tips at 300+ and 800+ scanned files
- **Orphan exports**:exported symbol with no incoming edges and no outgoing edges
- **Import without render**:component imports another component but no JSX render edge detected
- **Naming**:components should be PascalCase; hooks should start with `use`
- **Type-only React imports**:positive tip for bundle-friendly imports
- **Rules of Hooks**:hooks called inside conditions, loops, nested functions, or after early returns

Insights reference optional `eslintRule` ids where applicable (e.g. `import/no-unused-modules`, `@eslint-react/rules-of-hooks`) for alignment with familiar lint tooling.

## Caching

Analyze stores parse metadata in `.arclens/cache.json` inside the target project. Use `--no-cache` to force a full re-parse after changing extractors or when debugging stale results.

Add `.arclens/` and `graph.json` to your project's `.gitignore` — both are generated locally and should not be committed. See [Getting started](/getting-started/#gitignore) for details.

## What is not analyzed

- Runtime behavior (effects, conditional renders at runtime)
- Dynamic imports without static path resolution
- Non-TypeScript/JavaScript sources
- General call graphs beyond hooks and JSX

Static analysis gives a **structural** map:always validate critical paths in the running app.
