"use client";

import { useCallback, useRef } from "react";
import { dialFill } from "@/lib/coach/doorlog/dayTarget";

/**
 * DoorDial — a done/target tick-mark dial for the door home screen (docs/2ND MAIN PANEL DASKBOARD, Phase 07).
 * The Progress screen had only an arc gauge (EloMeter), so this is the new lit/unlit tick ring the spec needs.
 *
 * Ticks run clockwise from a 60° gap at the bottom; the lit fraction = count ÷ target, clamped at 1 (95 of 80
 * fills the ring, no second lap). Lit = the brand ember, unlit = a muted stroke. The whole dial is one tap
 * target (tap logs one; long-press decrements — Q5). Count is text, never colour alone (a rep in sunlight).
 */

const TOTAL_TICKS = 40;
const GAP_DEG = 60; // gap centred at the bottom
const SWEEP_DEG = 360 - GAP_DEG;
const START_DEG = 90 + GAP_DEG / 2; // first tick just clockwise of the bottom gap (SVG y-down: 90° = bottom)
const R_OUTER = 46;
const R_INNER = 38;
const LONG_PRESS_MS = 450;

function tick(i: number): { x1: number; y1: number; x2: number; y2: number } {
  const frac = i / (TOTAL_TICKS - 1);
  const deg = START_DEG + frac * SWEEP_DEG;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x1: 50 + R_INNER * cos, y1: 50 + R_INNER * sin, x2: 50 + R_OUTER * cos, y2: 50 + R_OUTER * sin };
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
        <svg viewBox="0 0 100 100" className="w-[104px] h-[104px]" aria-hidden>
          {Array.from({ length: TOTAL_TICKS }, (_, i) => {
            const t = tick(i);
            const lit = i < litCount;
            return (
              <line
                key={i}
                x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                strokeWidth={2.4}
                strokeLinecap="round"
                className={lit ? (accent ? "stroke-ember-400" : "stroke-ember-400") : "stroke-white/15"}
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
