"use client";

import { useEffect, type RefObject } from "react";

/**
 * useSearchHotkey — bind '/' to focus a search input.
 *
 * SaaS convention adopted by GitHub, Linear, Notion, etc. Press
 * '/' anywhere on a page (outside another input) and the focus
 * lands in the search field. Reduces hand-to-mouse round-trips
 * for power users.
 *
 * Skips when:
 * - User is already typing in an input / textarea / contenteditable
 * - The Cmd/Ctrl/Alt modifier is held (those are reserved for the
 *   browser / system shortcuts)
 *
 * Per Wave X audit 2026-06-19.
 */
export function useSearchHotkey(
  ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (target as HTMLElement).isContentEditable
      ) {
        return;
      }
      const el = ref.current;
      if (!el) return;
      e.preventDefault();
      el.focus();
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ref]);
}
