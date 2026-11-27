import { describe, expect, it } from "vitest";
import {
  popViewport,
  pushBreadcrumbItem,
  pushViewport,
  type CameraHistoryEntry,
} from "../../viewer/src/cameraHistory";

describe("cameraHistory", () => {
  it("pushes viewports with traversal trails and pops in LIFO order", () => {
    const overview: CameraHistoryEntry = {
      scopeKey: "overview",
      domain: null,
      trail: [],
      viewport: { x: 120, y: 48, zoom: 0.9 },
    };
    const app: CameraHistoryEntry = {
      scopeKey: "domain:src/app",
      domain: "src/app",
      trail: ["src/app"],
      viewport: { x: 40, y: 28, zoom: 0.82 },
    };

    let stack = pushViewport([], overview);
    stack = pushViewport(stack, app);
    expect(stack).toHaveLength(2);

    const firstPop = popViewport(stack);
    expect(firstPop.entry).toEqual(app);
    expect(firstPop.nextStack).toEqual([overview]);

    const secondPop = popViewport(firstPop.nextStack);
    expect(secondPop.entry).toEqual(overview);
    expect(secondPop.nextStack).toEqual([]);
  });

  it("replaces top entry when pushing the same scopeKey", () => {
    const initial: CameraHistoryEntry = {
      scopeKey: "overview",
      domain: null,
      viewport: { x: 100, y: 50, zoom: 0.85 },
    };
    const panned: CameraHistoryEntry = {
      scopeKey: "overview",
      domain: null,
      viewport: { x: 240, y: -12, zoom: 0.92 },
    };

    const stack = pushViewport([initial], panned);
    expect(stack).toEqual([panned]);
  });

  it("unwinds directly to an ancestor domain or overview", () => {
    const overview: CameraHistoryEntry = {
      scopeKey: "overview",
      domain: null,
      trail: [],
      viewport: { x: 112, y: 44, zoom: 0.91 },
    };
    const app: CameraHistoryEntry = {
      scopeKey: "domain:src/app",
      domain: "src/app",
      trail: ["src/app"],
      viewport: { x: 10, y: 20, zoom: 0.8 },
    };
    const ui: CameraHistoryEntry = {
      scopeKey: "domain:components/ui",
      domain: "components/ui",
      trail: ["src/app", "components/ui"],
      viewport: { x: 30, y: 25, zoom: 0.78 },
    };

    const stack = [overview, app, ui];
    const toApp = popViewport(stack, "domain:src/app");
    expect(toApp.entry).toEqual(app);
    expect(toApp.nextStack).toEqual([overview]);

    const toOverview = popViewport(stack, "overview");
    expect(toOverview.entry).toEqual(overview);
    expect(toOverview.nextStack).toEqual([]);
  });

  it("caps stack depth at maxDepth", () => {
    let stack: CameraHistoryEntry[] = [];
    for (let i = 0; i < 6; i++) {
      stack = pushViewport(
        stack,
        {
          scopeKey: `domain:${i}`,
          domain: `d${i}`,
          viewport: { x: i, y: i, zoom: 0.8 },
        },
        4
      );
    }
    expect(stack).toHaveLength(4);
    expect(stack[0]?.scopeKey).toBe("domain:2");
    expect(stack[3]?.scopeKey).toBe("domain:5");
  });

  it("moves duplicate scopeKey to the end when pushing the current breadcrumb item", () => {
    type Crumb = { scopeKey: string; label: string; isCurrent: boolean };
    const items: Crumb[] = [];
    const seen = new Set<string>();

    pushBreadcrumbItem(items, seen, {
      scopeKey: "overview",
      label: "Overview",
      isCurrent: false,
    });
    pushBreadcrumbItem(items, seen, {
      scopeKey: "area:features/auth",
      label: "Authentication",
      isCurrent: false,
    });
    pushBreadcrumbItem(items, seen, {
      scopeKey: "story:LoginForm",
      label: "LoginForm",
      isCurrent: false,
    });
    pushBreadcrumbItem(
      items,
      seen,
      {
        scopeKey: "area:features/auth",
        label: "Authentication",
        isCurrent: true,
      },
      { moveDuplicateToEnd: true }
    );

    expect(items).toEqual([
      { scopeKey: "overview", label: "Overview", isCurrent: false },
      { scopeKey: "story:LoginForm", label: "LoginForm", isCurrent: false },
      {
        scopeKey: "area:features/auth",
        label: "Authentication",
        isCurrent: true,
      },
    ]);
  });
});
