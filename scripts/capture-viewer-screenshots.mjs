/**
 * Capture React Atlas viewer screenshots for docs.
 * Usage:
 *   pnpm add -D playwright   # one-time
 *   pnpm dev:viewer            # in another terminal
 *   node scripts/capture-viewer-screenshots.mjs
 * Requires viewer running at VIEWER_URL (default http://localhost:5173).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs/public/images/viewer");
const VIEWER_URL = process.env.VIEWER_URL ?? "http://localhost:5173";

async function waitForGraph(page) {
  await page.goto(VIEWER_URL, { waitUntil: "networkidle" });
  await page.waitForSelector(".react-flow", { timeout: 30_000 });
  await page.waitForTimeout(800);
}

async function capture(page, name, clipOrOptions = {}) {
  const filePath = path.join(OUT_DIR, name);
  await page.screenshot({ path: filePath, type: "png", ...clipOrOptions });
  console.log(`Saved ${name}`);
}

async function captureSamplesGraph(page) {
  await waitForGraph(page);

  await capture(page, "graph-overview.png", { fullPage: false });

  const sidebar = page.locator(".graph-sidebar--main").first();
  await sidebar.waitFor({ state: "visible" });
  await capture(page, "sidebar-search.png", {
    clip: await sidebar.boundingBox(),
  });

  const badge = page.locator(".insights-badge__pill");
  await badge.waitFor({ state: "visible" });
  const badgeBox = await page.locator(".insights-badge").boundingBox();
  if (badgeBox) {
    await capture(page, "insights-badge.png", {
      clip: {
        x: Math.max(0, badgeBox.x - 12),
        y: Math.max(0, badgeBox.y - 12),
        width: Math.min(420, badgeBox.width + 24),
        height: badgeBox.height + 24,
      },
    });
  }

  const node = page.locator(".react-flow__node").first();
  await node.click();
  await page.waitForTimeout(600);

  const details = page.locator(".graph-sidebar--details").first();
  await details.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForSelector("text=Source preview", { timeout: 10_000 });
  await page.waitForTimeout(400);

  await capture(page, "node-details-snippet.png", {
    clip: await details.boundingBox(),
  });
}

async function captureLendhaFolderOverview(page) {
  await waitForGraph(page);

  const foldersSection = page.locator(".overview-shortcuts").first();
  await foldersSection.waitFor({ state: "visible", timeout: 15_000 });
  const sidebar = page.locator(".graph-sidebar--main").first();
  const sidebarBox = await sidebar.boundingBox();
  if (sidebarBox) {
    await capture(page, "folder-overview.png", {
      clip: {
        x: sidebarBox.x,
        y: sidebarBox.y,
        width: sidebarBox.width,
        height: Math.min(sidebarBox.height, 520),
      },
    });
  }
}

async function captureEmptyState(page) {
  await page.goto(VIEWER_URL, { waitUntil: "networkidle" });
  await page.waitForSelector(".graph-shell--empty", { timeout: 15_000 });
  await page.waitForTimeout(400);
  await capture(page, "empty-graph.png", { fullPage: false });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  try {
    console.log("Capturing samples graph screenshots...");
    await captureSamplesGraph(page);

    const graphBackup = path.join(ROOT, "graph.json.bak");
    if (fs.existsSync(graphBackup)) {
      console.log("Restoring lendha graph for folder overview...");
      fs.copyFileSync(graphBackup, path.join(ROOT, "graph.json"));
      await page.waitForTimeout(2500);
      await captureLendhaFolderOverview(page);
    }

    console.log("Capturing empty graph state...");
    const graphPath = path.join(ROOT, "graph.json");
    const graphHold = path.join(ROOT, "graph.json.hold");
    fs.renameSync(graphPath, graphHold);
    try {
      await page.waitForTimeout(2500);
      await captureEmptyState(page);
    } finally {
      fs.renameSync(graphHold, graphPath);
    }

    console.log("Restoring samples graph.json for dev...");
    if (fs.existsSync(graphBackup)) {
      // Keep samples as default after docs capture (was analyzed for docs)
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
