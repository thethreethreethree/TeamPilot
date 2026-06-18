"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AtSign,
  Bell,
  Brain,
  CheckCircle2,
  Clock,
  ListChecks,
  MessageCircle,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { SkeletonRow } from "@/components/ui/Skeleton";
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
  taskTitle: string | null;
  role: string | null;
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
  // task.participant_added deep-links to the task surface.
  if (n.kind === "task.participant_added" && n.sourceId) {
    return `/dashboard/operations/${n.sourceId}`;
  }
  // C.A.R.E events deep-link to the conversation in the inbox.
  if (n.kind.startsWith("care.conversation.") && n.sourceId) {
    return `/dashboard/care?conversation=${n.sourceId}`;
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) {
          if (!cancelled) {
            setLoadError(
              res.status === 401
                ? "Sign in to view notifications."
                : `Could not load notifications (status ${res.status}).`
            );
          }
          return;
        }
        const data = (await res.json()) as { notifications: Notification[] };
        if (cancelled) return;
        setItems(data.notifications);
        if (data.notifications.length > 0 && data.notifications[0]) {
          markNotificationsRead(data.notifications[0].occurredAt);
        } else {
          markNotificationsRead(new Date().toISOString());
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error
              ? `Could not load notifications — ${e.message}`
              : "Could not load notifications (network error)."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <div className="min-h-screen bg-base">
      <TopBar
        title="Notifications"
        subtitle="Mentions and Decision Dialogue activity from the §3.1 chain"
      />
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        {loading && (
          <div className="glass-card overflow-hidden">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        )}

        {!loading && loadError && (
          <div className="glass-card p-5 border border-red-500/30 bg-red-500/[0.04]">
            <p className="text-sm text-red-300 mb-2">{loadError}</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="text-xs font-semibold text-ember-300 hover:text-primary border border-ember-400/40 hover:border-ember-400 px-3 py-1.5 rounded-md transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !loadError && items.length === 0 && (
          <div className="glass-card p-8 text-center">
            <Bell className="w-7 h-7 text-muted mx-auto mb-3" aria-hidden />
            <p className="text-sm text-primary mb-1">No notifications yet.</p>
            <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
              When a teammate @mentions you, adds you to a task, opens a
              Decision Dialogue in one of your topics, records a decision
              there — or a C.A.R.E customer messages you, a teammate asks
              for guidance, or a §3.5 durability check comes due — it
              lands here. Everything reads from the chain.
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
                // Non-actionable notifications get aria-disabled +
                // a subtle visual mute so they don't pretend to be
                // dead links. Previously rendered identically to
                // actionable rows. Caught in audit (Agent 2).
                <div
                  key={n.id}
                  aria-disabled="true"
                  className="opacity-70"
                  title="Informational only — no detail page yet for this event kind"
                >
                  {inner}
                </div>
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
  if (kind === "task.participant_added") {
    return (
      <div className="glass-card p-3 flex items-start gap-3 hover:border-strong transition-colors">
        <ListChecks
          className="w-4 h-4 text-brand mt-0.5 flex-shrink-0"
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-primary mb-1">
            <span className="font-semibold">{n.actorName}</span>{" "}
            <span className="text-muted">added you to a task</span>
            {n.taskTitle && (
              <>
                {": "}
                <span className="font-medium">{n.taskTitle}</span>
              </>
            )}
            {n.role && n.role !== "member" && (
              <span className="text-muted"> ({n.role})</span>
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
  // C.A.R.E notifications. Per migration 0050.
  if (kind === "care.conversation.message_added") {
    return (
      <div className="glass-card p-3 flex items-start gap-3 hover:border-strong transition-colors">
        <MessageCircle
          className="w-4 h-4 text-ember-300 mt-0.5 flex-shrink-0"
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-primary mb-1">
            <span className="font-semibold">Customer reply</span>
            {n.topicTitle && (
              <>
                {" "}
                <span className="text-muted">on</span>{" "}
                <span className="font-medium">{n.topicTitle}</span>
              </>
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
  if (kind === "care.conversation.assigned") {
    return (
      <div className="glass-card p-3 flex items-start gap-3 hover:border-strong transition-colors">
        <UserPlus
          className="w-4 h-4 text-ember-300 mt-0.5 flex-shrink-0"
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-primary mb-1">
            <span className="font-semibold">{n.actorName}</span>{" "}
            <span className="text-muted">assigned a conversation to you</span>
            {n.topicTitle && (
              <>
                {" "}
                <span className="text-muted">·</span>{" "}
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
  if (kind === "care.conversation.guidance_requested") {
    return (
      <div className="glass-card p-3 flex items-start gap-3 hover:border-strong transition-colors border-violet-500/40 bg-violet-500/[0.04]">
        <ShieldAlert
          className="w-4 h-4 text-violet-300 mt-0.5 flex-shrink-0"
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-primary mb-1">
            <span className="font-semibold">{n.actorName}</span>{" "}
            <span className="text-muted">requested supervisor guidance</span>
            {n.topicTitle && (
              <>
                {" "}
                <span className="text-muted">·</span>{" "}
                <span className="font-medium">{n.topicTitle}</span>
              </>
            )}
          </p>
          <p className="text-xs text-secondary leading-relaxed">
            Open the conversation, read the thread, and weigh in. The agent
            asked because the next move isn&apos;t obvious to them.
          </p>
          <p className="text-[10px] text-muted font-mono mt-1">
            {new Date(n.occurredAt).toLocaleString()}
          </p>
        </div>
      </div>
    );
  }
  if (kind === "care.conversation.durability_due") {
    return (
      <div className="glass-card p-3 flex items-start gap-3 hover:border-strong transition-colors">
        <Clock
          className="w-4 h-4 text-ember-300 mt-0.5 flex-shrink-0"
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-primary mb-1">
            <span className="font-semibold">Durability check due</span>
            {n.topicTitle && (
              <>
                {" "}
                <span className="text-muted">on</span>{" "}
                <span className="font-medium">{n.topicTitle}</span>
              </>
            )}
          </p>
          <p className="text-xs text-secondary leading-relaxed">
            §3.5 — 7 days have passed since you resolved this. Did the fix
            hold?
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
