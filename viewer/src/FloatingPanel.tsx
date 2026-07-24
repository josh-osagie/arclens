import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  clampPanelRect,
  loadPanelMinimized,
  loadPanelRect,
  savePanelMinimized,
  savePanelRect,
  type PanelRect,
} from "./panelStorage";

type Props = {
  id: string;
  defaultRect: PanelRect;
  minWidth?: number;
  minHeight?: number;
  className?: string;
  children: ReactNode;
  /** Label shown on the minimized header chip. */
  minimizedLabel?: string;
  /** CSS selector for the drag handle region (defaults to sidebar header). */
  dragHandleSelector?: string;
};

const MIN_WIDTH = 220;
const MIN_HEIGHT = 180;
const MINIMIZED_HEIGHT = 42;
const MINIMIZED_MIN_WIDTH = 220;

type FloatingPanelContextValue = {
  minimizedLabel: string;
  toggleMinimize: () => void;
};

const FloatingPanelContext = createContext<FloatingPanelContextValue | null>(null);

function MinimizeIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M3.5 12h9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M4.5 11.5V8.5h3M11.5 4.5H8.5v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 7.5 11.5 4.5M4.5 11.5 7.5 8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PanelMinimizeButton() {
  const ctx = useContext(FloatingPanelContext);
  if (!ctx) return null;

  return (
    <button
      type="button"
      className="graph-sidebar__toolbar-btn floating-panel__minimize"
      aria-label={`Minimize ${ctx.minimizedLabel}`}
      onClick={ctx.toggleMinimize}
    >
      <MinimizeIcon />
    </button>
  );
}

function buildInitialRect(
  id: string,
  defaultRect: PanelRect,
  minWidth: number,
  minHeight: number,
): { rect: PanelRect; expandedRect: PanelRect | null; minimized: boolean } {
  const minimized = loadPanelMinimized(id);
  const stored = loadPanelRect(id) ?? defaultRect;
  const expanded = clampPanelRect(stored, {
    x: defaultRect.x,
    y: defaultRect.y,
    width: minWidth,
    height: minHeight,
  });

  if (!minimized) {
    return { rect: expanded, expandedRect: null, minimized: false };
  }

  return {
    rect: { ...expanded, height: MINIMIZED_HEIGHT },
    expandedRect: expanded,
    minimized: true,
  };
}

export function FloatingPanel({
  id,
  defaultRect,
  minWidth = MIN_WIDTH,
  minHeight = MIN_HEIGHT,
  className = "",
  children,
  minimizedLabel = "Panel",
  dragHandleSelector = ".graph-sidebar__header",
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const initial = buildInitialRect(id, defaultRect, minWidth, minHeight);
  const rectRef = useRef<PanelRect>(initial.rect);
  const expandedRectRef = useRef<PanelRect | null>(initial.expandedRect);
  const [rect, setRect] = useState(rectRef.current);
  const [minimized, setMinimized] = useState(initial.minimized);
  const [interaction, setInteraction] = useState<"drag" | "resize" | null>(null);

  const persistRect = useCallback(
    (next: PanelRect) => {
      const effectiveMinHeight = minimized ? MINIMIZED_HEIGHT : minHeight;
      const clamped = clampPanelRect(next, {
        x: next.x,
        y: next.y,
        width: minWidth,
        height: effectiveMinHeight,
      });
      const resolved = minimized ? { ...clamped, height: MINIMIZED_HEIGHT } : clamped;
      rectRef.current = resolved;
      setRect(resolved);
      if (!minimized) {
        savePanelRect(id, resolved);
      }
    },
    [id, minWidth, minHeight, minimized],
  );

  useEffect(() => {
    const onResize = () => {
      if (minimized) return;
      persistRect(rectRef.current);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [minimized, persistRect]);

  const toggleMinimize = useCallback(() => {
    if (minimized) {
      const restored = expandedRectRef.current ?? rectRef.current;
      expandedRectRef.current = null;
      setMinimized(false);
      savePanelMinimized(id, false);
      persistRect(restored);
      return;
    }

    expandedRectRef.current = rectRef.current;
    setMinimized(true);
    savePanelMinimized(id, true);
    const chipRect = {
      ...rectRef.current,
      width: Math.max(rectRef.current.width, MINIMIZED_MIN_WIDTH),
      height: MINIMIZED_HEIGHT,
    };
    rectRef.current = chipRect;
    setRect(chipRect);
  }, [id, minimized, persistRect]);

  const onDragPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as Element;
      if (target.closest("button, input, textarea, a, select, [data-no-drag]")) {
        return;
      }

      const handleSelector = minimized
        ? ".floating-panel__chip"
        : dragHandleSelector;
      const handle = panelRef.current?.querySelector(handleSelector);
      if (!handle?.contains(target)) return;

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);

      const startX = event.clientX;
      const startY = event.clientY;
      const origin = rectRef.current;
      setInteraction("drag");

      const onMove = (moveEvent: PointerEvent) => {
        persistRect({
          ...origin,
          x: origin.x + (moveEvent.clientX - startX),
          y: origin.y + (moveEvent.clientY - startY),
        });
      };

      const onUp = () => {
        setInteraction(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [dragHandleSelector, minimized, persistRect],
  );

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (minimized) return;

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);

      const startX = event.clientX;
      const startY = event.clientY;
      const origin = rectRef.current;
      setInteraction("resize");

      const onMove = (moveEvent: PointerEvent) => {
        persistRect({
          ...origin,
          width: origin.width + (moveEvent.clientX - startX),
          height: origin.height + (moveEvent.clientY - startY),
        });
      };

      const onUp = () => {
        setInteraction(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [minimized, persistRect],
  );

  const panelContext = useMemo(
    () => ({ minimizedLabel, toggleMinimize }),
    [minimizedLabel, toggleMinimize],
  );

  return (
    <FloatingPanelContext.Provider value={panelContext}>
      <div
        ref={panelRef}
        className={`floating-panel ${minimized ? "floating-panel--minimized" : ""} ${interaction ? `floating-panel--${interaction}` : ""} ${className}`.trim()}
        style={{
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
        }}
        onPointerDown={onDragPointerDown}
      >
        {minimized ? (
          <div className="floating-panel__chip" title={minimizedLabel}>
            <span className="floating-panel__chip-grip" aria-hidden="true">
              ⋮⋮
            </span>
            <span className="floating-panel__chip-label">{minimizedLabel}</span>
            <button
              type="button"
              className="floating-panel__chip-restore"
              aria-label={`Restore ${minimizedLabel}`}
              title="Restore panel"
              onClick={toggleMinimize}
            >
              <RestoreIcon />
              <span className="floating-panel__chip-restore-text">Restore</span>
            </button>
          </div>
        ) : (
          <>
            <div className="floating-panel__body">{children}</div>
            <div
              className="floating-panel__resize-handle"
              onPointerDown={onResizePointerDown}
              title="Resize panel"
              aria-hidden="true"
            />
          </>
        )}
      </div>
    </FloatingPanelContext.Provider>
  );
}
