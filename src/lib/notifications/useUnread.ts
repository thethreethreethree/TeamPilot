"use client";

import { useEffect, useState } from "react";
import { getLastNotificationsRead } from "./state";

/**
 * useUnreadNotifications — returns true if there's at least one
 * notification newer than the user's stored "last read" timestamp.
 *
 * Polls the lightweight /api/notifications endpoint every 60 seconds
 * (cheap — small JSON response). Also listens for the
 * `elostate:notifications-read` custom event so visiting the inbox
 * updates the bell immediately in this tab without waiting for the
 * next poll.
 */
export function useUnreadNotifications(): boolean {
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          notifications: { occurredAt: string }[];
        };
        const latest = data.notifications[0]?.occurredAt;
        if (!latest) {
          if (!cancelled) setUnread(false);
          return;
        }
        const lastRead = getLastNotificationsRead();
        const hasUnread = !lastRead || lastRead < latest;
        if (!cancelled) setUnread(hasUnread);
      } catch {
        /* network blip — leave previous state alone */
      }
    };

    void check();
    const interval = window.setInterval(check, 60_000);
    const onRead = () => setUnread(false);
    window.addEventListener("elostate:notifications-read", onRead);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("elostate:notifications-read", onRead);
    };
  }, []);

  return unread;
}
