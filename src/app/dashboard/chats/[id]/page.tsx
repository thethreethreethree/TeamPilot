"use client";

import TopBar from "@/components/layout/TopBar";
import { useToast } from "@/components/ui/toast";
import {
  postMessage,
  reviewDurability,
  togglePin,
  toggleCoach,
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
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";

// Extracted chat surfaces — moved out of this file during the §1.7
// B2 refactor. Page is now orchestration; each modal owns its concern.
import { MessageRow } from "@/components/chats/MessageRow";
import { CloseTopicModal } from "@/components/chats/CloseTopicModal";
import { GuideMyResponseModal } from "@/components/chats/GuideMyResponseModal";
import { FormulateResponseModal } from "@/components/chats/FormulateResponseModal";
import { ReviewOutcomeModal } from "@/components/chats/ReviewOutcomeModal";
import { SummarizeModal } from "@/components/chats/SummarizeModal";
import { groupMessages, STATUS_BADGE } from "@/components/chats/utils";
import { AddParticipantsDialog } from "@/components/chats/AddParticipantsDialog";
import { CoachPanel } from "@/components/chats/CoachPanel";
import { InThreadDecisionDialogue } from "@/components/chats/InThreadDecisionDialogue";
import { useCoachEnabled } from "@/lib/coach/useCoachEnabled";
import { BookOpen, BookOpenCheck, Brain } from "lucide-react";
import {
  fetchTopicDecision,
  openTopicDecision,
  type TopicDecision,
} from "@/lib/data/topicDecisions";

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
  const [topicDecision, setTopicDecision] = useState<TopicDecision | null>(null);
  const [openingDialogue, setOpeningDialogue] = useState(false);
  // Company-level Coach master switch. When ON, the Coach activates
  // in every topic regardless of the per-topic flag. Per-topic
  // remains as a fallback when company-level is OFF (the existing
  // chat-only opt-in path from migration 0019).
  const { enabled: companyCoachOn } = useCoachEnabled();
  const [showParticipants, setShowParticipants] = useState(false);
  const [closingOpen, setClosingOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [formulateOpen, setFormulateOpen] = useState(false);
  const [summarizeOpen, setSummarizeOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [aiAssisted, setAiAssisted] = useState(false);
  const [addingParticipants, setAddingParticipants] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  // Smart-scroll state: track whether the user is reading near the
  // bottom so new messages auto-scroll, but reading-history is never
  // yanked (Slack/WhatsApp pattern). When a new message arrives while
  // scrolled up, the "Jump to latest" pill surfaces instead.
  const isNearBottomRef = useRef(true);
  const [hasNewBelow, setHasNewBelow] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [t, m, p, d] = await Promise.all([
      fetchTopic(topicId),
      fetchMessages(topicId),
      fetchParticipants(topicId),
      fetchTopicDecision(topicId),
    ]);
    setTopic(t);
    setMessages(m);
    setParticipants(p);
    setTopicDecision(d);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // `refresh` reads stable setters; depending on it would loop every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  // Initial scroll-to-bottom AFTER messages render. Two rAFs because
  // a single rAF runs before layout settles on long threads (the 210-
  // message migration thread exposed this — scrollHeight was 0 when
  // the prior single-rAF version ran). Double rAF guarantees layout
  // and paint completed, so scrollHeight is accurate.
  useLayoutEffect(() => {
    if (loading) return;
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
        isNearBottomRef.current = true;
        setHasNewBelow(false);
      });
    });
  }, [loading]);

  // New-message scroll behavior — only auto-scroll if the user was
  // already at the bottom. If they're reading history, never yank
  // them; surface a "Jump to latest" pill instead.
  useEffect(() => {
    if (messages.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    if (isNearBottomRef.current) {
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      });
    } else {
      setHasNewBelow(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Scroll listener — recomputes whether the user is "near the
  // bottom" so the next message's scroll behavior is right.
  const onMessagesScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 120;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < threshold;
    if (isNearBottomRef.current && hasNewBelow) {
      setHasNewBelow(false);
    }
  };

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setHasNewBelow(false);
  };

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

  // Open / re-open an in-thread Decision Dialogue. Posts a system
  // message + emits decision.opened on the chain; on success we
  // refresh the whole topic so the new message renders alongside the
  // dialogue card. The card itself drives state independently after
  // that — refreshes happen on phase advance + finalization.
  const handleOpenDecisionDialogue = async () => {
    if (!topic) return;
    setOpeningDialogue(true);
    try {
      const created = await openTopicDecision(topic.id, "");
      setTopicDecision(created);
      // Pull the new system message into the stream.
      const m = await fetchMessages(topic.id);
      setMessages(m);
      toast.success(
        "Decision Dialogue opened",
        "The four-phase flow is now active above the composer."
      );
    } catch (err) {
      toast.error(
        "Couldn't open dialogue",
        err instanceof Error ? err.message : "Unknown error."
      );
    } finally {
      setOpeningDialogue(false);
    }
  };

  const handleDecisionChange = async (next: TopicDecision) => {
    setTopicDecision(next);
    // Each phase advance / system-response / finalize posts a system
    // message; pull the updated stream so it renders.
    const m = await fetchMessages(topicId);
    setMessages(m);
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
    <div className="h-screen bg-base flex flex-col overflow-hidden">
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
            {/* Add member — semantically distinct from /dashboard/team's
                "Invite member": this adds EXISTING company members to
                THIS topic. Onboarding a brand-new person to the company
                is the Team page's job. The user explicitly called out
                this distinction — mixing the two is confusing. */}
            <button
              type="button"
              onClick={() => setAddingParticipants(true)}
              title="Add a team member to this topic"
              className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary border border-default hover:border-strong px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <UserPlus className="w-3 h-3" aria-hidden="true" />
              Add member
            </button>
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
                onClick={async () => {
                  // No-op when the company-wide switch is on —
                  // toggling per-topic has no effect since the master
                  // switch already activates Coach everywhere. We
                  // disable the click so users don't get a confusing
                  // "I just turned it off but it's still showing"
                  // experience.
                  if (companyCoachOn) return;
                  // Optimistic flip — we know RLS accepts admins via
                  // chat_topics update policy already in place. If
                  // the row update fails the next refresh will revert.
                  const next = !topic.coachEnabled;
                  setTopic({ ...topic, coachEnabled: next });
                  await toggleCoach(topic.id, next).catch(() => {
                    setTopic({ ...topic, coachEnabled: !next });
                    toast.error("Couldn't toggle Coach");
                  });
                  toast.success(
                    next
                      ? "Conversational Coach: on"
                      : "Conversational Coach: off",
                    next
                      ? "Heuristic citations will surface as you draft."
                      : "Composer returns to default behavior."
                  );
                }}
                disabled={companyCoachOn}
                title={
                  companyCoachOn
                    ? "Coach is on company-wide (admin set this in Settings). The per-topic toggle has no effect while company-wide is on."
                    : topic.coachEnabled
                      ? "Coach is on for this topic. Click to turn off."
                      : "Coach is off for this topic. Click to turn on. Default OFF per §4 readout discipline."
                }
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors border ${
                  companyCoachOn || topic.coachEnabled
                    ? "text-brand border-[#FACC15]/40 hover:border-[#FACC15]/70 bg-[#FACC15]/5"
                    : "text-secondary border-default hover:border-strong"
                } ${companyCoachOn ? "cursor-default opacity-90" : ""}`}
              >
                {companyCoachOn || topic.coachEnabled ? (
                  <BookOpenCheck className="w-3 h-3" aria-hidden />
                ) : (
                  <BookOpen className="w-3 h-3" aria-hidden />
                )}
                Coach: {companyCoachOn ? "on (company)" : topic.coachEnabled ? "on" : "off"}
              </button>
            )}
            {/* Open as Decision Dialogue — admin-only, hidden while a
                dialogue is in flight (the card itself becomes the
                control surface). Also hidden when the topic is closed.
                Per §3.3, opening is an act of room leadership; we don't
                let any participant flip the room into structured mode. */}
            {iAmAdmin &&
              !isClosed &&
              (!topicDecision || topicDecision.phase === "decided") && (
                <button
                  onClick={() => void handleOpenDecisionDialogue()}
                  disabled={openingDialogue}
                  title="Open the structured 4-phase Decision Dialogue inline in this thread"
                  className="flex items-center gap-1.5 text-xs text-brand hover:text-primary border border-[#FACC15]/40 hover:border-[#FACC15]/70 disabled:opacity-50 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <Brain className="w-3 h-3" aria-hidden="true" />
                  {openingDialogue ? "Opening…" : "Open as Decision Dialogue"}
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

      {/* Message stream — the only scrollable area on this page.
          Sticky date dividers float at the top of the viewport as you
          scroll past a day's worth of messages (Slack pattern). */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={onMessagesScroll}
          className="absolute inset-0 overflow-y-auto px-6 py-6"
        >
          <div className="max-w-5xl mx-auto w-full">
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
                    {/* Sticky date divider — Slack-style. Floats at top
                        of the visible viewport as the user scrolls past
                        a day. Backdrop blur so it stays legible over the
                        messages it's covering. */}
                    <div className="sticky top-0 z-10 -mx-6 px-6 py-2 mb-4 bg-base/85 backdrop-blur-sm">
                      <div className="flex items-center gap-3 max-w-5xl mx-auto">
                        <div className="flex-1 h-px bg-surface-raised" />
                        <span className="text-[10px] uppercase tracking-widest text-muted font-mono bg-surface border border-default rounded-full px-2.5 py-1">
                          {group.label}
                        </span>
                        <div className="flex-1 h-px bg-surface-raised" />
                      </div>
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
        </div>
        {/* Jump-to-latest pill — surfaces only when a new message
            arrives while the user is scrolled up in history. Pattern
            from Slack/WhatsApp: never yank you out of reading. */}
        {hasNewBelow && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute left-1/2 -translate-x-1/2 bottom-4 flex items-center gap-1.5 bg-[#FACC15] hover:bg-[#EAB308] text-[#09090B] font-semibold text-xs px-3 py-2 rounded-full shadow-glow-ember transition-colors"
          >
            <ArrowDown className="w-3.5 h-3.5" aria-hidden />
            Jump to latest
          </button>
        )}
      </div>

      {/* Composer */}
      {!isClosed && (
        <div className="border-t border-default bg-surface/50 px-6 py-4">
          <form
            onSubmit={handleSubmit}
            className="max-w-5xl mx-auto"
          >
            {/* In-thread Decision Dialogue card — when present, sits
                directly above the composer so the conversation
                continues to flow above it and the dialogue stays
                anchored. The card folds to a one-line summary once
                decided. */}
            {topicDecision && (
              <InThreadDecisionDialogue
                decision={topicDecision}
                coachOn={companyCoachOn || topic.coachEnabled}
                iAmAdmin={iAmAdmin}
                onChange={(next) => void handleDecisionChange(next)}
                onOpenNew={() => void handleOpenDecisionDialogue()}
              />
            )}
            {/* Conversational Coach v1 — only rendered when the topic
                has opted in (coach_enabled = true). A3 default-OFF so
                the §4 readout has a clean A/B between coached and
                uncoached topics. */}
            {/* Coach surface here = (company-wide flag OR per-topic flag).
                Company-wide is the master switch the user flipped under
                /dashboard/settings; per-topic is the v1 fallback that
                lets an admin enable Coach in a specific topic when the
                company-wide switch is OFF. */}
            {(companyCoachOn || topic.coachEnabled) && (
              <CoachPanel
                subject={`chat_topic:${topic.id}`}
                draft={draft}
                onRefine={() => inputRef.current?.focus()}
              />
            )}
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
      <AddParticipantsDialog
        open={addingParticipants}
        topicId={topic.id}
        topicTitle={topic.title}
        alreadyParticipantIds={new Set(participants.map((p) => p.userId))}
        onClose={() => setAddingParticipants(false)}
        onAdded={async () => {
          const next = await fetchParticipants(topic.id);
          setParticipants(next);
        }}
      />
    </div>
  );
}

// ─── Message rendering ───────────────────────────────────────
