"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * useNotificationSubscription — Team Chat PWA notifications.
 *
 * Wraps the Notification permission flow + PushManager subscription
 * + the POST to /api/notifications/subscribe.
 *
 * Returns:
 *   - status: the current subscription state
 *   - supported: whether the browser supports push at all
 *   - subscribe(): kicks off the permission + subscription flow
 *   - unsubscribe(): revokes the local subscription + tells the server
 *
 * Browser support caveats:
 *   - iOS Safari: only works on an INSTALLED PWA (added to home
 *     screen). The browser-tab Safari context will report 'denied'
 *     or fail silently.
 *   - Android Chrome: works in any context.
 *   - Desktop Chrome / Edge / Firefox: works in any context.
 *
 * The hook intentionally does NOT auto-trigger on mount — push
 * permission requests must be user-initiated to avoid the "shady
 * site immediately asks for notifications" UX. The hosting
 * component renders a button that calls subscribe() on click.
 */

type SubscriptionStatus =
  | "loading"        // checking initial state
  | "unsupported"    // browser doesn't support Notification / PushManager
  | "denied"         // user has previously denied permission
  | "default"        // user has not been asked yet (or chose nothing)
  | "subscribing"    // permission grant + subscribe call in flight
  | "subscribed"     // active push subscription exists
  | "error";         // something failed; check error message

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  // Web Push spec uses base64url encoded VAPID public keys; the
  // browser's PushManager.subscribe expects a Uint8Array.
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function useNotificationSubscription(): {
  status: SubscriptionStatus;
  supported: boolean;
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
} {
  const [status, setStatus] = useState<SubscriptionStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const isSupported = useCallback(() => {
    return (
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
  }, []);

  // On mount, figure out current state.
  useEffect(() => {
    if (!isSupported()) {
      setStatus("unsupported");
      return;
    }
    void (async () => {
      try {
        const perm = Notification.permission;
        if (perm === "denied") {
          setStatus("denied");
          return;
        }
        const reg = await navigator.serviceWorker.ready.catch(() => null);
        const existing = reg ? await reg.pushManager.getSubscription() : null;
        if (existing) {
          setStatus("subscribed");
        } else if (perm === "granted") {
          // Edge case: permission granted but no subscription (e.g.
          // it got cleared). UI can offer re-subscribe.
          setStatus("default");
        } else {
          setStatus("default");
        }
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported()) {
      setStatus("unsupported");
      return;
    }
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublic) {
      setStatus("error");
      setError(
        "Push notifications aren't configured for this environment yet (VAPID public key missing)."
      );
      return;
    }
    setStatus("subscribing");
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "denied" : "default");
        return;
      }
      // The SW must be the team-chat one because that's what handles
      // the push event. The chat layout already registers it.
      const reg = await navigator.serviceWorker.ready;
      // The DOM types for applicationServerKey are stricter in newer
      // TypeScript releases — Uint8Array<ArrayBufferLike> doesn't
      // satisfy BufferSource. The runtime accepts Uint8Array fine; we
      // cast through `unknown` because the underlying ArrayBuffer-vs-
      // ArrayBufferLike distinction is purely a type-level artifact.
      const applicationServerKey = urlBase64ToUint8Array(
        vapidPublic
      ) as unknown as BufferSource;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      const json = sub.toJSON();
      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Subscribe failed (HTTP ${res.status})`);
      }
      setStatus("subscribed");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported()) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (!existing) {
        setStatus("default");
        return;
      }
      const json = existing.toJSON();
      await existing.unsubscribe();
      // Tell the server to delete the row too. Best-effort — if it
      // fails the row stays, but Phase 2.2's send-side handling of
      // 410 Gone will eventually clean it up.
      await fetch("/api/notifications/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint }),
      }).catch(() => {});
      setStatus("default");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [isSupported]);

  return {
    status,
    supported: status !== "unsupported",
    error,
    subscribe,
    unsubscribe,
  };
}
