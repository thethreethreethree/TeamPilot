"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * EmptyState — first-run guidance shown when a module has no data.
 *
 * Why this exists per AMD-006 §1.5.1
 * ──────────────────────────────────
 * Layer 3 (synergetic composition): a brand-new tenant lands on
 * every module with zero data. Without explicit guidance, they
 * see blank panels and can't tell whether the module is broken,
 * loading, or just unused yet. The empty state IS the workflow
 * affordance for first-time use — it turns "broken-feeling
 * blank" into "here's what this module does and here's how to
 * start."
 *
 * TT.md A8 (System as growth-aware participant): the empty
 * state isn't neutral signage; it's the module saying "I'm
 * ready when you are, and here's the first concrete step."
 *
 * TT.md A18 (label invites): the action button label invites
 * the right behavior. "Create your first task" invites action;
 * "Configure tasks" reads as work and is wrong.
 *
 * Props
 * ─────
 *   icon         — lucide icon component to render at the top
 *   title        — h2-equivalent, short, one line
 *   description  — 1-2 sentences explaining what the module
 *                  does and what the next action will accomplish
 *   primary      — main CTA: { label, href } OR { label, onClick }
 *   secondary    — optional second action with the same shape
 *   children     — optional extra content (e.g., bullet list of
 *                  what the module enables)
 */
export type EmptyStateAction =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };

export function EmptyState({
  icon: Icon,
  title,
  description,
  primary,
  secondary,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  primary?: EmptyStateAction;
  secondary?: EmptyStateAction;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-16 max-w-xl mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-[#FACC15]/10 border border-[#FACC15]/20 flex items-center justify-center mb-5">
        <Icon className="w-7 h-7 text-brand" aria-hidden />
      </div>
      <h2 className="text-lg font-bold text-primary mb-2">{title}</h2>
      <p className="text-sm text-secondary leading-relaxed mb-6">
        {description}
      </p>
      {children && (
        <div className="text-xs text-muted leading-relaxed mb-6 max-w-md">
          {children}
        </div>
      )}
      {(primary || secondary) && (
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {primary && (
            <ActionButton action={primary} variant="primary" />
          )}
          {secondary && (
            <ActionButton action={secondary} variant="secondary" />
          )}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  action,
  variant,
}: {
  action: EmptyStateAction;
  variant: "primary" | "secondary";
}) {
  const className =
    variant === "primary"
      ? "inline-flex items-center gap-1.5 text-sm font-semibold bg-[#FACC15] hover:bg-[#EAB308] text-[#09090B] px-4 py-2 rounded-lg transition-colors shadow-glow hover:shadow-none"
      : "inline-flex items-center gap-1.5 text-sm font-medium text-secondary border border-default hover:text-primary hover:border-strong px-4 py-2 rounded-lg transition-colors";
  if ("href" in action && action.href) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}
