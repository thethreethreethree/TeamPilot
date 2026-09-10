"use client";

import { useCallback, useRef } from "react";
import { dialFill } from "@/lib/coach/doorlog/dayTarget";

/**
 * DoorDial — a done/target tick-mark dial for the door home screen (docs/2ND MAIN PANEL DASKBOARD).
 * The Progress screen had only an arc gauge (EloMeter), so this is the new lit/unlit tick ring the spec needs.
 *
 * Geometry matches the founder's "Door Tracker Screen" mockup EXACTLY (2026-09-10): 26 ticks over a 300° sweep
 * (a 60° gap centred at the bottom), starting top-left and running clockwise, on a 110-unit viewBox. The lit
 * fraction = count ÷ target, clamped at 1 (95 of 80 fills the ring, no second lap). Lit = the app's ember brand
 * (founder kept ember over the mockup's yellow, for app-wide consistency); unlit = a muted stroke. The whole
 * dial is one tap target (tap opens the quick-log; long-press decrements — optional). Count is text, never
 * colour alone (a rep in sunlight).
 */

const TOTAL_TICKS = 26;
const SWEEP_DEG = 300; // 60° gap centred at the bottom
const START_DEG = -150; // first tick, measured from straight up (0 = up), running clockwise
const CX = 55;
const CY = 55;
const R_INNER = 39;
const R_OUTER = 50;
const LONG_PRESS_MS = 450;

function tick(i: number): { x1: number; y1: number; x2: number; y2: number } {
  // 0° = straight up, clockwise (x = sin, y = −cos) — the mockup's convention, matched tick-for-tick.
  const deg = START_DEG + SWEEP_DEG * (i / (TOTAL_TICKS - 1));
  const rad = (deg * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  return { x1: CX + R_INNER * sin, y1: CY - R_INNER * cos, x2: CX + R_OUTER * sin, y2: CY - R_OUTER * cos };
}

export function DoorDial({
  count,
  target,
  label,
  accent = false,
  onTap,
  onDecrement,
  disabled = false,
}: {
  count: number;
  /** null / 0 → no ring fill (plain count), e.g. the no-goal / no-target state. */
  target: number | null;
  label: string;
  /** Accent styling for the "Sold" dial (matches the existing Macro bubble). */
  accent?: boolean;
  onTap?: () => void;
  onDecrement?: () => void;
  disabled?: boolean;
}) {
  const litCount = target && target > 0 ? Math.round(dialFill(count, target) * TOTAL_TICKS) : 0;
  const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLong = useRef(false);

  const startPress = useCallback(() => {
    if (disabled) return;
    didLong.current = false;
    if (onDecrement) {
      longTimer.current = setTimeout(() => { didLong.current = true; onDecrement(); }, LONG_PRESS_MS);
    }
  }, [disabled, onDecrement]);

  const endPress = useCallback(() => {
    if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null; }
    if (disabled || didLong.current) return; // a long-press already decremented — don't also tap
    onTap?.();
  }, [disabled, onTap]);

  const cancelPress = useCallback(() => {
    if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null; }
  }, []);

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={cancelPress}
      onContextMenu={(e) => e.preventDefault()} // long-press on mobile can raise the context menu
      aria-label={`${label}: ${count}${target ? ` of ${target}` : ""}.${onTap ? " Tap to log." : ""}${onDecrement ? " Long-press to remove one." : ""}`}
      className="relative flex flex-col items-center justify-center gap-1 rounded-2xl p-1 select-none touch-none active:scale-[0.97] transition-transform disabled:opacity-50"
    >
      <span className="relative inline-flex items-center justify-center">
        <svg viewBox="0 0 110 110" className="w-[104px] h-[104px]" aria-hidden>
          {Array.from({ length: TOTAL_TICKS }, (_, i) => {
            const t = tick(i);
            const lit = i < litCount;
            return (
              <line
                key={i}
                x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                strokeWidth={2.9}
                strokeLinecap="round"
                className={lit ? "stroke-ember-400 transition-[stroke] duration-200" : "stroke-white/15"}
              />
            );
          })}
        </svg>
        {/* Center count */}
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold tabular-nums leading-none ${accent ? "text-brand" : "text-primary"}`}>
            {count}
          </span>
          {target ? <span className="text-[10px] text-muted tabular-nums mt-0.5">of {target}</span> : null}
        </span>
      </span>
      <span className="text-[10px] uppercase tracking-wide text-muted font-bold leading-tight">{label}</span>
    </button>
  );
}
