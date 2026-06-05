"use client";

import TopBar from "@/components/layout/TopBar";
import { useToast } from "@/components/ui/toast";
import {
  postMessage,
  reviewDurability,
  togglePin,
  fetchMessages,
  fetchParticipants,
  fetchTopic,
  type ChatMessage,
  type ChatParticipant,
  type ChatTopic,
} from "@/lib/data/chats";
import { useCurrentUserId } from "@/lib/hooks/useCurrentUserId";
import {
  ArrowLeft,
  ChevronDown,
  CheckCircle2,
  CornerDownLeft,
  Crown,
  Lightbulb,
  Loader2,
  Lock,
  MessageSquare,
  Sparkles,
  UserPlus,
  Users,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

// Extracted chat surfaces — moved out of this file during the §1.7
// B2 refactor. Page is now orchestration; each modal owns its concern.
import { MessageRow } from "@/components/chats/MessageRow";
import { CloseTopicModal } from "@/components/chats/CloseTopicModal";
import { GuideMyResponseModal } from "@/components/chats/GuideMyResponseModal";
import { FormulateResponseModal } from "@/components/chats/FormulateResponseModal";
import { ReviewOutcomeModal } from "@/components/chats/ReviewOutcomeModal";
import { SummarizeModal } from "@/components/chats/SummarizeModal";
import { groupMessages, STATUS_BADGE } from "@/components/chats/utils";

export default function TeamChatTopicPage() {
  const params = useParams<{ id: string }>();
  const topicId = params.id;
  const toast = useToast();

  const [topic, setTopic] = useState<ChatTopic | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [closingOpen, setClosingOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [formulateOpen, setFormulateOpen] = useState(false);
  const [summarizeOpen, setSummarizeOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [aiAssisted, setAiAssisted] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const refresh = async () => {
    setLoading(true);
    const [t, m, p] = await Promise.all([
      fetchTopic(topicId),
      fetchMessages(topicId),
      fetchParticipants(topicId),
    ]);
    setTopic(t);
    setMessages(m);
    setParticipants(p);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // `refresh` reads stable setters; depending on it would loop every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const currentUserId = useCurrentUserId();
  const me = useMemo(
    () =>
      currentUserId
        ? participants.find((p) => p.userId === currentUserId)
        : undefined,
    [participants, currentUserId]
  );
  const iAmAdmin = me?.role === "admin";
  const isClosed = topic?.status === "closed";

  const grouped = useMemo(() => groupMessages(messages), [messages]);

  // Optimistic post — replaces the prior full-page `refresh()` (which
  // caused the skeleton flash on every send and incurred 3 round trips
  // per action). We clear the input immediately, fire the write, then
  // APPEND the server-confirmed row to local state. The §1.7 audit's
  // R2 finding motivated this; the §1.4 root cause was "always refetch"
  // being a habit, not a requirement — postMessage already returns the
  // canonical row with the correct author name resolved.
  const post = async (body: string, opts?: { aiAssisted?: boolean }) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    const aiFlag = opts?.aiAssisted ?? aiAssisted;
    // Optimistic UI: clear the input now so the user can keep typing.
    setDraft("");
    setAiAssisted(false);
    try {
      const msg = await postMessage({
        topicId,
        body: trimmed,
        aiAssisted: aiFlag,
      });
      setMessages((prev) => [...prev, msg]);
    } catch (err) {
      // Rollback the input so the user can retry without re-typing.
      setDraft(trimmed);
      setAiAssisted(aiFlag);
      toast.error(
        "Couldn't post",
        err instanceof Error ? err.message : "Unknown error."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void post(draft);
  };

  // Optimistic pin/unpin. We flip the local row immediately, then
  // reconcile to the server-confirmed value on success or roll back on
  // failure. No more full refresh — pin changes a single row, the rest
  // of the stream is unchanged. Renamed from `togglePin` to avoid
  // shadowing the imported data-layer function.
  const handleTogglePin = async (msg: ChatMessage) => {
    const previous = msg.pinned;
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, pinned: !previous } : m))
    );
    try {
      const pinned = await togglePin({ topicId, messageId: msg.id });
      // Defensive reconcile in case server result differs from our guess.
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, pinned } : m))
      );
      toast.success(
        pinned ? "Pinned" : "Unpinned",
        pinned
          ? "Added to priority data assets for the brain to learn from."
          : "Removed from priority data assets."
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, pinned: previous } : m))
      );
      toast.error(
        "Pin toggle failed",
        err instanceof Error ? err.message : "Unknown error."
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          Loading topic…
        </div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="min-h-screen bg-base">
        <TopBar title="Topic not found" subtitle="" />
        <div className="p-6 max-w-3xl mx-auto">
          <Link
            href="/dashboard/chats"
            className="inline-flex items-center gap-1.5 text-xs text-brand hover:text-primary mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to all topics
          </Link>
          <p className="text-sm text-primary">
            This topic doesn&apos;t exist or has been archived.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base flex flex-col">
      <TopBar title={topic.title} subtitle={topic.description ?? ""} />

      {/* Topic header bar */}
      <div className="border-b border-default bg-surface/50 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/dashboard/chats"
              className="text-xs text-muted hover:text-primary flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              All topics
            </Link>
            <span
              className={`text-[10px] uppercase tracking-widest font-medium px-2 py-0.5 rounded-full ${
                STATUS_BADGE[topic.status]
              }`}
            >
              {topic.status}
            </span>
            {topic.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] text-muted bg-surface-raised px-1.5 py-0.5 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowParticipants((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary border border-default hover:border-strong px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Users className="w-3 h-3" aria-hidden="true" />
              {participants.length}
              <ChevronDown className="w-3 h-3" aria-hidden="true" />
            </button>
            {/* Invite member — opens the existing invite flow on the
                Team page. Sits next to the participant pill because
                "who's in this conversation?" and "add someone to this
                conversation" are the same mental action. */}
            <Link
              href="/dashboard/team?new=1"
              title="Invite a team member"
              className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary border border-default hover:border-strong px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <UserPlus className="w-3 h-3" aria-hidden="true" />
              Invite
            </Link>
            {/* Summarize is available to any participant — the summary
                is framed as the System's read for confirm-or-correct
                (§3.3), so democratizing it serves the discipline. Only
                offered once there are ≥2 messages to summarize. */}
            {messages.filter((m) => m.kind === "message").length >= 2 && (
              <button
                onClick={() => setSummarizeOpen(true)}
                className="flex items-center gap-1.5 text-xs text-arc-300 hover:text-arc-200 border border-arc-400/40 hover:border-arc-400/70 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                Summarize
              </button>
            )}
            {iAmAdmin && !isClosed && (
              <button
                onClick={() => setClosingOpen(true)}
                className="flex items-center gap-1.5 text-xs text-accent-text hover:text-accent-text border border-gold-400/40 hover:border-gold-400/70 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <Lock className="w-3 h-3" aria-hidden="true" />
                Close topic
              </button>
            )}
          </div>
        </div>
        {showParticipants && (
          <div className="max-w-5xl mx-auto mt-3 pt-3 border-t border-default">
            <p className="text-[10px] text-muted uppercase tracking-widest mb-2">
              Participants
            </p>
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <div
                  key={p.userId}
                  className="flex items-center gap-2 bg-surface-raised border border-default rounded-full px-3 py-1"
                >
                  {p.role === "admin" && (
                    <Crown
                      className="w-3 h-3 text-accent-text"
                      aria-hidden="true"
                    />
                  )}
                  <span className="text-xs text-primary">{p.name}</span>
                  <span className="text-[10px] text-muted font-mono">
                    {p.messageCount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Closed banner — surfaces the close summary and, if the reviewer
          has set §3.5 close_durability, the consequence label. When
          durability has not yet been recorded (or is "unknown"), the
          admin can click Review outcome to record it; that update
          fires the chat.topic_durability_reviewed event which derives
          the appropriate consequence signal. */}
      {isClosed && topic.closeSummary && (
        <div className="max-w-5xl mx-auto w-full px-6 mt-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-gold-400/5 border border-gold-400/30">
            <CheckCircle2
              className="w-4 h-4 text-accent-text mt-0.5 flex-shrink-0"
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="text-xs text-accent-text font-medium mb-1">
                Topic closed{" "}
                {topic.closeDurability && (
                  <span className="text-accent-text/70">
                    · outcome: {topic.closeDurability}
                  </span>
                )}
              </p>
              {/* The close summary is body content (the WHY of the closure)
                  — it must be readable, not branded. text-primary keeps
                  legibility in both modes; the gold accent stays on the
                  label above. */}
              <p className="text-xs text-primary leading-relaxed">
                {topic.closeSummary}
              </p>
            </div>
            {iAmAdmin &&
              (topic.closeDurability === null ||
                topic.closeDurability === "unknown") && (
                <button
                  onClick={() => setReviewOpen(true)}
                  className="flex-shrink-0 self-start flex items-center gap-1.5 text-[11px] text-accent-text hover:text-accent-text border border-gold-400/40 hover:border-gold-400/70 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <Sparkles className="w-3 h-3" aria-hidden="true" />
                  Review outcome
                </button>
              )}
            {iAmAdmin &&
              topic.closeDurability &&
              topic.closeDurability !== "unknown" && (
                <button
                  onClick={() => setReviewOpen(true)}
                  className="flex-shrink-0 self-start text-[11px] text-accent-text underline underline-offset-2"
                  title="Change the outcome label if new evidence makes the prior judgement wrong. Both judgements stay on the §3.1 record."
                >
                  Update
                </button>
              )}
          </div>
        </div>
      )}

      {/* Message stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-6 max-w-5xl mx-auto w-full"
      >
        {grouped.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare
              className="w-8 h-8 text-secondary mx-auto mb-3"
              aria-hidden="true"
            />
            <p className="text-sm text-primary mb-1">
              The conversation starts with you.
            </p>
            <p className="text-xs text-muted max-w-md mx-auto">
              State the situation, ask the first question, share what you know.
              Everything from here gets captured and structured.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map((group) => (
              <div key={group.dateKey}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-surface-raised" />
                  <span className="text-[10px] uppercase tracking-widest text-muted font-mono">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-surface-raised" />
                </div>
                <div className="space-y-3">
                  {group.messages.map((msg) => (
                    <MessageRow
                      key={msg.id}
                      msg={msg}
                      currentUserId={currentUserId}
                      onTogglePin={() => void handleTogglePin(msg)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      {!isClosed && (
        <div className="border-t border-default bg-surface/50 px-6 py-4">
          <form
            onSubmit={handleSubmit}
            className="max-w-5xl mx-auto"
          >
            <div className="bg-surface border border-default rounded-xl focus-within:border-crimson-500/40 transition-colors">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write your message…"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                className="w-full bg-transparent text-sm text-primary placeholder:text-muted px-4 py-3 focus:outline-none resize-none"
              />
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-default">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setGuideOpen(true)}
                    disabled={!draft.trim()}
                    className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary disabled:opacity-30 border border-default hover:border-arc-400/50 px-2.5 py-1.5 rounded-lg transition-colors"
                    title="Have the System sharpen your draft before you send it"
                  >
                    <Wand2 className="w-3 h-3" aria-hidden="true" />
                    Guide my response
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormulateOpen(true)}
                    className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary border border-default hover:border-arc-400/50 px-2.5 py-1.5 rounded-lg transition-colors"
                    title="Get help formulating a fuller response by answering questions first"
                  >
                    <Lightbulb className="w-3 h-3" aria-hidden="true" />
                    Help me formulate
                  </button>
                  {aiAssisted && (
                    <span className="flex items-center gap-1 text-[10px] text-arc-300">
                      <Sparkles className="w-3 h-3" aria-hidden="true" />
                      AI-assisted
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-secondary font-mono">
                    {draft.length > 0 ? `${draft.length} chars` : ""}
                  </span>
                  <button
                    type="submit"
                    disabled={!draft.trim() || submitting}
                    className="flex items-center gap-1.5 bg-crimson-500 hover:bg-crimson-600 disabled:opacity-40 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors text-xs"
                  >
                    Send
                    <CornerDownLeft className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-secondary mt-2 px-1">
              Enter to send · Shift+Enter for new line · Pin important messages
              to make them priority data the brain learns from
            </p>
          </form>
        </div>
      )}

      {/* Modals */}
      {closingOpen && (
        <CloseTopicModal
          topic={topic}
          onClose={() => setClosingOpen(false)}
          onClosed={() => {
            setClosingOpen(false);
            toast.success(
              "Topic closed",
              "The resolution is now part of the company's record."
            );
            void refresh();
          }}
        />
      )}

      {guideOpen && (
        <GuideMyResponseModal
          draft={draft}
          topic={topic}
          recent={messages}
          onClose={() => setGuideOpen(false)}
          onAccept={(revised) => {
            setDraft(revised);
            setAiAssisted(true);
            setGuideOpen(false);
            inputRef.current?.focus();
            toast.info(
              "Draft updated",
              "Your message is marked AI-assisted when you send it."
            );
          }}
        />
      )}

      {formulateOpen && (
        <FormulateResponseModal
          topic={topic}
          recent={messages}
          onClose={() => setFormulateOpen(false)}
          onCompose={(composed) => {
            setDraft(composed);
            setAiAssisted(true);
            setFormulateOpen(false);
            inputRef.current?.focus();
            toast.info("Draft prepared", "Review and adjust before sending.");
          }}
        />
      )}

      {reviewOpen && (
        <ReviewOutcomeModal
          topic={topic}
          onClose={() => setReviewOpen(false)}
          onReviewed={async (durability) => {
            try {
              await reviewDurability({ topicId: topic.id, durability });
              setReviewOpen(false);
              toast.success(
                "Outcome recorded",
                durability === "unknown"
                  ? "Marked as 'not yet measurable' — no signal fires until you set a real outcome."
                  : `'${durability}' is now on the record. The §3.5 signal has been derived.`
              );
              void refresh();
            } catch (err) {
              toast.error(
                "Couldn't record outcome",
                err instanceof Error ? err.message : "Unknown error."
              );
            }
          }}
        />
      )}

      {summarizeOpen && (
        <SummarizeModal
          topic={topic}
          messages={messages}
          onClose={() => setSummarizeOpen(false)}
          onPost={async (text) => {
            try {
              const msg = await postMessage({
                topicId: topic.id,
                body: text,
                kind: "summary",
              });
              setMessages((prev) => [...prev, msg]);
              setSummarizeOpen(false);
              toast.success(
                "Summary posted",
                "It's on the record — confirm or correct in-thread."
              );
            } catch (err) {
              toast.error(
                "Couldn't post summary",
                err instanceof Error ? err.message : "Unknown error."
              );
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Message rendering ───────────────────────────────────────
