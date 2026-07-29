---
title: Large project walkthrough
description: How to navigate large, interconnected React codebases in the Arclens viewer without getting lost.
---

For a large, interconnected app, the graph is a **map**, not a poster. The goal is not to understand everything at once: it is to **land somewhere, see local context, and walk outward**.

## The mental model

Think in three layers:

| Layer | What you see | When to use it |
| ----- | ------------ | -------------- |
| **Folders** | Cluster bubbles by directory | Orientation: "where does this feature live?" |
| **Feature slice** | One expanded folder + neighbors | Understanding a module |
| **Node** | Single component/hook + details panel | "What does this file actually do?" |

## Recommended setup

Turn these on and leave them on for large projects (500+ nodes):

1. **Cluster folders** (on by default): `Shift+C` to toggle  
   Keeps the canvas at folder granularity until you deliberately drill in.

2. **Renders-only edges**: hide imports and uses in **Graph controls**  
   The render tree is how React composes UI. Import/use edges on a monolith look like spaghetti.

3. **Dim distant nodes**: `Shift+D`  
   When something is selected or spotlit, everything else fades. You get a local neighborhood instead of the whole maze.

4. **Tree down layout**: `Shift+L` to cycle  
   Reads top-to-bottom like a component hierarchy. Tree right works when tracing a horizontal flow.

5. **Focus on select**: leave enabled  
   Clicking something recenters you so you do not pan-hunt after every selection.

## Workflows

### I am new to this codebase

1. Open **Entry points** in the sidebar → click `main.tsx` / `layout.tsx`
2. Use **Show from entry** to highlight the bootstrap path
3. Scan **Top folders**: click the biggest one that sounds like your feature
4. Click the folder cluster on the canvas → expands incrementally (24 nodes at a time on large graphs)
5. Click a node → details panel shows connections, props, and source preview

### I am working on X: where does it plug in?

1. **Search** for the component or hook name
2. On large graphs this switches to **subgraph mode**: matches, their folder clusters, and nearby connections
3. Search **auto-reveals** matches inside collapsed folders and **highlights** the folder bubble
4. Enable **dim distant** if the subgraph is still busy
5. Check **Hubs**: shared dependencies many features touch (Button, Layout, API client, etc.)

### I changed this file: what breaks?

1. Search or click the node
2. Details panel → **incoming connections** (who imports, renders, or uses this)
3. Spotlight the node from **Hubs** or the entry list to keep focus while exploring

### I am completely lost

1. **Collapse all folders** (Graph controls)
2. `Shift+F`: fit the visible graph
3. Start over from search or a folder name you know
4. Or analyze a smaller scope: `pnpm arclens analyze ./src/features/loans`

## Shortcuts

| Shortcut | Action |
| -------- | ------ |
| `Ctrl/Cmd+K` | Command palette: jump to any node by name |
| `Shift+C` | Toggle cluster folders |
| `Shift+D` | Toggle dim distant / neighborhood focus |
| `Shift+L` | Cycle layout (tree down ↔ tree right) |
| `Shift+F` | Fit entire visible graph |
| `F` | Focus selected node |
| Click cluster | Expand folder (incremental on large graphs) |
| `Shift+click` cluster | Collapse folder |

## What not to do

- **Do not turn off clustering** on a 500+ node graph unless you are debugging layout itself
- **Do not show all edge types at once**: imports + renders + uses on a monolith is unreadable
- **Do not expect the full graph to be legible**: even dagre cannot make a dense app look like a 10-node demo
- **Do not use the graph as your only navigation**: pair it with search, the details panel, and your IDE

## Onboarding tip for teams

> Spend 10 minutes with **folders + entry points + search**. Pick one feature folder, expand it, click three nodes, read their incoming/outgoing connections. You will not know the whole app: you will know **one vertical slice**, which is enough to start contributing.

That matches the product goal: understand an unfamiliar app in under 10 minutes, not memorize every edge.

## Scope tip

If the full repo graph is too dense, analyze a subfolder:

```bash
pnpm arclens analyze ./src/features/onboarding
pnpm dev:viewer
```

You get a focused graph without the rest of the monolith competing for attention.
