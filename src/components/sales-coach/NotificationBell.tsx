"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Trophy, CircleDollarSign } from "lucide-react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * NotificationBell — the manager's in-app alerts (gamification Phase 4). Opens a dropdown with strong-session /
 * deal-closed alerts, each linking to the session; mark-all-read. Alerts arrive LIVE via Supabase Realtime (founder
 * 2026-09-04): the bell subscribes to new manager_notifications INSERTs for the caller and re-fetches instantly.
 * RLS (0242: recipient_id = auth.uid()) is enforced per-subscriber, so a manager only ever receives their OWN
 * alerts. A 60s poll stays as the fallback for a dropped socket.
 */

type Notif = {
  id: string;
  agent_id: string;
  session_id: string | null;
  type: "strong_session" | "deal_closed";
  payload: { agent_name?: string | null; total?: number; band?: string; deal_value?: number | null };
  created_at: string;
  read_at: string | null;
};

function rel(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function text(n: Notif): string {
  const who = n.payload.agent_name || "A rep";
  if (n.type === "strong_session") return `${who} ran a strong session — ${n.payload.total ?? ""} points`;
  const v = n.payload.deal_value;
  return `${who} closed a deal${v ? ` ($${Number(v).toLocaleString()})` : ""}`;
}

export function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/coach/gamification/notifications");
      if (!res.ok) return;
      const d = (await res.json()) as { notifications: Notif[]; unread: number };
      setItems(d.notifications);
      setUnread(d.unread);
    } catch {
      /* offline / transient — leave the last state */
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 60_000); // fallback poll (backstop for a dropped realtime socket)
    return () => clearInterval(t);
  }, [load]);

  // Realtime (founder 2026-09-04): push new alerts instantly. Subscribe to this manager's own notification INSERTs
  // and re-fetch on each — a re-fetch (not a payload prepend) keeps the shape + unread count consistent with the
  // poll and avoids coupling to the realtime row shape. A dropped socket is fine: the poll above is the fallback.
  useEffect(() => {
    if (!supabaseEnabled) return;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        const uid = data.user?.id;
        if (cancelled || !uid) return;
        channel = supabase
          .channel(`manager-notifs:${uid}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "manager_notifications", filter: `recipient_id=eq.${uid}` },
            () => void load(),
          )
          .subscribe((status) => {
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              // eslint-disable-next-line no-console
              console.warn(`[notifications] realtime ${status} — falling back to the poll`);
            }
          });
      })
      .catch(() => {
        /* realtime unavailable → the poll covers it */
      });
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [load]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const markAllRead = useCallback(async () => {
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    try {
      await fetch("/api/coach/gamification/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      /* best-effort; the next poll reconciles */
    }
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open && unread > 0) void markAllRead();
        }}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        className="relative rounded-lg p-2 text-secondary hover:bg-white/5 hover:text-primary"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-default bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-default px-3 py-2">
            <span className="text-sm font-semibold text-primary">Notifications</span>
            {items.length > 0 && (
              <button onClick={markAllRead} className="text-xs text-muted hover:text-primary">
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted">No notifications yet.</div>
          ) : (
            items.map((n) => {
              const inner = (
                <div className={`flex items-start gap-2.5 px-3 py-2.5 ${n.read_at === null ? "bg-primary/5" : ""}`}>
                  <span className={`mt-0.5 ${n.type === "deal_closed" ? "text-emerald-500" : "text-amber-500"}`}>
                    {n.type === "deal_closed" ? <CircleDollarSign size={16} /> : <Trophy size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-primary">{text(n)}</p>
                    <p className="mt-0.5 text-xs text-muted">{rel(n.created_at)}</p>
                  </div>
                </div>
              );
              return n.session_id ? (
                <Link key={n.id} href={`/dashboard/sales-coach/${n.session_id}/after-pitch`} onClick={() => setOpen(false)} className="block border-b border-default last:border-b-0 hover:bg-white/5">
                  {inner}
                </Link>
              ) : (
                <div key={n.id} className="border-b border-default last:border-b-0">{inner}</div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
