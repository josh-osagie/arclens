# Arclens Roadmap

## Phase 1 - Foundations

Milestones

- [x] Parse a single TS file
- [x] Read import declarations
- [x] Read exports
- [x] Understand AST traversal

---

## Phase 2 - Static Analysis Engine

Goal: Extract architecture from code.

Milestones

- [x] Detect React components
- [x] Detect hooks
- [x] Detect contexts
- [x] Detect services
- [x] Detect utilities

---

## Phase 3 - Relationships

Goal: Connect code together.

Milestones

- [x] Imports
- [x] Uses (hook calls)
- [x] Renders (JSX)
- [x] Calls (general function call graph)
- [x] Exports

---

## Phase 4 - Graph Engine

Goal: Generate graph data.

Milestones

- [x] Build nodes
- [x] Build edges
- [x] Export JSON (slim export + pre-layout)

---

## Phase 5 - Visualization

Goal: Explore architecture.

Milestones

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

---

## Phase 6 - Intelligence

Goal: Generate engineering insights.

Milestones

- [ ] Circular dependency detection
- [x] Orphan detection
- [ ] Highly coupled modules
- [ ] Largest components
- [x] Most imported / referenced modules (report + top connections)
- [x] Rules of Hooks violations
- [x] Component / hook naming hints

---

## Phase 7 - Advanced

- [ ] Monorepo support
- [ ] Git integration
- [ ] AI explanations
- [ ] Impact analysis (`--focus` is a start; full impact UI pending)
- [ ] Architecture scoring
- [ ] Prop-flow edges (who passes what to whom)
- [ ] Incremental analyze / watch perf
