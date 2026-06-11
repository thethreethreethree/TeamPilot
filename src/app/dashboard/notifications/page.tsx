"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AtSign, Bell, Brain, CheckCircle2, Loader2 } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import {
  markNotificationsRead,
  NOTIF_LAST_READ_KEY,
} from "@/lib/notifications/state";

/**
 * /dashboard/notifications — notifications inbox.
 *
 * Phase 1 source: @mention.created events targeting this user.
 * Phase 2 sources: decision.opened / decision.decided in chat topics
 * the user is an active participant of (and didn't fire themselves).
 *
 * Read-state is client-side localStorage — the timestamp of the most
 * recent notification the user has "acknowledged" by visiting this
 * page. The sidebar bell uses the same key for the unread dot.
 * Cross-device sync waits on a real read-receipts table when the §4
 * readout shows it matters.
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
  topicTitle: string | null;
  chosenPath: string | null;
};

function sourceLink(n: Notification): string | null {
  // Mention deep links.
  if (n.kind === "mention.created") {
    if (n.sourceKind === "feedback" && n.sourceId) {
      // The admin route shows the superset view; for non-admins the
      // /dashboard/feedback "My feedback" surface still resolves their
      // own report.
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
  // Decision Dialogue events deep-link straight to the topic where
  // the dialogue lives.
  if (
    (n.kind === "decision.opened" || n.kind === "decision.decided") &&
    n.sourceId
  ) {
    return `/dashboard/chats/${n.sourceId}`;
  }
  return null;
}

function describeDecisionPath(chosenPath: string | null): string {
  switch (chosenPath) {
    case "user":
      return "Went with the proposal";
    case "system":
      return "Went with the System's suggestion";
    case "hybrid":
      return "Hybrid";
    case "defer":
      return "Deferred — understanding not yet earned";
    default:
      return "Decision recorded";
  }
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
        subtitle="Mentions and Decision Dialogue activity from the §3.1 chain"
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
            <p className="text-sm text-primary mb-1">No notifications yet.</p>
            <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
              When a teammate @mentions you, opens a Decision Dialogue in
              one of your topics, or records a decision there — it lands
              here. Everything reads from the chain.
            </p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="space-y-2">
            {items.map((n) => {
              const link = sourceLink(n);
              const inner = <NotificationRow n={n} />;
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

function NotificationRow({ n }: { n: Notification }) {
  const kind = n.kind;
  if (kind === "mention.created") {
    return (
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
  }
  if (kind === "decision.opened") {
    return (
      <div className="glass-card p-3 flex items-start gap-3 hover:border-strong transition-colors">
        <Brain
          className="w-4 h-4 text-brand mt-0.5 flex-shrink-0"
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-primary mb-1">
            <span className="font-semibold">{n.actorName}</span>{" "}
            <span className="text-muted">
              opened a Decision Dialogue
            </span>
            {n.topicTitle && (
              <>
                {" "}
                <span className="text-muted">in</span>{" "}
                <span className="font-medium">{n.topicTitle}</span>
              </>
            )}
          </p>
          <p className="text-[10px] text-muted font-mono mt-1">
            {new Date(n.occurredAt).toLocaleString()}
          </p>
        </div>
      </div>
    );
  }
  if (kind === "decision.decided") {
    return (
      <div className="glass-card p-3 flex items-start gap-3 hover:border-strong transition-colors">
        <CheckCircle2
          className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0"
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-primary mb-1">
            <span className="font-semibold">{n.actorName}</span>{" "}
            <span className="text-muted">recorded a decision</span>
            {n.topicTitle && (
              <>
                {" "}
                <span className="text-muted">in</span>{" "}
                <span className="font-medium">{n.topicTitle}</span>
              </>
            )}
          </p>
          <p className="text-xs text-secondary leading-relaxed">
            {describeDecisionPath(n.chosenPath)}
          </p>
          <p className="text-[10px] text-muted font-mono mt-1">
            {new Date(n.occurredAt).toLocaleString()}
          </p>
        </div>
      </div>
    );
  }
  // Fallback — should not happen given the API filters, but keeps the
  // surface honest if a new kind lands before the UI catches up.
  return (
    <div className="glass-card p-3 flex items-start gap-3">
      <Bell className="w-4 h-4 text-muted mt-0.5 flex-shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-primary mb-1">
          <span className="font-semibold">{n.actorName}</span>{" "}
          <span className="text-muted">{n.kind}</span>
        </p>
        <p className="text-[10px] text-muted font-mono mt-1">
          {new Date(n.occurredAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
