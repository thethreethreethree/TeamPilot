"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

/**
 * C.A.R.E notification preferences (settings pillar 3). Per-user, self-scoped via /api/me/care-notifications.
 * Today there is one C.A.R.E push event — a customer reply on a conversation you're assigned — so one toggle.
 * A34-aware: if migration 0204 isn't applied the API reports degraded and the toggle explains it's pending.
 */
export function CareNotificationsPanel() {
  const toast = useToast();
  const [customerReply, setCustomerReply] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [degraded, setDegraded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/care-notifications");
      if (res.ok) {
        const d = await res.json();
        setCustomerReply(d.customerReply !== false);
        setDegraded(!!d.degraded);
      }
    } catch {
      /* offline — leave the default; a save will surface the error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (next: boolean) => {
    if (saving) return;
    setSaving(true);
    const prev = customerReply;
    setCustomerReply(next); // optimistic
    try {
      const res = await fetch("/api/me/care-notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerReply: next }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        setCustomerReply(prev); // revert
        toast.error("Couldn't save", d?.error ?? undefined);
        return;
      }
      toast.success(
        next ? "Notifications on" : "Notifications off",
        next
          ? "You'll be notified when a customer replies to a conversation you're handling."
          : "You won't be pushed for customer replies (the inbox still shows them)."
      );
    } catch {
      setCustomerReply(prev);
      toast.error("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <Bell className="w-3.5 h-3.5 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold text-primary">Notifications</h2>
      </div>
      <p className="text-xs text-secondary leading-relaxed">
        Control which C.A.R.E events push a notification to you. These are your own preferences — they
        don&apos;t change anyone else&apos;s.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted py-3">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading…
        </div>
      ) : (
        <>
          <label className="flex items-start justify-between gap-3 rounded-lg border border-default bg-base p-3 cursor-pointer">
            <span className="min-w-0">
              <span className="block text-xs font-medium text-primary">Customer replied</span>
              <span className="block text-[11px] text-muted mt-0.5">
                Push me when a customer replies on a conversation I&apos;m assigned to, so I don&apos;t miss
                it while the dashboard is closed. Unassigned conversations never push.
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={customerReply}
              disabled={saving}
              onClick={() => void toggle(!customerReply)}
              className={`relative shrink-0 w-10 h-6 rounded-full transition-colors disabled:opacity-50 ${
                customerReply ? "bg-ember-400" : "bg-white/10"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  customerReply ? "translate-x-4" : ""
                }`}
              />
            </button>
          </label>

          {degraded && (
            <p className="text-[11px] text-yellow-700 dark:text-yellow-300">
              Saving this preference needs a pending database update (migration 0204). Until it&apos;s
              applied you&apos;ll keep receiving customer-reply notifications.
            </p>
          )}
          <p className="text-[11px] text-muted">
            Delivery also needs notifications enabled in your browser/device and the app installed for push.
          </p>
        </>
      )}
    </section>
  );
}
