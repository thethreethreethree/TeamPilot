"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * Shared modal component (audit Tier 3 #24, #25).
 *
 * Handles:
 *  - ESC key to close
 *  - Click-outside to close (optional)
 *  - Focus trap inside the dialog
 *  - Returns focus to the previously focused element on close
 *  - Locks body scroll while open
 *
 * Replaces the ad-hoc modal markup that was duplicated across Tasks, Problems,
 * Resolutions, Team, and Brain pages.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdrop?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Open/close lifecycle — runs ONLY when `open` flips, not on every
  // parent re-render. This was the cause of the "X-button-steals-focus
  // on every keystroke" bug: when this effect listed `onClose` in its
  // dep array, every parent render that created a new `onClose`
  // reference caused the effect to re-run, which scheduled a fresh
  // requestAnimationFrame that focused the first focusable inside the
  // dialog (the close X). Splitting the keydown listener (which DOES
  // need the latest `onClose`) from the focus-init keeps both correct.
  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Initial focus: prefer inputs / textareas / selects before
    // buttons so opening a form modal lands the cursor in the first
    // field, not on the close X. The button fallback handles modals
    // that have no input controls (confirmation dialogs, etc.).
    requestAnimationFrame(() => {
      const root = dialogRef.current;
      if (!root) return;
      const first =
        root.querySelector<HTMLElement>(
          'input:not([disabled]), textarea:not([disabled]), select:not([disabled])'
        ) ??
        root.querySelector<HTMLElement>('button:not([disabled]):not([aria-label="Close"])') ??
        root.querySelector<HTMLElement>('button:not([disabled])');
      first?.focus();
    });

    return () => {
      document.body.style.overflow = originalOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  // Keydown listener — re-bound when `onClose` identity changes so
  // Escape always calls the latest closer. This effect intentionally
  // does NOT touch focus or body scroll; that work belongs to the
  // open-lifecycle effect above.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const widthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-2xl",
  }[size];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`glass-card w-full ${widthClass} p-6 max-h-[90dvh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            id="modal-title"
            className="text-sm font-semibold text-primary"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            // p-2 yields a 32px tap zone around the 16px icon — 32+
            // is the practical minimum on touch (WCAG 2.5.5 says 44+
            // but our modals are dense; 32 is the right tradeoff
            // for the in-modal close affordance specifically).
            className="text-muted hover:text-primary p-2 -m-2 rounded-md"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
