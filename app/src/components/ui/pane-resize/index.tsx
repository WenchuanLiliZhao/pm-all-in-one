/**
 * Drag a vertical seam to set a pane's width. Width is machine-local.
 *
 * `edge="end"` — pane sits on the left; dragging right grows it.
 * `edge="start"` — pane sits on the right; dragging left grows it.
 * Double-click or Enter restores the layout-token default.
 *
 * ↔ use-pane-width.ts — persisted width
 * ↔ pane-width.ts — storage + token bounds
 * ↔ src/global-styles/layout.scss
 */
import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import styles from "./styles.module.scss";
import type { PaneWidthController } from "./use-pane-width";

const HIT_PX = 8;
const KEY_STEP_PX = 16;
/** Leave this much of the parent for the sibling column while dragging. */
const PARENT_RESERVE_PX = 200;

type PaneResizeHandleProps = {
  pane: PaneWidthController;
  edge: "start" | "end";
  label: string;
  /** Seam offset from the parent's left (`end`) or right (`start`), in px. */
  offset?: number;
  /**
   * `inside-end` keeps the hit target inside a clipping pane (table header).
   * Drag math still uses `edge`.
   */
  contain?: "inside-end";
  /** Cap the drag at the parent width minus a sibling reserve. */
  limitToParent?: boolean;
  style?: CSSProperties;
  className?: string;
};

function dragCeiling(
  el: HTMLElement,
  min: number,
  max: number,
  limitToParent: boolean,
): number {
  if (!limitToParent) {
    return max;
  }
  const parent = el.parentElement;
  if (!parent) {
    return max;
  }
  const room = parent.clientWidth - PARENT_RESERVE_PX;
  if (!Number.isFinite(room)) {
    return max;
  }
  return Math.min(max, Math.max(min, room));
}

export function PaneResizeHandle({
  pane,
  edge,
  label,
  offset = 0,
  contain,
  limitToParent = true,
  style,
  className,
}: PaneResizeHandleProps) {
  const dragRef = useRef<{
    startX: number;
    startWidth: number;
    ceiling: number;
    pointerId: number;
    target: HTMLButtonElement;
    onKey: (event: KeyboardEvent) => void;
  } | null>(null);
  const [active, setActive] = useState(false);
  const setWidthRef = useRef(pane.setWidth);
  const persistRef = useRef(pane.persist);
  setWidthRef.current = pane.setWidth;
  persistRef.current = pane.persist;

  const endDrag = useCallback((commit: boolean) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    dragRef.current = null;
    document.removeEventListener("keydown", drag.onKey);
    setActive(false);
    document.documentElement.removeAttribute("data-pane-resizing");
    if (drag.target.hasPointerCapture(drag.pointerId)) {
      drag.target.releasePointerCapture(drag.pointerId);
    }
    if (commit) {
      persistRef.current();
    }
  }, []);

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    const startWidth = pane.width;
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== "Escape" || !dragRef.current) {
        return;
      }
      keyEvent.preventDefault();
      setWidthRef.current(dragRef.current.startWidth);
      endDrag(true);
    };
    dragRef.current = {
      startX: event.clientX,
      startWidth,
      ceiling: dragCeiling(
        event.currentTarget,
        pane.min,
        pane.max,
        limitToParent,
      ),
      pointerId: event.pointerId,
      target: event.currentTarget,
      onKey,
    };
    setActive(true);
    document.documentElement.setAttribute("data-pane-resizing", "");
    document.addEventListener("keydown", onKey);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is unavailable for a synthetic event; move/up still hit the handle.
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    const delta = event.clientX - drag.startX;
    const next = edge === "end" ? drag.startWidth + delta : drag.startWidth - delta;
    setWidthRef.current(Math.min(drag.ceiling, next));
  }

  function onPointerUp() {
    endDrag(true);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return;
    }
    const step = event.shiftKey ? KEY_STEP_PX * 2 : KEY_STEP_PX;
    const ceiling = dragCeiling(
      event.currentTarget,
      pane.min,
      pane.max,
      limitToParent,
    );
    let next: number | null = null;
    if (event.key === "ArrowRight") {
      next = edge === "end" ? pane.width + step : pane.width - step;
    } else if (event.key === "ArrowLeft") {
      next = edge === "end" ? pane.width - step : pane.width + step;
    } else if (event.key === "Home") {
      next = pane.min;
    } else if (event.key === "End") {
      next = ceiling;
    } else if (event.key === "Enter") {
      event.preventDefault();
      pane.reset();
      return;
    } else {
      return;
    }
    event.preventDefault();
    pane.setWidth(Math.min(ceiling, next));
    pane.persist();
  }

  const placement: CSSProperties =
    contain === "inside-end"
      ? { right: 0, width: HIT_PX }
      : edge === "end"
        ? { left: offset, width: HIT_PX, transform: "translateX(-50%)" }
        : { right: offset, width: HIT_PX, transform: "translateX(50%)" };

  const classNames = [
    styles.handle,
    contain === "inside-end" ? styles.containEnd : "",
    active ? styles.handleActive : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={pane.min}
      aria-valuemax={pane.max}
      aria-valuenow={pane.width}
      title="Drag to resize. Double-click to reset."
      className={classNames}
      style={{ ...placement, zIndex: 5, ...style }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={() => endDrag(true)}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        pane.reset();
      }}
      onKeyDown={onKeyDown}
    />
  );
}
