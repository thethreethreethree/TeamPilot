"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LearningBulb } from "./LearningBulb";
import { useLearningMode } from "./LearningModeProvider";

/**
 * Floating brand-mark FAB. Visible bottom-right (initially) only when:
 *   - Learning Mode preference is enabled, AND
 *   - the resolved theme is dark.
 *
 * Per founder direction 2026-06-18 — the FAB is DRAGGABLE. The user
 * places it wherever they prefer on the viewport; the position
 * persists across page navigations and sessions on the same device.
 * Some users want it bottom-right (default), some bottom-left, some
 * tucked away top-right next to other chrome.
 *
 * Position storage: localStorage. Per-browser persistence is the
 * right scope for a FAB position — cross-device sync would be
 * overkill, and a profile-level API call on every drag would be
 * expensive and racy.
 *
 * Drag-vs-click discipline: a click (no movement) toggles the
 * lightbulb on/off. A drag (movement > 4px) repositions the FAB
 * without toggling. The FAB tracks `movedSinceMouseDown` and
 * suppresses the toggle if the user actually dragged.
 *
 * The lightbulb IS the ELOSTATE brand mark. The metaphor is
 * literal: a bulb on a dark surface is illumination + guidance +
 * the moment the idea lights up.
 */

// v2 (2026-06-19) — defaults now stack ABOVE the C.A.R.E chat
// widget bubble so the two don't collide. v1 stored a bottom-right
// position which sat directly behind the chat widget at z-[55] for
// tenants with the widget enabled. The founder had reported this
// earlier as "behind the chat", we misdiagnosed it as a minimized
// tab — wrong. Bumping the key forces existing users to re-default.
const STORAGE_KEY = "elostate.learning_fab.position.v2";
const FAB_SIZE = 56; // matches w-14 h-14
const EDGE_PADDING = 16;
const DRAG_THRESHOLD_PX = 4;
// Height of the C.A.R.E chat widget bubble + breathing room. The
// FAB stacks above it by this amount so both surfaces are reachable
// without the user having to move either one.
const CHAT_WIDGET_STACK_OFFSET = 72;

type Position = { x: number; y: number };

function loadStoredPosition(): Position | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.x === "number" &&
      typeof parsed.y === "number"
    ) {
      return parsed as Position;
    }
  } catch {
    /* corrupted; ignore */
  }
  return null;
}

function storePosition(pos: Position): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    /* quota / private-mode fail; the FAB will just reset on next load */
  }
}

function defaultPosition(): Position {
  if (typeof window === "undefined") return { x: 100, y: 100 };
  return {
    x: window.innerWidth - FAB_SIZE - EDGE_PADDING - 4,
    // Stack the FAB ABOVE the C.A.R.E chat widget bubble so it's
    // never hidden behind it. The user can drag to bottom-right
    // explicitly if they want the FAB to occlude the chat bubble.
    y:
      window.innerHeight -
      FAB_SIZE -
      EDGE_PADDING -
      4 -
      CHAT_WIDGET_STACK_OFFSET,
  };
}

function clampToViewport(pos: Position): Position {
  if (typeof window === "undefined") return pos;
  const maxX = window.innerWidth - FAB_SIZE - EDGE_PADDING;
  const maxY = window.innerHeight - FAB_SIZE - EDGE_PADDING;
  return {
    x: Math.max(EDGE_PADDING, Math.min(maxX, pos.x)),
    y: Math.max(EDGE_PADDING, Math.min(maxY, pos.y)),
  };
}

export function LearningModeFab() {
  const { enabled, active, isDark, setActive } = useLearningMode();
  const [position, setPosition] = useState<Position>({ x: -9999, y: -9999 });
  const [mounted, setMounted] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);

  // Initial position: stored value if any, otherwise default
  // bottom-right. Done in useEffect because we need window.
  useEffect(() => {
    const stored = loadStoredPosition();
    const initial = clampToViewport(stored ?? defaultPosition());
    setPosition(initial);
    setMounted(true);
  }, []);

  // Re-clamp on window resize so the FAB never strands off-screen
  // after the viewport shrinks (mobile rotate, window resize, etc).
  useEffect(() => {
    if (!mounted) return;
    const onResize = () => {
      setPosition((prev) => {
        const clamped = clampToViewport(prev);
        if (clamped.x !== prev.x || clamped.y !== prev.y) {
          storePosition(clamped);
        }
        return clamped;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mounted]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      // Capture so the move/up events keep landing on this element
      // even if the cursor leaves the FAB during the drag.
      (e.target as Element).setPointerCapture?.(e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        offsetX: e.clientX - position.x,
        offsetY: e.clientY - position.y,
        moved: false,
      };
    },
    [position]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const nextX = e.clientX - d.offsetX;
      const nextY = e.clientY - d.offsetY;
      // Determine if we've crossed the drag threshold — once we
      // have, this gesture is a drag (not a click) for the rest of
      // its lifetime.
      if (!d.moved) {
        const dx = Math.abs(nextX - position.x);
        const dy = Math.abs(nextY - position.y);
        if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) {
          d.moved = true;
        }
      }
      if (d.moved) {
        const clamped = clampToViewport({ x: nextX, y: nextY });
        setPosition(clamped);
      }
    },
    [position]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      try {
        (e.target as Element).releasePointerCapture?.(e.pointerId);
      } catch {
        /* may have already been released */
      }
      const moved = d.moved;
      dragRef.current = null;
      if (moved) {
        // Drag: persist the new position; do NOT toggle the bulb.
        storePosition(position);
      } else {
        // Click: toggle illumination.
        setActive(!active);
      }
    },
    [position, active, setActive]
  );

  if (!enabled || !isDark || !mounted) return null;

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      aria-label={
        active ? "Turn off learning hints" : "Turn on learning hints"
      }
      aria-pressed={active}
      title={
        active
          ? "Learning Mode is ON — hover any element to learn what it does. Click to turn off. Drag to move."
          : "Learning Mode is dim — click to illuminate. Drag to move."
      }
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        cursor: dragRef.current?.moved ? "grabbing" : "grab",
        // Tells the browser this element handles its own pan
        // gestures — prevents the page from scrolling while the
        // user drags the FAB on touch devices.
        touchAction: "none",
      }}
      className={`z-40 group flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 select-none ${
        active
          ? "bg-ember-400/10 border-2 border-ember-400/70 shadow-glow-ember-strong"
          : "bg-base/60 border border-default hover:border-ember-400/40"
      }`}
    >
      <span
        className={`block pointer-events-none transition-all duration-300 ${
          active ? "scale-110" : "group-hover:scale-105"
        }`}
      >
        <LearningBulb size={36} glowing={active} priority />
      </span>
      {active && (
        <span
          className="absolute inset-0 rounded-full animate-ping bg-ember-400/15 pointer-events-none"
          aria-hidden
        />
      )}
    </button>
  );
}
