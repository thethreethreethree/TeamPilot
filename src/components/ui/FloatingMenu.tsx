"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * FloatingMenu — portaled, viewport-aware dropdown shell.
 *
 * Solves the same family of bugs we hit on LearningHint:
 *  - dropdown clipped by an overflow:hidden / overflow-y-auto parent
 *  - dropdown overflows the viewport because the requested anchor
 *    point doesn't fit
 *  - missing click-outside / Escape dismissal
 *  - missing repositioning on scroll or resize
 *
 * Per AMD-006 §1.5.1 L3 (composition): every dropdown in the app
 * lives INSIDE a scroll container (header bars, sidebars, panels).
 * Anchoring with `absolute` and trusting the parent to give the menu
 * room to render is incidental success, not structural. The portal
 * makes the structural guarantee.
 *
 * Usage
 * ─────
 *   const [open, setOpen] = useState(false);
 *   const triggerRef = useRef<HTMLButtonElement | null>(null);
 *
 *   <button ref={triggerRef} onClick={() => setOpen(v => !v)}>...</button>
 *   <FloatingMenu
 *     open={open}
 *     anchorRef={triggerRef}
 *     placement="bottom-end"
 *     onClose={() => setOpen(false)}
 *   >
 *     ...menu items...
 *   </FloatingMenu>
 *
 * Placement values
 * ────────────────
 *  - bottom-start / bottom-end / bottom-stretch: menu below trigger,
 *    aligned left / right / full-width
 *  - top-start / top-end: menu above trigger
 *
 * The component will flip vertically (bottom→top) when the requested
 * placement doesn't fit in the viewport.
 */

type Placement =
  | "bottom-start"
  | "bottom-end"
  | "bottom-stretch"
  | "top-start"
  | "top-end";

const GAP = 6;
const VIEWPORT_PADDING = 8;

function compute(
  triggerRect: DOMRect,
  preferred: Placement,
  menuWidth: number,
  menuHeight: number,
): { left: number; top: number; width?: number; placement: Placement } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spaceBelow = vh - triggerRect.bottom - GAP;
  const spaceAbove = triggerRect.top - GAP;

  // Vertical placement: flip if not enough room below for the
  // requested "bottom-*" placement.
  let vertical: "top" | "bottom" = preferred.startsWith("top")
    ? "top"
    : "bottom";
  if (vertical === "bottom" && spaceBelow < menuHeight && spaceAbove > spaceBelow) {
    vertical = "top";
  } else if (
    vertical === "top" &&
    spaceAbove < menuHeight &&
    spaceBelow > spaceAbove
  ) {
    vertical = "bottom";
  }

  const top =
    vertical === "bottom"
      ? triggerRect.bottom + GAP
      : Math.max(VIEWPORT_PADDING, triggerRect.top - menuHeight - GAP);

  // Horizontal placement
  let left: number;
  let width: number | undefined;
  if (preferred.endsWith("stretch")) {
    left = triggerRect.left;
    width = triggerRect.width;
  } else if (preferred.endsWith("end")) {
    left = triggerRect.right - menuWidth;
  } else {
    left = triggerRect.left;
  }

  // Clamp to viewport horizontally
  if (width === undefined) {
    left = Math.max(
      VIEWPORT_PADDING,
      Math.min(left, vw - menuWidth - VIEWPORT_PADDING),
    );
  } else {
    if (left + width > vw - VIEWPORT_PADDING) {
      left = Math.max(VIEWPORT_PADDING, vw - width - VIEWPORT_PADDING);
    }
    if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING;
  }

  const placement: Placement =
    vertical === "bottom"
      ? preferred.endsWith("end")
        ? "bottom-end"
        : preferred.endsWith("stretch")
          ? "bottom-stretch"
          : "bottom-start"
      : preferred.endsWith("end")
        ? "top-end"
        : "top-start";

  return { left, top, width, placement };
}

export function FloatingMenu({
  open,
  anchorRef,
  placement = "bottom-start",
  onClose,
  className = "",
  children,
  zIndex = 50,
  minWidth,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  placement?: Placement;
  onClose: () => void;
  className?: string;
  children: ReactNode;
  zIndex?: number;
  minWidth?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    width?: number;
    placement: Placement;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Recompute position when opening, resizing, scrolling.
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPos(null);
      return;
    }
    const update = () => {
      if (!anchorRef.current) return;
      const triggerRect = anchorRef.current.getBoundingClientRect();
      // Use measured menu dimensions if rendered, otherwise estimate
      // from minWidth / sensible defaults. The estimate doesn't have
      // to be exact — clamping handles the slop.
      const mRect = menuRef.current?.getBoundingClientRect();
      const w = mRect?.width ?? minWidth ?? 200;
      const h = mRect?.height ?? 240;
      setPos(compute(triggerRect, placement, w, h));
    };
    update();
    // Re-measure after the menu paints — the first paint uses the
    // estimate; the second uses the real dimensions.
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, placement, anchorRef, minWidth]);

  // Click outside / Escape to close.
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !mounted || !pos) return null;

  return createPortal(
    <div
      ref={menuRef}
      data-placement={pos.placement}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        width: pos.width,
        minWidth,
        zIndex,
      }}
      className={className}
    >
      {children}
    </div>,
    document.body,
  );
}

/** Helper for components that prefer ref+open in a single hook. */
export function useFloatingMenu() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  return { open, setOpen, close, toggle };
}
