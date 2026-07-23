import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  clampPanelRect,
  loadPanelRect,
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
  /** CSS selector for the drag handle region (defaults to sidebar header). */
  dragHandleSelector?: string;
};

const MIN_WIDTH = 220;
const MIN_HEIGHT = 180;

export function FloatingPanel({
  id,
  defaultRect,
  minWidth = MIN_WIDTH,
  minHeight = MIN_HEIGHT,
  className = "",
  children,
  dragHandleSelector = ".graph-sidebar__header",
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<PanelRect>(
    clampPanelRect(loadPanelRect(id) ?? defaultRect, {
      x: defaultRect.x,
      y: defaultRect.y,
      width: minWidth,
      height: minHeight,
    }),
  );
  const [rect, setRect] = useState(rectRef.current);
  const [interaction, setInteraction] = useState<"drag" | "resize" | null>(null);

  const persistRect = useCallback(
    (next: PanelRect) => {
      const clamped = clampPanelRect(next, {
        x: next.x,
        y: next.y,
        width: minWidth,
        height: minHeight,
      });
      rectRef.current = clamped;
      setRect(clamped);
      savePanelRect(id, clamped);
    },
    [id, minWidth, minHeight],
  );

  useEffect(() => {
    const onResize = () => {
      persistRect(rectRef.current);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [persistRect]);

  const onDragPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as Element;
      if (target.closest("button, input, textarea, a, select, [data-no-drag]")) {
        return;
      }

      const handle = panelRef.current?.querySelector(dragHandleSelector);
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
    [dragHandleSelector, persistRect],
  );

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
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
    [persistRect],
  );

  return (
    <div
      ref={panelRef}
      className={`floating-panel ${interaction ? `floating-panel--${interaction}` : ""} ${className}`.trim()}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
      onPointerDown={onDragPointerDown}
    >
      <div className="floating-panel__body">{children}</div>
      <div
        className="floating-panel__resize-handle"
        onPointerDown={onResizePointerDown}
        title="Resize panel"
        aria-hidden="true"
      />
    </div>
  );
}
