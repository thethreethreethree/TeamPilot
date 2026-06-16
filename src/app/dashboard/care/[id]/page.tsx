"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Lock,
  MessageSquare,
  Send,
  Sparkles,
  StickyNote,
  UserCheck,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useToast } from "@/components/ui/toast";
import { careStatusDisplay } from "@/lib/care/statusLabels";

/**
 * /dashboard/care/[id] — single conversation view for the agent.
 *
 * What an agent does here:
 *   - Read the full thread (customer + AI + agent + internal notes)
 *   - Claim the conversation (assigns themselves, flips AI off)
 *   - Reply (public message to customer) or add internal note
 *   - Transition status: resolved / closed (auto-transitions to
 *     awaiting_customer on agent reply via the trigger from 0034)
 */

type Conversation = {
  id: string;
  companyId: string;
  customerId: string | null;
  status: string;
  assignedAgentId: string | null;
  aiResponding: boolean;
  subject: string | null;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

type Message = {
  id: string;
  authorType: "customer" | "ai" | "agent" | "system";
  authorId: string | null;
  body: string;
  isInternalNote: boolean;
  createdAt: string;
};

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const id = String((params as { id?: string })?.id ?? "");

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/care/agent/conversations/${id}`);
      if (res.status === 403) {
        setError("Care is agent-only.");
        return;
      }
      if (!res.ok) {
        setError("Couldn't load the conversation.");
        return;
      }
      const data = await res.json();
      setConversation(data.conversation);
      setMessages(data.messages ?? []);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const claim = async () => {
    setActing(true);
    try {
      const res = await fetch(`/api/care/agent/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim" }),
      });
      if (!res.ok) {
        toast.error("Couldn't claim", "Try again.");
        return;
      }
      toast.success(
        "Claimed.",
        "AI is paused for this conversation; you're the responder."
      );
      await load();
    } finally {
      setActing(false);
    }
  };

  const changeStatus = async (
    next: "in_conversation" | "awaiting_customer" | "resolved" | "closed"
  ) => {
    setActing(true);
    try {
      const res = await fetch(`/api/care/agent/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", status: next }),
      });
      if (!res.ok) {
        toast.error("Couldn't update status");
        return;
      }
      toast.success(`Marked as ${careStatusDisplay(next).label}`);
      await load();
    } finally {
      setActing(false);
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await fetch(
        `/api/care/agent/conversations/${id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, isInternalNote }),
        }
      );
      if (!res.ok) {
        toast.error("Couldn't send");
        return;
      }
      setDraft("");
      await load();
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base">
        <TopBar title="Conversation" subtitle="Loading…" />
        <div className="flex items-center justify-center gap-2 text-xs text-muted py-20">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          Loading…
        </div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="min-h-screen bg-base">
        <TopBar title="Conversation" />
        <div className="p-6 max-w-2xl mx-auto">
          <div className="glass-card p-6 border border-red-500/30 bg-red-500/5">
            <p className="text-sm text-red-300">
              {error ?? "Conversation not found."}
            </p>
            <button
              type="button"
              onClick={() => router.push("/dashboard/care")}
              className="mt-3 text-xs text-brand underline"
            >
              ← Back to inbox
            </button>
          </div>
        </div>
      </div>
    );
  }

  const dl = careStatusDisplay(conversation.status);
  const Icon = dl.icon;

  return (
    <div className="h-screen bg-base flex flex-col">
      <TopBar
        title={conversation.subject ?? "Conversation"}
        subtitle={`Customer support · ${dl.label}`}
      />

      {/* Header strip with status + actions */}
      <div className="border-b border-default bg-surface/40 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/care"
              className="text-xs text-muted hover:text-primary flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
              Inbox
            </Link>
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full border ${dl.tone.border} ${dl.tone.bg} ${dl.tone.text}`}
              title={dl.invites}
            >
              <Icon className="w-3 h-3" aria-hidden />
              {dl.label}
            </span>
            {conversation.aiResponding && (
              <span className="inline-flex items-center gap-1 text-[10px] text-arc-300">
                <Sparkles className="w-3 h-3" aria-hidden />
                AI responding
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {conversation.aiResponding && (
              <button
                type="button"
                onClick={() => void claim()}
                disabled={acting}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand bg-[#FACC15]/10 border border-[#FACC15]/40 hover:border-[#FACC15]/70 hover:bg-[#FACC15]/15 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" aria-hidden />
                Take over
              </button>
            )}
            {conversation.status !== "resolved" &&
              conversation.status !== "closed" && (
                <button
                  type="button"
                  onClick={() => void changeStatus("resolved")}
                  disabled={acting}
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-300 border border-emerald-500/40 hover:border-emerald-500/70 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
                  Resolve
                </button>
              )}
            {conversation.status !== "closed" && (
              <button
                type="button"
                onClick={() => void changeStatus("closed")}
                disabled={acting}
                className="inline-flex items-center gap-1.5 text-xs text-muted border border-default hover:border-strong disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Lock className="w-3.5 h-3.5" aria-hidden />
                Close
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Message stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-6"
      >
        <div className="max-w-4xl mx-auto space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare
                className="w-6 h-6 text-muted mx-auto mb-2"
                aria-hidden
              />
              <p className="text-sm text-muted">No messages yet.</p>
            </div>
          ) : (
            messages.map((m) => <AgentMessageRow key={m.id} message={m} />)
          )}
        </div>
      </div>

      {/* Composer */}
      {conversation.status !== "closed" && (
        <div className="border-t border-default bg-surface/30 px-6 py-3">
          <div className="max-w-4xl mx-auto">
            {/* Mode toggle: reply vs internal note */}
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setIsInternalNote(false)}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                  !isInternalNote
                    ? "text-brand border-[#FACC15]/40 bg-[#FACC15]/10"
                    : "text-muted border-default hover:border-strong"
                }`}
              >
                Reply to customer
              </button>
              <button
                type="button"
                onClick={() => setIsInternalNote(true)}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                  isInternalNote
                    ? "text-accent-text border-accent-text/40 bg-accent-text/10"
                    : "text-muted border-default hover:border-strong"
                }`}
              >
                <StickyNote className="w-3 h-3" aria-hidden />
                Internal note
              </button>
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={
                  isInternalNote
                    ? "Internal note — agent-only, customer never sees this…"
                    : "Type your reply…"
                }
                rows={3}
                disabled={sending}
                className={`flex-1 min-w-0 bg-base border rounded-lg px-3 py-2 text-sm leading-relaxed text-primary placeholder:text-muted focus:outline-none resize-y ${
                  isInternalNote
                    ? "border-accent-text/30 focus:border-accent-text/50"
                    : "border-default focus:border-strong"
                }`}
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || !draft.trim()}
                className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-40 disabled:cursor-not-allowed text-[#09090B] px-3 py-2 rounded-lg transition-colors"
              >
                {sending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Send
              </button>
            </div>
            <p className="text-[10px] text-muted mt-1.5">
              Cmd/Ctrl+Enter to send · {isInternalNote ? "Note stays internal." : "Customer sees this on their widget."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function AgentMessageRow({ message }: { message: Message }) {
  const isCustomer = message.authorType === "customer";
  const isAi = message.authorType === "ai";
  const isAgent = message.authorType === "agent";
  const isSystem = message.authorType === "system";
  const isNote = message.isInternalNote;

  if (isSystem) {
    return (
      <div className="text-center text-[10px] text-muted italic py-1">
        {message.body}
      </div>
    );
  }

  const speaker = isCustomer
    ? "Customer"
    : isAi
      ? "AI"
      : isAgent
        ? "Agent"
        : "System";

  const tone = isNote
    ? "border-accent-text/30 bg-accent-text/[0.04]"
    : isCustomer
      ? "border-default bg-surface/40"
      : isAi
        ? "border-arc-400/30 bg-arc-400/[0.04]"
        : "border-[#FACC15]/30 bg-[#FACC15]/[0.04]";

  return (
    <div className={`rounded-lg border p-3 ${tone}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] uppercase tracking-widest font-bold text-muted">
          {speaker}
        </span>
        {isNote && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-accent-text">
            <StickyNote className="w-2.5 h-2.5" aria-hidden /> Internal note
          </span>
        )}
        <span className="text-[10px] text-muted font-mono ml-auto">
          {new Date(message.createdAt).toLocaleString()}
        </span>
      </div>
      <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap">
        {message.body}
      </p>
    </div>
  );
}
