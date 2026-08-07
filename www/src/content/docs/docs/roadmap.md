---
title: Roadmap
description: Planned and completed milestones for Arclens.
---

Arclens development is organized in phases. This page summarizes progress from `roadmap.md` at the repository root.

## Phase 1: Foundations

- [x] Parse a single TS file
- [x] Read import declarations
- [x] Read exports
- [x] Understand AST traversal

## Phase 2: Static analysis engine

Goal: extract architecture from code.

- [x] Detect React components
- [x] Detect hooks
- [x] Detect contexts
- [ ] Detect services
- [x] Detect utilities

## Phase 3: Relationships

Goal: connect code together.

- [x] Imports
- [x] Uses (hook calls)
- [x] Renders (JSX)
- [ ] Calls (general function call graph)
- [x] Exports

## Phase 4: Graph engine

Goal: generate graph data.

- [x] Build nodes
- [x] Build edges
- [x] Export JSON (slim export + pre-layout)

## Phase 5: Visualization

Goal: explore architecture.

- [x] React Flow viewer
- [x] Dagre / grid layout (CLI pre-layout + viewer fallback)
- [x] Search (subgraph mode for large graphs)
- [x] Node details panel
- [x] Highlight dependencies (selection dimming + path from entry)
- [x] Folder / module clustering
- [x] Fit / focus on selected node
- [x] Save & restore viewport
- [x] CLI insights in sidebar
- [x] Entry-point shortcut (“From entry”)
- [x] Helper lines when dragging nodes
- [x] Node toolbar (focus, copy name, copy path)
- [x] Draggable / resizable floating panels
- [x] Component props in details panel

## Phase 6: Intelligence

Goal: generate engineering insights.

- [ ] Circular dependency detection
- [x] Orphan detection
- [ ] Highly coupled modules
- [ ] Largest components
- [x] Most imported / referenced modules (report + top connections)
- [x] Rules of Hooks violations
- [x] Component / hook naming hints

## Phase 7: Advanced

- [ ] Monorepo support
- [ ] Git integration
- [ ] AI explanations
- [ ] Impact analysis (`--focus` is a start; full impact UI pending)
- [ ] Architecture scoring
- [ ] Prop-flow edges (who passes what to whom)
- [ ] Incremental analyze / watch perf

## Near-term focus

Based on open roadmap items, likely next investments include:

1. **Service detection** and richer module typing
2. **Circular dependency** and coupling insights
3. **npm publish** workflow (`arclens analyze` + bundled `view` command)
4. **Watch performance** for incremental re-analysis

Contributions welcome, see `CONTRIBUTING.md` in the repo root.
