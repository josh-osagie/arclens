# React Atlas Viewer

Interactive graph viewer for React Atlas analysis output.

## shadcn/ui

Add components from `viewer/`:

```bash
pnpm dlx shadcn@latest add <component>
```

## Command palette

Press **Cmd+K** (macOS) or **Ctrl+K** (Windows/Linux) to open the command palette:

- Jump to a node by name or file path
- Run graph actions (from entry, fit view, compact layout, cluster folders, dim distant nodes)
- Selection actions when a node is selected (focus, copy name, copy path)

## Mobile banner

On viewports ≤768px wide, a dismissible banner explains that React Atlas works best on desktop. Users can dismiss for the session or choose **Don't show again** (stored in `localStorage`).
