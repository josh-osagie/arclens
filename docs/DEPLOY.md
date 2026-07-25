# Deploying Arclens to Vercel

This guide covers hosting the **marketing landing page** and **documentation** on Vercel without a custom domain. The CLI stays on npm; the graph viewer stays local (`arclens view`).

## Architecture (recommended)

Use **one Vercel project** with the **Root Directory** set to `docs/`.

| Surface | Where it lives | URL |
| -------- | -------------- | --- |
| Landing + docs | Astro Starlight site in `docs/` | `https://arclens.vercel.app/` |
| Documentation pages | Same site (Starlight routes) | `https://arclens.vercel.app/getting-started/`, etc. |
| CLI | npm | `https://www.npmjs.com/package/arclens` |
| Viewer | Local only after `arclens analyze` | `http://127.0.0.1:5173` via `arclens view` |

### Why one project?

- Starlight already uses a **splash template** at `/` for the landing page and serves docs under paths like `/introduction/`.
- One deploy, one URL, no cross-origin setup.
- Indie-friendly: free tier, zero DNS, no `arclens.com` required.

### Why not two projects?

Splitting `arclens.vercel.app` (landing) and `arclens-docs.vercel.app` (docs) adds duplicate config, two preview URLs, and no real benefit while the landing page is part of the docs site.

### What not to deploy

| Do not host | Reason |
| ----------- | ------ |
| **Viewer** (`viewer/`) | Binds to `127.0.0.1`, serves the user’s local `graph.json` and source snippets from their machine. See `src/viewServer.ts`. |
| **CLI** (`src/`, npm package) | Published via `npm publish`; users run `npx arclens`. |
| **Sample graphs** | Optional; not needed for marketing. |

## Prerequisites

- GitHub repo: [JCalmCrasher/arclens](https://github.com/JCalmCrasher/arclens)
- [Vercel account](https://vercel.com) linked to GitHub
- [pnpm](https://pnpm.io/) locally (optional, for preview builds)

## Vercel project setup

### 1. Import the repository

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import **JCalmCrasher/arclens** (or your fork).
3. When asked for settings, open **Root Directory** → **Edit** → select **`docs`**.

### 2. Build settings

Vercel should auto-detect Astro. Confirm these values (also defined in `docs/vercel.json`):

| Setting | Value |
| ------- | ----- |
| Framework Preset | Astro |
| Root Directory | `docs` |
| Install Command | `pnpm install` |
| Build Command | `pnpm build` |
| Output Directory | `dist` |

If pnpm is not detected, set **Install Command** to `pnpm install` explicitly.

### 3. Deploy

Click **Deploy**. First build runs `astro build` and outputs static files to `docs/dist/`.

Your site will be available at:

```text
https://<project-name>.vercel.app/
```

Name the project **`arclens`** for `https://arclens.vercel.app/`.

### 4. Site URL (optional env)

Nav links use relative paths (`/getting-started/`) — no env needed for those.

For sitemap/OG canonical URLs, set **`SITE_URL`** in Vercel → Settings → Environment Variables (Production):

```text
SITE_URL=https://arclens.vercel.app
```

Preview deploys use Vercel’s `VERCEL_URL` automatically. See `docs/.env.example` for local dev.

### 5. Optional: point npm homepage

In the root `package.json`, you can set:

```json
"homepage": "https://arclens.vercel.app"
```

Republish to npm when you want the registry link to match.

## Local preview (before deploy)

From the repo root:

```bash
pnpm install
pnpm build:docs
pnpm --dir docs preview
```

Or from `docs/`:

```bash
cd docs
pnpm install
pnpm build
pnpm preview
```

Open the URL printed (usually `http://localhost:4321`).

## Continuous deployment

Every push to your production branch (usually `main`) triggers a new deploy when the Vercel Git integration is enabled. Pull requests get preview URLs automatically.

## Troubleshooting

| Issue | Fix |
| ----- | --- |
| Build fails: `sharp` | Normal on Vercel; Astro installs platform binaries. Re-run deploy. |
| 404 on doc routes | Ensure Root Directory is `docs`, not repo root. |
| Wrong styling on `/` | Clear cache and redeploy; splash page uses Starlight `template: splash`. |
| Logo missing | Ensure `docs/src/assets/arclens-logo.svg` exists (or copy `assets/arclens-logo.png` from the repo root). |
| Port 4321 in use / "Another astro dev server is already running" | Open [http://localhost:4321](http://localhost:4321) if the site is already up, or run `pnpm --dir docs exec astro dev stop`. `pnpm dev:docs` uses `astro dev --force` to replace a stale server on restart. |

## URL cheat sheet (no custom domain)

| Purpose | Suggested URL |
| ------- | ------------- |
| Landing + docs (recommended) | `https://arclens.vercel.app` |
| npm package | `https://www.npmjs.com/package/arclens` |
| GitHub | `https://github.com/JCalmCrasher/arclens` |
| Local viewer | `http://127.0.0.1:5173` after `npx arclens view` |

Avoid expecting `doc.arclens.vercel.app` unless you create a separate Vercel project named `doc-arclens` — Vercel subdomains follow **project name**, not arbitrary nested hostnames.
