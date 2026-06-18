"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle } from "lucide-react";
import { useLearningMode } from "./LearningModeProvider";

/**
 * Wrap any element with a Learning Mode hint.
 *
 * Per founder direction 2026-06-18: a hint is NOT a label. It is a
 * teaching artifact. Each hint surfaces four things:
 *
 *   - WHAT IT IS       — plain functional description
 *   - WHY IT EXISTS    — the failure mode it defeats (load-bearing)
 *   - HOW TO USE IT    — operational guidance
 *   - WHAT TO REMEMBER — single transferable principle (optional)
 *
 * Plus an "Ask Jeff what this does" CTA for conversational follow-up.
 *
 * Positioning (2026-06-18 fix — second AMD-006 §1.5.1 L3 lesson):
 *   - The popover portals to document.body so it escapes any
 *     overflow:hidden / overflow-y-auto parent clipping (the
 *     sidebar's overflow-y-auto was clipping hint popovers for
 *     nav items — caught by founder).
 *   - Placement auto-detects from trigger position: right when the
 *     trigger is in the left third of the viewport, left when in
 *     the right third, bottom when there's room below, top
 *     otherwise. Falls back to clamped bottom when nothing fits.
 *   - Final left/top are clamped to viewport edges with EDGE
 *     padding so the popover never strands off-screen.
 *
 * Per CLAUDE.md §3.3 — hints teach, never overtake.
 */

const POPOVER_WIDTH = 320; // w-80
const POPOVER_MAX_HEIGHT = 480;
const VIEWPORT_PADDING = 12;
const TRIGGER_GAP = 8;

type Placement = "bottom" | "top" | "right" | "left";

type Position = {
  left: number;
  top: number;
  placement: Placement;
};

function computePosition(triggerRect: DOMRect): Position {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const popoverHeight = Math.min(POPOVER_MAX_HEIGHT, vh - 2 * VIEWPORT_PADDING);

  const spaceBelow = vh - triggerRect.bottom - TRIGGER_GAP;
  const spaceAbove = triggerRect.top - TRIGGER_GAP;
  const spaceRight = vw - triggerRect.right - TRIGGER_GAP;
  const spaceLeft = triggerRect.left - TRIGGER_GAP;

  // 1. Prefer right when trigger is anchored to the left (e.g.,
  //    sidebar nav items). The popover floats out to the right with
  //    plenty of room.
  if (triggerRect.left < vw / 3 && spaceRight > POPOVER_WIDTH + VIEWPORT_PADDING) {
    const top = Math.max(
      VIEWPORT_PADDING,
      Math.min(triggerRect.top, vh - popoverHeight - VIEWPORT_PADDING)
    );
    return {
      left: triggerRect.right + TRIGGER_GAP,
      top,
      placement: "right",
    };
  }

  // 2. Prefer left when trigger is anchored to the right.
  if (
    triggerRect.right > (vw * 2) / 3 &&
    spaceLeft > POPOVER_WIDTH + VIEWPORT_PADDING
  ) {
    const top = Math.max(
      VIEWPORT_PADDING,
      Math.min(triggerRect.top, vh - popoverHeight - VIEWPORT_PADDING)
    );
    return {
      left: triggerRect.left - POPOVER_WIDTH - TRIGGER_GAP,
      top,
      placement: "left",
    };
  }

  // 3. Below if there's vertical room.
  if (spaceBelow > 200) {
    const idealLeft =
      triggerRect.left + triggerRect.width / 2 - POPOVER_WIDTH / 2;
    const left = Math.max(
      VIEWPORT_PADDING,
      Math.min(idealLeft, vw - POPOVER_WIDTH - VIEWPORT_PADDING)
    );
    return {
      left,
      top: triggerRect.bottom + TRIGGER_GAP,
      placement: "bottom",
    };
  }

  // 4. Above as last resort.
  if (spaceAbove > 200) {
    const idealLeft =
      triggerRect.left + triggerRect.width / 2 - POPOVER_WIDTH / 2;
    const left = Math.max(
      VIEWPORT_PADDING,
      Math.min(idealLeft, vw - POPOVER_WIDTH - VIEWPORT_PADDING)
    );
    return {
      left,
      top: Math.max(
        VIEWPORT_PADDING,
        triggerRect.top - popoverHeight - TRIGGER_GAP
      ),
      placement: "top",
    };
  }

  // 5. Fallback — center it in the viewport.
  return {
    left: Math.max(VIEWPORT_PADDING, (vw - POPOVER_WIDTH) / 2),
    top: VIEWPORT_PADDING,
    placement: "bottom",
  };
}

export function LearningHint({
  title,
  whatItIs,
  why,
  how,
  principle,
  category,
  as = "inline-block",
  children,
}: {
  title: string;
  whatItIs: string;
  why: string;
  how: string;
  principle?: string;
  category?: string;
  as?: "inline-block" | "block";
  children: React.ReactNode;
}) {
  const { shouldRender, askJeff } = useLearningMode();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  // createPortal requires document to be available — only after mount.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Hover bridge — small grace period when the cursor leaves the
  // trigger so it can reach the popover (which sits across a small
  // gap) without the popover dismissing prematurely.
  const scheduleClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setOpen(false), 160);
  };
  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Click-outside to close (mobile / keyboard users tap the
  // trigger to open and need a way to dismiss without re-tapping
  // the trigger).
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        triggerRef.current?.contains(t) ||
        popoverRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Recompute position when opening, on resize, and on scroll.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      return;
    }
    const update = () => {
      if (!triggerRef.current) return;
      setPos(computePosition(triggerRef.current.getBoundingClientRect()));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  if (!shouldRender) {
    return <>{children}</>;
  }

  const wrapperClass = `relative ${as === "block" ? "block" : "inline-block"} learning-hint-target`;

  const popoverContent = open && pos && mounted && (
    <div
      ref={popoverRef}
      role="tooltip"
      id={`learning-hint-${id}`}
      data-placement={pos.placement}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        width: POPOVER_WIDTH,
        maxHeight: POPOVER_MAX_HEIGHT,
        zIndex: 70,
      }}
      className="rounded-lg border border-ember-400/50 bg-base/95 backdrop-blur-sm shadow-glow-ember-soft px-4 py-3 text-left space-y-2.5 overflow-y-auto"
    >
      {/* Pulsing outline on the wrapped element so the user can
          SEE which elements are annotated. Render the outline ABOVE
          the children for visibility. */}
      <span className="block">
        {category && (
          <span className="block text-[9px] uppercase tracking-widest font-bold text-ember-300 mb-0.5">
            {category}
          </span>
        )}
        <span className="block text-sm font-semibold text-primary">
          {title}
        </span>
      </span>

      <span className="block">
        <span className="block text-[9px] uppercase tracking-widest font-bold text-muted mb-0.5">
          What it is
        </span>
        <span className="block text-[11px] text-secondary leading-relaxed">
          {whatItIs}
        </span>
      </span>

      <span className="block">
        <span className="block text-[9px] uppercase tracking-widest font-bold text-muted mb-0.5">
          Why
        </span>
        <span className="block text-[11px] text-secondary leading-relaxed">
          {why}
        </span>
      </span>

      <span className="block">
        <span className="block text-[9px] uppercase tracking-widest font-bold text-muted mb-0.5">
          How to use it
        </span>
        <span className="block text-[11px] text-secondary leading-relaxed">
          {how}
        </span>
      </span>

      {principle && (
        <span className="block pt-1 border-t border-default">
          <span className="block text-[9px] uppercase tracking-widest font-bold text-ember-300 mb-0.5">
            What to remember
          </span>
          <span className="block text-[11px] text-primary leading-relaxed italic">
            {principle}
          </span>
        </span>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(false);
          askJeff({
            title,
            whatItIs,
            why,
            how,
            principle,
            category,
          });
        }}
        className="w-full flex items-center justify-between gap-2 text-[11px] font-semibold text-ember-300 hover:text-primary border border-ember-400/40 hover:border-ember-400 bg-ember-400/5 hover:bg-ember-400/10 rounded-md px-2.5 py-1.5 transition-colors mt-1"
      >
        <span className="inline-flex items-center gap-1.5">
          <MessageCircle className="w-3 h-3" aria-hidden />
          Ask Jeff what this does
        </span>
        <span className="text-muted">→</span>
      </button>
    </div>
  );

  return (
    <span
      ref={triggerRef}
      className={wrapperClass}
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onFocus={() => setOpen(true)}
      onClick={() => {
        cancelClose();
        setOpen((p) => !p);
      }}
    >
      {/* Pulsing outline marks the annotated element. */}
      <span
        aria-hidden
        className="absolute -inset-1 rounded-md border border-ember-400/60 animate-pulse pointer-events-none"
      />
      {children}
      {mounted && popoverContent && createPortal(popoverContent, document.body)}
    </span>
  );
}
