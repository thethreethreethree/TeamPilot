"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Inbox,
  Loader2,
  MessageCircle,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { careStatusDisplay } from "@/lib/care/statusLabels";
import { priorityDisplay } from "@/lib/care/tagColors";

/**
 * /dashboard/care — Care Home.
 *
 * Snapshot of the team's support load. Shaped after Zendesk Chat's
 * Home (greeting + KPIs + queue at-a-glance + quick links). Real
 * data flows in from the inbox endpoint.
 */

type SnapshotConversation = {
  id: string;
  status: string;
  priority: string;
  subject: string | null;
  lastMessageAt: string | null;
  firstMessageAt: string | null;
  firstResponseAt: string | null;
  slaFirstResponseMinutes: number;
  customer: { name: string | null; email: string | null } | null;
};

export default function CareHomePage() {
  const [convs, setConvs] = useState<SnapshotConversation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/care/agent/inbox?enriched=1");
        if (res.status === 403) {
          setError("Care is agent-only.");
          return;
        }
        if (!res.ok) {
          setError("Couldn't load Care.");
          return;
        }
        const data = await res.json();
        setConvs(data.conversations ?? []);
      } catch {
        setError("Couldn't reach the server.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const needsResponse =
    convs?.filter((c) => c.status === "open").length ?? 0;
  const inConv = convs?.filter((c) => c.status === "in_conversation").length ?? 0;
  const awaiting =
    convs?.filter((c) => c.status === "awaiting_customer").length ?? 0;
  const resolvedToday =
    convs?.filter(
      (c) =>
        c.status === "resolved" &&
        c.lastMessageAt &&
        Date.now() - new Date(c.lastMessageAt).getTime() < 24 * 3600 * 1000
    ).length ?? 0;

  const urgent =
    convs?.filter(
      (c) =>
        c.priority === "urgent" &&
        (c.status === "open" || c.status === "in_conversation")
    ) ?? [];

  return (
    <>
      <PageHeader title="Home" subtitle="Today's pulse" />
      <div className="flex-1 overflow-y-auto bg-white/[0.01]">
        <div className="px-8 py-6 max-w-6xl mx-auto space-y-6">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              Loading…
            </div>
          )}
          {error && (
            <div className="glass-card p-4 border border-red-500/30 bg-red-500/5">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {!loading && !error && convs && (
            <>
              {/* KPI grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <KPI
                  label="Needs response"
                  value={needsResponse}
                  icon={Inbox}
                  tone="amber"
                  link="/dashboard/care/conversations?view=open"
                />
                <KPI
                  label="In conversation"
                  value={inConv}
                  icon={MessageCircle}
                  tone="arc"
                  link="/dashboard/care/conversations?view=in_conversation"
                />
                <KPI
                  label="Awaiting customer"
                  value={awaiting}
                  icon={Clock}
                  tone="violet"
                  link="/dashboard/care/conversations?view=awaiting_customer"
                />
                <KPI
                  label="Resolved today"
                  value={resolvedToday}
                  icon={UserCheck}
                  tone="emerald"
                  link="/dashboard/care/conversations?view=resolved"
                />
              </div>

              {/* Urgent queue */}
              <div className="bg-white/[0.02] border border-default rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-default flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-red-400" aria-hidden />
                    <h2 className="text-sm font-semibold text-primary">
                      Urgent right now
                    </h2>
                    <span className="text-[10px] text-muted font-mono">
                      ({urgent.length})
                    </span>
                  </div>
                  <Link
                    href="/dashboard/care/conversations"
                    className="text-[11px] text-brand hover:text-primary inline-flex items-center gap-1"
                  >
                    Open inbox <ArrowRight className="w-3 h-3" aria-hidden />
                  </Link>
                </div>
                {urgent.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted">
                    Nothing urgent. Nice.
                  </div>
                ) : (
                  <ul className="divide-y divide-default">
                    {urgent.slice(0, 5).map((c) => (
                      <UrgentRow key={c.id} conversation={c} />
                    ))}
                  </ul>
                )}
              </div>

              {/* Quick links */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <QuickLink
                  href="/dashboard/care/conversations"
                  label="Inbox"
                  body="Master-detail conversation view with filters, tags, and customer context."
                />
                <QuickLink
                  href="/dashboard/care/customers"
                  label="Customers"
                  body="Everyone who's talked to us. Profile, history, lifetime value."
                />
                <QuickLink
                  href="/dashboard/care/analytics"
                  label="Analytics"
                  body="Volume, response time, resolution rate, CSAT trends."
                />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="px-8 py-4 border-b border-default bg-base/60 backdrop-blur-sm flex items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold text-primary">{title}</h1>
        {subtitle && (
          <p className="text-[11px] text-muted">{subtitle}</p>
        )}
      </div>
    </header>
  );
}

function KPI({
  label,
  value,
  icon: Icon,
  tone,
  link,
}: {
  label: string;
  value: number;
  icon: typeof Inbox;
  tone: "amber" | "arc" | "violet" | "emerald";
  link: string;
}) {
  const tones = {
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-300",
    arc: "border-arc-400/30 bg-arc-400/5 text-arc-300",
    violet: "border-violet-500/30 bg-violet-500/5 text-violet-300",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
  };
  return (
    <Link
      href={link}
      className={`block rounded-xl border p-4 hover:scale-[1.01] transition-transform ${tones[tone]}`}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-4 h-4" aria-hidden />
        <ArrowRight className="w-3.5 h-3.5 opacity-50" aria-hidden />
      </div>
      <p className="text-2xl font-bold text-primary">{value}</p>
      <p className="text-[10px] uppercase tracking-widest font-bold mt-0.5">
        {label}
      </p>
    </Link>
  );
}

function UrgentRow({
  conversation,
}: {
  conversation: SnapshotConversation;
}) {
  const dl = careStatusDisplay(conversation.status);
  const pri = priorityDisplay(conversation.priority);
  const Icon = dl.icon;
  return (
    <li>
      <Link
        href={`/dashboard/care/conversations/${conversation.id}`}
        className="flex items-start gap-3 px-5 py-3 hover:bg-white/[0.02]"
      >
        <span
          className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0 ${dl.tone.border} ${dl.tone.bg} ${dl.tone.text}`}
        >
          <Icon className="w-3.5 h-3.5" aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className={`text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded border ${pri.tone.chip}`}
            >
              {pri.label}
            </span>
            <span className="text-[10px] text-muted">
              {conversation.customer?.email ?? "Anonymous"}
            </span>
          </div>
          <p className="text-sm text-primary truncate">
            {conversation.subject ?? "Untitled"}
          </p>
        </div>
      </Link>
    </li>
  );
}

function QuickLink({
  href,
  label,
  body,
}: {
  href: string;
  label: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="block bg-white/[0.02] border border-default rounded-xl p-4 hover:border-strong transition-colors"
    >
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-sm font-semibold text-primary">{label}</p>
        <ArrowRight className="w-3.5 h-3.5 text-muted" aria-hidden />
      </div>
      <p className="text-xs text-secondary leading-relaxed">{body}</p>
    </Link>
  );
}
