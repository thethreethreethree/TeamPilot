"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { MUTABLE_NOTIFICATION_TYPES, MUTE_LABELS, type MutableNotificationType } from "@/lib/notifications/mutes";

/**
 * Settings → Bell notices (0334; Gong F30.1; founder 2026-11-25 "Only FYI notices"). Each person can turn off the
 * notices that only inform. Notices that ask them to act — a dispute to answer, a feedback request, a mention, a score
 * correction — always arrive, and the panel says so.
 */
export function NotificationMutesPanel() {
  const [muted, setMuted] = useState<MutableNotificationType[] | null>(null);
  const [state, setState] = useState<"loading" | "failed" | "ok">("loading");
  const [busy, setBusy] = useState<MutableNotificationType | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/me/notification-mutes", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { muted?: MutableNotificationType[] }) => {
        if (!live) return;
        setMuted(d.muted ?? []);
        setState("ok");
      })
      .catch(() => live && setState("failed"));
    return () => {
      live = false;
    };
  }, []);

  /** `on` = the notice is currently on; clicking turns it off (mutes it), or back on. */
  const toggle = async (type: MutableNotificationType, on: boolean) => {
    setBusy(type);
    setErr(null);
    try {
      const r = await fetch("/api/me/notification-mutes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, muted: on }),
      });
      if (!r.ok) throw new Error();
      setMuted((m) => (on ? [...(m ?? []), type] : (m ?? []).filter((t) => t !== type)));
    } catch {
      setErr("Couldn't save that. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="glass-card p-6" aria-label="Bell notices">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Bell className="h-4 w-4 text-brand" aria-hidden /> Bell notices
      </h2>
      <p className="mt-1 text-xs text-secondary">
        Turn off notices that only keep you informed. Ones that ask you to act — a dispute to answer, a feedback request, a
        mention, a score correction — always arrive.
      </p>
      {state === "loading" ? (
        <p className="mt-3 text-xs text-muted">Loading…</p>
      ) : state === "failed" ? (
        <p className="mt-3 text-xs text-muted">Couldn&apos;t load your notification settings. Refresh to try again.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {MUTABLE_NOTIFICATION_TYPES.map((t) => {
            const on = !(muted ?? []).includes(t);
            return (
              <li key={t}>
                <label className="flex items-center justify-between gap-3 text-sm text-primary">
                  {MUTE_LABELS[t]}
                  <input type="checkbox" checked={on} disabled={busy === t} onChange={() => void toggle(t, on)} aria-label={MUTE_LABELS[t]} />
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {err && <p role="status" className="mt-2 text-xs text-amber-700 dark:text-amber-300">{err}</p>}
    </section>
  );
}
