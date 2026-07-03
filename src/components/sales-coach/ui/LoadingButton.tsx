"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

/**
 * LoadingButton — the ONE Sales Coach loading affordance (A13 author-once,
 * A21 one idiom). Drop-in for the hand-rolled pattern that was copied across
 * every Sales Coach surface:
 *
 *   <button disabled={loading}>{loading && <Loader2 …/>}{label}</button>
 *
 * Prop-driven, NOT useFormStatus. The `SubmitButton`/`useFormStatus` code the
 * founder extracted from another build assumes a <form action={serverAction}>
 * submit; Sales Coach has ZERO of those — every surface drives loading with a
 * client fetch() + useState boolean (audit 2026-07-03). useFormStatus here
 * would report pending:false forever, so the spinner would never show
 * (AMD-006 L1 structure / L2 effectivity). `pending` is therefore passed in
 * from the caller's own loading state.
 *
 * When pending: shows a leading spinner (replacing `icon` if one is given),
 * sets `disabled` + `aria-busy`, and optionally swaps the label for
 * `pendingLabel`. Spread props (className, onClick, …) pass straight through,
 * so it preserves each button's existing styling exactly.
 */
/**
 * The spinner-or-icon + label content, authored ONCE (A13) and shared by
 * LoadingButton AND the deck primitives (DeckButton/DeckGhostButton) so the
 * loading affordance is identical everywhere instead of copied per button.
 * `spinnerClassName` lets a caller match the spinner to the icon it replaces
 * (audit F2 — the spinner was hardcoded w-3.5 and mismatched w-4/w-3 icons).
 */
export function PendingContent({
  pending,
  icon,
  pendingLabel,
  spinnerClassName = "w-3.5 h-3.5",
  children,
}: {
  pending: boolean;
  icon?: ReactNode;
  pendingLabel?: ReactNode;
  spinnerClassName?: string;
  children: ReactNode;
}) {
  return (
    <>
      {pending ? (
        <Loader2 className={`${spinnerClassName} animate-spin`} aria-hidden />
      ) : (
        icon ?? null
      )}
      {pending ? pendingLabel ?? children : children}
    </>
  );
}

export function LoadingButton({
  pending,
  pendingLabel,
  icon,
  spinnerClassName,
  children,
  disabled,
  type = "button",
  ...rest
}: {
  /** Loading state, owned by the caller (its own useState boolean). */
  pending: boolean;
  /** Optional label to show while pending (defaults to the normal label). */
  pendingLabel?: ReactNode;
  /** Optional idle icon; the spinner replaces it while pending. */
  icon?: ReactNode;
  /** Spinner size/classes — default w-3.5 h-3.5; override to match the icon. */
  spinnerClassName?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      type={type}
      disabled={pending || disabled}
      aria-busy={pending}
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
