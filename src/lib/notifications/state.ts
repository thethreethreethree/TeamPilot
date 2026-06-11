"use client";

/**
 * Notifications read-state — Phase 1.
 *
 * Stored client-side in localStorage as the ISO timestamp of the
 * most-recent notification the user has acknowledged (by visiting
 * /dashboard/notifications). The sidebar bell compares the latest
 * `occurred_at` from the notifications API against this stored
 * timestamp; anything newer counts as unread.
 *
 * Phase 2 will move this to server-side per-user state so read
 * status syncs across devices. Same shape, different store.
 */

export const NOTIF_LAST_READ_KEY = "elostate.notifications.last_read.v1";

export function getLastNotificationsRead(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(NOTIF_LAST_READ_KEY);
  } catch {
    return null;
  }
}

export function markNotificationsRead(isoTimestamp: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTIF_LAST_READ_KEY, isoTimestamp);
    // Notify any listeners (e.g., the sidebar bell) within this tab.
    window.dispatchEvent(new CustomEvent("elostate:notifications-read"));
  } catch {
    /* private browsing or storage disabled — non-fatal */
  }
}
