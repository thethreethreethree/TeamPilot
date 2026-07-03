"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { PendingContent } from "@/components/sales-coach/ui/LoadingButton";

/**
 * Command Deck — the Sales Coach mobile design language.
 * Founder direction 2026-07-02: sleek, modern, "advanced-tech" yet intuitive,
 * in our mono-amber brand identity (ember on matte ink; glow + gradient per
 * docs/BRAND.md + src/lib/design/tokens.ts — NO red).
 *
 * These are LAYER-4 primitives only (AMD-006): pure presentation, no logic.
 * Every Sales Coach surface composes these so the look is one system, not a
 * per-page fork (§A21). Redesigning is re-skinning — the surfaces keep their
 * existing data + handlers wired (L4 must never regress L2/L3).
 */

type Tone = "brand" | "emerald" | "amber" | "muted";

/** The scrollable deck canvas: matte-ink field + an ambient bulb-glow at the
 *  top, content centered in a phone-width column. Slots inside the dashboard
 *  layout's flex container (after TopBar). */
export function DeckShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex-1 overflow-y-auto bg-base">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56"
        style={{
          background:
            "radial-gradient(75% 100% at 50% 0%, rgba(250,204,21,0.10) 0%, rgba(250,204,21,0.02) 40%, transparent 72%)",
        }}
      />
      <div className="relative mx-auto w-full max-w-md px-4 pb-20 pt-5 space-y-4">
        {children}
      </div>
    </div>
  );
}

/** Glassy raised card. `glow` gives it the ember halo for hero/primary cards. */
export function DeckCard({
  children,
  glow = false,
  className = "",
}: {
  children: ReactNode;
  glow?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border backdrop-blur-sm ${
        glow
          ? "border-ember-400/25 bg-ember-400/[0.04] shadow-[0_0_34px_-12px_rgba(250,204,21,0.4)]"
          : "border-white/[0.07] bg-white/[0.02]"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** Uppercase section label with an optional leading icon + trailing action. */
export function SectionLabel({
  icon: Icon,
  children,
  action,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-brand" aria-hidden />}
        <h2 className="text-[11px] uppercase tracking-[0.15em] font-bold text-muted">
          {children}
        </h2>
      </div>
      {action}
    </div>
  );
}

/** Big stat cell with optional sparkline. */
export function DeckStat({
  icon: Icon,
  label,
  value,
  sub,
  tone = "brand",
  spark,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: Tone;
  spark?: number[];
}) {
  const accent =
    tone === "brand"
      ? "text-brand"
      : tone === "emerald"
        ? "text-emerald-300"
        : tone === "amber"
          ? "text-amber-300"
          : "text-secondary";
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 ${
        tone === "brand"
          ? "shadow-[0_0_26px_-14px_rgba(250,204,21,0.55)]"
          : ""
      }`}
    >
      <div className="flex items-center gap-1 mb-1.5">
        <Icon className={`w-3.5 h-3.5 ${accent}`} aria-hidden />
        <p className="text-[9px] uppercase tracking-[0.14em] font-bold text-muted leading-none">
          {label}
        </p>
      </div>
      <p className="text-2xl font-bold text-primary tabular-nums leading-none">
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted mt-1 leading-tight">{sub}</p>}
      {spark && spark.length > 1 && (
        <div className={`mt-2 ${accent}`}>
          <Sparkline data={spark} />
        </div>
      )}
    </div>
  );
}

/** Primary ember-gradient CTA — the deck's signature button. */
export function DeckButton({
  children,
  onClick,
  disabled,
  type = "button",
  className = "",
  pending = false,
  pendingLabel,
  icon,
  spinnerClassName = "w-4 h-4",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  /** Loading state — same affordance as LoadingButton (A13/A21). */
  pending?: boolean;
  pendingLabel?: ReactNode;
  icon?: ReactNode;
  spinnerClassName?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={pending || disabled}
      aria-busy={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-[#09090B] transition-all bg-gradient-to-br from-ember-300 via-ember-400 to-ember-500 hover:shadow-[0_0_26px_-6px_rgba(250,204,21,0.65)] active:scale-[0.99] disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 ${className}`}
    >
      <PendingContent
        pending={pending}
        icon={icon}
        pendingLabel={pendingLabel}
        spinnerClassName={spinnerClassName}
      >
        {children}
      </PendingContent>
    </button>
  );
}

/** Secondary (outline) button matching the deck. */
export function DeckGhostButton({
  children,
  onClick,
  disabled,
  active = false,
  className = "",
  pending = false,
  pendingLabel,
  icon,
  spinnerClassName = "w-3 h-3",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
  /** Loading state — same affordance as LoadingButton (A13/A21). */
  pending?: boolean;
  pendingLabel?: ReactNode;
  icon?: ReactNode;
  spinnerClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || disabled}
      aria-busy={pending}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
        active
          ? "border-ember-400/50 bg-ember-400/10 text-brand"
          : "border-white/10 text-secondary hover:text-primary hover:border-white/20"
      } ${className}`}
    >
      <PendingContent
        pending={pending}
        icon={icon}
        pendingLabel={pendingLabel}
        spinnerClassName={spinnerClassName}
      >
        {children}
      </PendingContent>
    </button>
  );
}

/** Small status chip. */
export function DeckPill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const cls =
    tone === "emerald"
      ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
      : tone === "amber"
        ? "text-amber-300 border-amber-500/30 bg-amber-500/10"
        : tone === "brand"
          ? "text-brand border-ember-400/40 bg-ember-400/10"
          : "text-muted border-white/10 bg-white/[0.03]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

/** Tiny inline sparkline from a number series (inherits currentColor). */
export function Sparkline({
  data,
  width = 64,
  height = 18,
}: {
  data: number[];
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((d - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      fill="none"
      aria-hidden
    >
      <polyline
        points={pts}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );
}

/** Thin level/progress meter (0..1). */
export function DeckMeter({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-ember-400 to-ember-500 transition-[width] duration-150"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
