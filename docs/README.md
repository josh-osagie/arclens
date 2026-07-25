# Arclens docs site

Astro + [Starlight](https://starlight.astro.build/) site: marketing splash at `/` and documentation under `/introduction/`, `/getting-started/`, etc.

## Commands

Run from `docs/` (or `pnpm dev:docs` / `pnpm build:docs` from the repo root):

| Command | Action |
| ------- | ------ |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Dev server at `http://localhost:4321` (uses `--force` to replace a stale server) |
| `pnpm build` | Production build to `./dist/` |
| `pnpm preview` | Preview the production build |

## Port already in use?

If `pnpm dev` reports another Astro dev server on port 4321, either open [http://localhost:4321](http://localhost:4321) (the site may already be running) or stop it:

```bash
pnpm exec astro dev stop
```

From the repo root: `pnpm --dir docs exec astro dev stop`.

## Deploy

See [DEPLOY.md](./DEPLOY.md) for Vercel setup (Root Directory: `docs`, no custom domain required).
