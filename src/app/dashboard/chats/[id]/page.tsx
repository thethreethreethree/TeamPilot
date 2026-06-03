"use client";

import TopBar from "@/components/layout/TopBar";
import Modal from "@/components/ui/Modal";
import { Field, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/toast";
import {
  demoCloseTopic,
  demoPostMessage,
  demoTogglePin,
  demoUserId,
  fetchMessages,
  fetchParticipants,
  fetchTopic,
  type ChatMessage,
  type ChatParticipant,
  type ChatTopic,
} from "@/lib/data/chats";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CornerDownLeft,
  Crown,
  HelpCircle,
  Lightbulb,
  Loader2,
  Lock,
  MessageSquare,
  Pin,
  PinOff,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSseStream } from "@/lib/hooks/useSseStream";

const STATUS_BADGE: Record<string, string> = {
  open: "bg-surface-raised text-active-text border border-[#5EC8E0]/30",
  closed: "bg-gold-400/15 text-gold-300 border border-gold-400/40",
  archived: "bg-surface-raised text-muted border border-default",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateHeader(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

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

  const me = useMemo(
    () => participants.find((p) => p.userId === demoUserId()),
    [participants]
  );
  const iAmAdmin = me?.role === "admin";
  const isClosed = topic?.status === "closed";

  const grouped = useMemo(() => groupMessages(messages), [messages]);

  const post = (body: string, opts?: { aiAssisted?: boolean }) => {
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      demoPostMessage({
        topicId,
        body: body.trim(),
        aiAssisted: opts?.aiAssisted ?? aiAssisted,
      });
      setDraft("");
      setAiAssisted(false);
      void refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    post(draft);
  };

  const togglePin = (msg: ChatMessage) => {
    const pinned = demoTogglePin({ topicId, messageId: msg.id });
    toast.success(
      pinned ? "Pinned" : "Unpinned",
      pinned
        ? "Added to priority data assets for the brain to learn from."
        : "Removed from priority data assets."
    );
    void refresh();
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
            {iAmAdmin && !isClosed && (
              <button
                onClick={() => setClosingOpen(true)}
                className="flex items-center gap-1.5 text-xs text-gold-300 hover:text-gold-200 border border-gold-400/40 hover:border-gold-400/70 px-2.5 py-1.5 rounded-lg transition-colors"
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
                      className="w-3 h-3 text-gold-300"
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

      {/* Closed banner */}
      {isClosed && topic.closeSummary && (
        <div className="max-w-5xl mx-auto w-full px-6 mt-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-gold-400/5 border border-gold-400/30">
            <CheckCircle2
              className="w-4 h-4 text-gold-300 mt-0.5 flex-shrink-0"
              aria-hidden="true"
            />
            <div>
              <p className="text-xs text-gold-200 font-medium mb-1">
                Topic closed{" "}
                {topic.closeDurability && (
                  <span className="text-gold-300/70">
                    · outcome: {topic.closeDurability}
                  </span>
                )}
              </p>
              <p className="text-xs text-gold-100/80 leading-relaxed">
                {topic.closeSummary}
              </p>
            </div>
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
                      onTogglePin={() => togglePin(msg)}
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
                    className="flex items-center gap-1.5 bg-crimson-500 hover:bg-crimson-600 disabled:opacity-40 text-primary font-semibold px-3 py-1.5 rounded-lg transition-colors text-xs"
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

      {summarizeOpen && (
        <SummarizeModal
          topic={topic}
          messages={messages}
          onClose={() => setSummarizeOpen(false)}
          onPost={(text) => {
            const msg = demoPostMessage({
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
          }}
        />
      )}
    </div>
  );
}

// ─── Message rendering ───────────────────────────────────────

interface MessageGroup {
  dateKey: string;
  label: string;
  messages: ChatMessage[];
}

function groupMessages(msgs: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const m of msgs) {
    const dateKey = m.createdAt.slice(0, 10);
    let g = groups[groups.length - 1];
    if (!g || g.dateKey !== dateKey) {
      g = { dateKey, label: formatDateHeader(m.createdAt), messages: [] };
      groups.push(g);
    }
    g.messages.push(m);
  }
  return groups;
}

function MessageRow({
  msg,
  onTogglePin,
}: {
  msg: ChatMessage;
  onTogglePin: () => void;
}) {
  const isSummary = msg.kind === "summary";
  const isSystem = msg.kind === "system";
  const isMine = msg.authorId === demoUserId();
  const initials = (msg.authorName ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (isSystem) {
    return (
      <div className="flex items-center gap-2 justify-center py-2">
        <div className="h-px flex-1 bg-surface-raised max-w-16" />
        <span className="text-[10px] text-muted italic">{msg.body}</span>
        <div className="h-px flex-1 bg-surface-raised max-w-16" />
      </div>
    );
  }

  if (isSummary) {
    return (
      <div className="flex gap-3 group">
        <div className="w-8 h-8 rounded-lg bg-arc-400/15 border border-arc-400/40 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-arc-300" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-arc-300">
              System summary
            </span>
            <span className="text-[10px] text-secondary font-mono">
              {formatTime(msg.createdAt)}
            </span>
            <span className="text-[10px] text-secondary italic">
              · the System&apos;s read — confirm or correct
            </span>
          </div>
          <div className="bg-arc-400/5 border border-arc-400/20 rounded-xl px-3 py-2">
            <p className="text-sm text-primary whitespace-pre-wrap leading-relaxed">
              {msg.body}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 group">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
          isMine
            ? "bg-gradient-to-br from-crimson-400 to-crimson-700 text-white"
            : "bg-surface-raised border border-default text-primary"
        }`}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-primary">
            {msg.authorName}
          </span>
          <span className="text-[10px] text-secondary font-mono">
            {formatTime(msg.createdAt)}
          </span>
          {msg.aiAssisted && (
            <span
              className="flex items-center gap-0.5 text-[10px] text-arc-300"
              title="The author used the System to sharpen this message"
            >
              <Sparkles className="w-2.5 h-2.5" aria-hidden="true" />
              AI-assisted
            </span>
          )}
          {msg.pinned && (
            <span
              className="flex items-center gap-0.5 text-[10px] text-gold-300"
              title="Pinned to priority data assets"
            >
              <Pin className="w-2.5 h-2.5" aria-hidden="true" />
              Pinned
            </span>
          )}
        </div>
        <div
          className={`relative rounded-xl px-3 py-2 ${
            msg.pinned
              ? "bg-gold-400/5 border border-gold-400/20"
              : "bg-surface/60 border border-default"
          }`}
        >
          <p className="text-sm text-primary whitespace-pre-wrap leading-relaxed pr-7">
            {msg.body}
          </p>
          <button
            onClick={onTogglePin}
            aria-label={msg.pinned ? "Unpin message" : "Pin message"}
            title={
              msg.pinned
                ? "Remove from priority data"
                : "Pin as priority data — the brain learns from pinned messages"
            }
            className="absolute top-2 right-2 text-muted hover:text-gold-300 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {msg.pinned ? (
              <PinOff className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Pin className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modals ─────────────────────────────────────────────────

function CloseTopicModal({
  topic,
  onClose,
  onClosed,
}: {
  topic: ChatTopic;
  onClose: () => void;
  onClosed: () => void;
}) {
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = () => {
    if (summary.trim().length < 20) return;
    setSubmitting(true);
    const ok = demoCloseTopic({
      topicId: topic.id,
      summary: summary.trim(),
    });
    setSubmitting(false);
    if (ok) onClosed();
  };

  return (
    <Modal open onClose={onClose} title={`Close topic: ${topic.title}`} size="lg">
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gold-400/5 border border-gold-400/20">
          <ShieldCheck
            className="w-4 h-4 text-gold-300 mt-0.5 flex-shrink-0"
            aria-hidden="true"
          />
          <p className="text-xs text-gold-100 leading-relaxed">
            Closing a topic creates a permanent resolution record. The
            conversation history stays accessible, and the System uses it to
            help with similar topics later. If this is linked to a problem,
            closing here also marks the problem resolved.
          </p>
        </div>
        <Field label="What was decided / resolved? (≥20 chars)" required>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            placeholder="Plain language. What was actually concluded? What was the call?"
            autoFocus
          />
        </Field>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="text-xs text-muted hover:text-primary px-3 py-2"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || summary.trim().length < 20}
            className="flex items-center gap-2 bg-gold-400 hover:bg-gold-500 disabled:opacity-40 text-navy-900 font-semibold px-4 py-2 rounded-lg transition-colors text-xs"
          >
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            {submitting ? "Closing…" : "Close topic"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function GuideMyResponseModal({
  draft,
  topic,
  recent,
  onClose,
  onAccept,
}: {
  draft: string;
  topic: ChatTopic;
  recent: ChatMessage[];
  onClose: () => void;
  onAccept: (revised: string) => void;
}) {
  // Streams a sharpened version from POST /api/chat/guide — see the route
  // for the §3.3 discipline (no overtaking; the model produces a
  // suggestion in the user's voice that the user accepts or discards).
  const { status, run, abort } = useSseStream();
  const recentPayload = useMemo(
    () =>
      recent.slice(-6).map((m) => ({
        author: m.authorName,
        content: m.body ?? "",
      })),
    [recent]
  );

  // Auto-start on mount — the user opened this expecting an answer; an
  // extra "Generate" button would be friction with no purpose.
  useEffect(() => {
    if (draft.trim().length === 0) return;
    run("/api/chat/guide", {
      draft,
      topic: { title: topic.title, description: topic.description },
      recent: recentPayload,
    });
    return () => abort();
    // Intentionally only on mount — re-running on draft change would
    // surprise the user mid-stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suggestion = status.text;
  const streaming = status.state === "streaming";
  const suppressed = status.state === "suppressed";
  const errored = status.state === "error";
  const ready = status.state === "done" && suggestion.trim().length > 0;

  return (
    <Modal open onClose={onClose} title="Sharpen your response" size="lg">
      <div className="space-y-3">
        <p className="text-xs text-muted leading-relaxed">
          The System offers a sharper version of your draft. Accept, edit, or
          close and send your original — the discipline (§3.3): the System
          never decides for you. It surfaces a refinement; you decide.
        </p>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted mb-1.5">
            Your draft
          </p>
          <div className="bg-surface border border-default rounded-lg px-3 py-2 text-sm text-primary whitespace-pre-wrap">
            {draft || "(empty)"}
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-arc-300 mb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" aria-hidden="true" />
            System&apos;s suggestion
            {streaming && (
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            )}
          </p>
          <div className="bg-arc-400/5 border border-arc-400/30 rounded-lg px-3 py-2 text-sm text-primary whitespace-pre-wrap min-h-[3rem]">
            {suggestion || (streaming ? "…" : "(waiting)")}
            {streaming && (
              <span className="cursor-blink ml-0.5" aria-hidden="true" />
            )}
          </div>
          {suppressed && (
            <p className="text-[10px] text-gold-300 mt-1.5">
              Guidance suppressed (§3.4 control window): {"reason" in status ? status.reason : ""}
            </p>
          )}
          {errored && (
            <p className="text-[10px] text-red-400 mt-1.5">
              {"error" in status ? status.error : "Stream failed."}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between pt-2">
          <p className="text-[10px] text-secondary italic">
            Streamed via DeepSeek through the brain layer.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs text-muted hover:text-primary px-3 py-2"
            >
              Send my original
            </button>
            <button
              onClick={() => onAccept(suggestion)}
              disabled={!ready}
              className="flex items-center gap-2 bg-arc-400 hover:bg-arc-500 disabled:opacity-40 disabled:cursor-not-allowed text-navy-900 font-semibold px-4 py-2 rounded-lg transition-colors text-xs"
            >
              Use the suggestion
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function FormulateResponseModal({
  topic,
  recent,
  onClose,
  onCompose,
}: {
  topic: ChatTopic;
  recent: ChatMessage[];
  onClose: () => void;
  onCompose: (composed: string) => void;
}) {
  const QUESTIONS = [
    "What is your read of what the conversation is actually about?",
    "What outcome would you consider a success here?",
    "What concern or risk is not yet being named?",
  ];
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const { status, run, abort, reset } = useSseStream();
  const recentPayload = useMemo(
    () =>
      recent.slice(-6).map((m) => ({
        author: m.authorName,
        content: m.body ?? "",
      })),
    [recent]
  );

  const ready = answers.every((a) => a.trim().length >= 10);
  const streaming = status.state === "streaming";
  const suppressed = status.state === "suppressed";
  const errored = status.state === "error";
  const haveDraft =
    (status.state === "done" || status.state === "streaming") &&
    status.text.trim().length > 0;
  const composedReady = status.state === "done" && status.text.trim().length > 0;

  const compose = () =>
    run("/api/chat/formulate", {
      answers,
      topic: { title: topic.title, description: topic.description },
      recent: recentPayload,
    });

  // Abort any in-flight stream when the modal unmounts.
  useEffect(() => () => abort(), [abort]);

  return (
    <Modal open onClose={onClose} title="Formulate a fuller response" size="xl">
      <div className="space-y-3">
        <p className="text-xs text-muted leading-relaxed">
          Three short prompts. Your answers ground the System&apos;s draft in
          YOUR read of the conversation. The draft that comes back is a
          starting point — edit it before sending.
        </p>
        {QUESTIONS.map((q, i) => (
          <Field key={i} label={`${i + 1}. ${q}`} required>
            <Textarea
              value={answers[i]}
              onChange={(e) => {
                const next = [...answers];
                next[i] = e.target.value;
                setAnswers(next);
              }}
              rows={3}
              placeholder="Plain language — what you actually think."
              disabled={streaming}
            />
          </Field>
        ))}

        {haveDraft && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-arc-300 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              Draft built from your answers
              {streaming && (
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              )}
            </p>
            <div className="bg-arc-400/5 border border-arc-400/30 rounded-lg px-3 py-2 text-sm text-primary whitespace-pre-wrap min-h-[3rem]">
              {status.text}
              {streaming && (
                <span className="cursor-blink ml-0.5" aria-hidden="true" />
              )}
            </div>
          </div>
        )}
        {suppressed && (
          <p className="text-[10px] text-gold-300">
            Guidance suppressed (§3.4 control window): {"reason" in status ? status.reason : ""}
          </p>
        )}
        {errored && (
          <p className="text-[10px] text-red-400">
            {"error" in status ? status.error : "Stream failed."}
          </p>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-[10px] text-secondary italic flex items-center gap-1.5">
            <HelpCircle className="w-3 h-3" aria-hidden="true" />
            Streamed via DeepSeek through the brain layer.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs text-muted hover:text-primary px-3 py-2"
            >
              Cancel
            </button>
            {composedReady ? (
              <>
                <button
                  onClick={reset}
                  className="text-xs text-muted hover:text-primary px-3 py-2"
                >
                  Re-compose
                </button>
                <button
                  onClick={() => onCompose(status.text.trim())}
                  className="flex items-center gap-2 bg-arc-400 hover:bg-arc-500 text-navy-900 font-semibold px-4 py-2 rounded-lg transition-colors text-xs"
                >
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  Use this draft
                </button>
              </>
            ) : (
              <button
                onClick={compose}
                disabled={!ready || streaming}
                className="flex items-center gap-2 bg-arc-400 hover:bg-arc-500 disabled:opacity-40 disabled:cursor-not-allowed text-navy-900 font-semibold px-4 py-2 rounded-lg transition-colors text-xs"
              >
                {streaming ? (
                  <>
                    <Loader2
                      className="w-3.5 h-3.5 animate-spin"
                      aria-hidden="true"
                    />
                    Composing…
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" aria-hidden="true" />
                    Compose draft
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Summarize the conversation so far ─────────────────────────
//
// Per §3.3, the summary is explicitly framed in the prompt as "the
// System's read — confirm or correct." The user can choose to post
// it back into the conversation as a kind="summary" message (which
// the existing renderer styles distinctly), or close without posting.

function SummarizeModal({
  topic,
  messages,
  onClose,
  onPost,
}: {
  topic: ChatTopic;
  messages: ChatMessage[];
  onClose: () => void;
  onPost: (text: string) => void;
}) {
  const { status, run, abort } = useSseStream();
  const payload = useMemo(
    () => ({
      topic: { title: topic.title, description: topic.description },
      messages: messages
        .filter((m) => m.kind === "message" && m.body)
        .map((m) => ({
          author: m.authorName,
          content: m.body ?? "",
          createdAt: m.createdAt,
        })),
    }),
    [topic, messages]
  );

  useEffect(() => {
    run("/api/chat/summarize", payload);
    return () => abort();
    // Intentionally only on mount — the user opened this expecting an
    // immediate read; re-running would surprise mid-stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const streaming = status.state === "streaming";
  const suppressed = status.state === "suppressed";
  const errored = status.state === "error";
  const ready = status.state === "done" && status.text.trim().length > 0;

  return (
    <Modal open onClose={onClose} title="Summarize the conversation" size="xl">
      <div className="space-y-3">
        <p className="text-xs text-muted leading-relaxed">
          What follows is the System&apos;s read — confirm, correct, or
          replace it. Posting it back to the conversation puts it on the
          record as the team&apos;s current understanding (§3.3).
        </p>
        <div className="bg-arc-400/5 border border-arc-400/30 rounded-lg px-3 py-2 text-sm text-primary whitespace-pre-wrap min-h-[6rem]">
          {status.text || (streaming ? "…" : "(waiting)")}
          {streaming && (
            <span className="cursor-blink ml-0.5" aria-hidden="true" />
          )}
        </div>
        {suppressed && (
          <p className="text-[10px] text-gold-300">
            Guidance suppressed (§3.4 control window): {"reason" in status ? status.reason : ""}
          </p>
        )}
        {errored && (
          <p className="text-[10px] text-red-400">
            {"error" in status ? status.error : "Stream failed."}
          </p>
        )}
        <div className="flex items-center justify-between pt-2">
          <p className="text-[10px] text-secondary italic">
            Streamed via DeepSeek through the brain layer.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs text-muted hover:text-primary px-3 py-2"
            >
              Discard
            </button>
            <button
              onClick={() => onPost(status.text.trim())}
              disabled={!ready}
              className="flex items-center gap-2 bg-arc-400 hover:bg-arc-500 disabled:opacity-40 disabled:cursor-not-allowed text-navy-900 font-semibold px-4 py-2 rounded-lg transition-colors text-xs"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              Post to conversation
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
