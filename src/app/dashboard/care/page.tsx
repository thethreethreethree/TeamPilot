"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, Loader2 } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { careStatusDisplay } from "@/lib/care/statusLabels";

/**
 * /dashboard/care — Care agent inbox.
 *
 * Lists every conversation in the company, sorted by most-recent
 * activity. §A18 status labels invite the agent's next move
 * (Needs first response / In conversation / Awaiting customer /
 * Resolved / Closed) instead of describing state.
 *
 * Agent-only gating: server returns 403 to non-agents, which we
 * surface as the "Care is agent-only" message. Company admins
 * (CEO/COO/admin) are implicit agents.
 */

type Conversation = {
  id: string;
  status: string;
  subject: string | null;
  assignedAgentId: string | null;
  aiResponding: boolean;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
  createdAt: string;
};

type FilterKey =
  | "all"
  | "needs_response"
  | "in_conversation"
  | "awaiting_customer"
  | "resolved";

const FILTERS: Array<{ key: FilterKey; label: string; status?: string }> = [
  { key: "needs_response", label: "Needs response", status: "open" },
  { key: "in_conversation", label: "In conversation", status: "in_conversation" },
  { key: "awaiting_customer", label: "Awaiting customer", status: "awaiting_customer" },
  { key: "resolved", label: "Resolved", status: "resolved" },
  { key: "all", label: "All" },
];

export default function CareInboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("needs_response");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/care/agent/inbox");
        if (res.status === 403) {
          setError(
            "Care is agent-only. Ask an admin to enable support access for your account."
          );
          return;
        }
        if (!res.ok) {
          setError("Couldn't load the inbox.");
          return;
        }
        const data = await res.json();
        setConversations(data.conversations ?? []);
      } catch {
        setError("Couldn't reach the server.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeFilter = FILTERS.find((f) => f.key === filter);
  const visible = activeFilter?.status
    ? conversations.filter((c) => c.status === activeFilter.status)
    : conversations;

  const countOf = (status: string) =>
    conversations.filter((c) => c.status === status).length;

  return (
    <div className="min-h-screen bg-base">
      <TopBar
        title="Care inbox"
        subtitle="Customer conversations · AI handles first response, you take over from here"
      />

      <div className="p-6 max-w-6xl mx-auto space-y-5">
        {/* Filter strip */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map((f) => {
            const count = f.status ? countOf(f.status) : conversations.length;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  active
                    ? "border-[#FACC15]/40 bg-[#FACC15]/10 text-brand"
                    : "border-default bg-surface text-secondary hover:border-strong hover:text-primary"
                }`}
              >
                {f.label}
                <span className="ml-1.5 text-[10px] font-mono text-muted">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Loading / error / empty / list */}
        {loading && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted py-10">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading conversations…
          </div>
        )}
        {error && (
          <div className="glass-card p-4 border border-red-500/30 bg-red-500/5">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="glass-card p-10 text-center">
            <Inbox className="w-6 h-6 text-muted mx-auto mb-3" aria-hidden />
            <p className="text-sm text-primary font-medium mb-1">
              No conversations in this view.
            </p>
            <p className="text-xs text-muted leading-relaxed max-w-md mx-auto">
              When a customer opens the chat widget on the site, the AI
              responds first. If it hands off, the conversation lands
              in &quot;Needs response.&quot;
            </p>
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <div className="glass-card overflow-hidden">
            <ul className="divide-y divide-default">
              {visible.map((c) => (
                <ConversationRow key={c.id} conversation={c} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const dl = careStatusDisplay(conversation.status);
  const Icon = dl.icon;
  const lastActivity = conversation.lastMessageAt ?? conversation.createdAt;
  return (
    <li>
      <Link
        href={`/dashboard/care/${conversation.id}`}
        className="block px-4 py-3 hover:bg-surface/40 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div
            className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center ${dl.tone.border} ${dl.tone.bg} ${dl.tone.text}`}
            title={dl.invites}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className={`text-[10px] uppercase tracking-widest font-bold ${dl.tone.text}`}
              >
                {dl.label}
              </span>
              {conversation.aiResponding && (
                <span className="text-[10px] text-muted font-mono">
                  · AI is responding
                </span>
              )}
            </div>
            <p className="text-sm text-primary truncate">
              {conversation.subject ?? "Untitled conversation"}
            </p>
            <p className="text-[11px] text-muted mt-0.5 font-mono">
              {formatRelative(new Date(lastActivity))}
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return date.toISOString().slice(0, 10);
}
