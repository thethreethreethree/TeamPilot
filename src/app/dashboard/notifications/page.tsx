"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AtSign, Bell, Loader2 } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { markNotificationsRead, NOTIF_LAST_READ_KEY } from "@/lib/notifications/state";

/**
 * /dashboard/notifications — Phase 1 notifications inbox.
 *
 * Currently surfaces @mention notifications derived from
 * `mention.created` events on the §3.1 chain where the user is the
 * target_user_id. Each notification offers a deep link back to the
 * source (feedback row, smoke-test result, etc.) so the recipient
 * can act on the tag.
 *
 * Read-state is client-side localStorage for Phase 1 (timestamp of
 * the most recent notification the user has "acknowledged" by
 * visiting this page). The sidebar bell uses the same key to show
 * the unread dot. Cross-device sync ships in Phase 2 when we add
 * server-side read state.
 */

type Notification = {
  id: string;
  kind: string;
  subject: string;
  actorId: string | null;
  actorName: string;
  occurredAt: string;
  sourceKind: string | null;
  sourceId: string | null;
  excerpt: string | null;
};

function sourceLink(n: Notification): string | null {
  if (n.sourceKind === "feedback" && n.sourceId) {
    // The current user could be either an admin (sees inbox) or the
    // author (sees My feedback). Admin route has a superset view, so
    // we land there; if they're not admin the My-feedback link still
    // takes them to a known surface.
    return `/dashboard/admin/feedback`;
  }
  if (n.sourceKind === "smoke_test_result") {
    return `/dashboard/smoke-test`;
  }
  if (n.sourceKind === "task" && n.sourceId) {
    return `/dashboard/operations/${n.sourceId}`;
  }
  return null;
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) return;
        const data = (await res.json()) as { notifications: Notification[] };
        setItems(data.notifications);
        // Mark as read on visit — the latest occurredAt becomes the
        // "last seen" marker the sidebar bell compares against.
        if (data.notifications.length > 0 && data.notifications[0]) {
          markNotificationsRead(data.notifications[0].occurredAt);
        } else {
          markNotificationsRead(new Date().toISOString());
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-base">
      <TopBar
        title="Notifications"
        subtitle="Mentions and check-ins surfaced from the §3.1 chain"
      />
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted py-10">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading…
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="glass-card p-8 text-center">
            <Bell className="w-7 h-7 text-muted mx-auto mb-3" aria-hidden />
            <p className="text-sm text-primary mb-1">
              No notifications yet.
            </p>
            <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
              When a teammate @mentions you in a feedback report or a
              smoke-test note, it lands here. Mentions read from the
              chain — same source as everything else.
            </p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="space-y-2">
            {items.map((n) => {
              const link = sourceLink(n);
              const inner = (
                <div className="glass-card p-3 flex items-start gap-3 hover:border-strong transition-colors">
                  <AtSign
                    className="w-4 h-4 text-brand mt-0.5 flex-shrink-0"
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary mb-1">
                      <span className="font-semibold">{n.actorName}</span>{" "}
                      <span className="text-muted">mentioned you</span>
                      {n.sourceKind && (
                        <span className="text-muted">
                          {" "}
                          in {String(n.sourceKind).replace(/_/g, " ")}
                        </span>
                      )}
                    </p>
                    {n.excerpt && (
                      <p className="text-xs text-secondary leading-relaxed line-clamp-2">
                        {String(n.excerpt)}
                      </p>
                    )}
                    <p className="text-[10px] text-muted font-mono mt-1">
                      {new Date(n.occurredAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
              return link ? (
                <Link key={n.id} href={link} className="block">
                  {inner}
                </Link>
              ) : (
                <div key={n.id}>{inner}</div>
              );
            })}
            <p className="text-[10px] text-muted text-center font-mono mt-3">
              Read state synced locally — key:{" "}
              <code>{NOTIF_LAST_READ_KEY}</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
