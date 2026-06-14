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
  useCurrentUserRole,
  isCompanyAdminRole,
} from "@/lib/hooks/useCurrentUserRole";
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
  Reply,
  Sparkles,
  UserPlus,
  Users,
  Wand2,
  X,
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
import { groupMessages } from "@/components/chats/utils";
import { AddParticipantsDialog } from "@/components/chats/AddParticipantsDialog";
import { CoachPanelV5 } from "@/components/chats/CoachPanelV5";
import { AskCoachButton } from "@/components/chats/AskCoachButton";
import { CoachAffirmation } from "@/components/chats/CoachAffirmation";
import { ReviewSentMessageModal } from "@/components/chats/ReviewSentMessageModal";
import { hapticSend } from "@/lib/pwa/haptics";
import type {
  CoachContextPayload,
  EncouragementGrade,
} from "@/lib/coach/v5/types";
import {
  fetchTopicMessageGrades,
  gradeSentMessage,
} from "@/lib/coach/v5/gradeClient";

import { InThreadDecisionDialogue } from "@/components/chats/InThreadDecisionDialogue";
import { ComposerToolbar } from "@/components/chats/ComposerToolbar";
import { useCoachEnabled } from "@/lib/coach/useCoachEnabled";
import { BookOpen, BookOpenCheck, Brain } from "lucide-react";
import {
  fetchTopicDecision,
  openTopicDecision,
  type TopicDecision,
} from "@/lib/data/topicDecisions";
import TaskRefinementPanel from "@/components/tasks/TaskRefinementPanel";
import type { SpawnContextPayload } from "@/lib/taskSpawn/types";
import { ListChecks, ListPlus } from "lucide-react";

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
  // v4.0 — affirmation surface for the third Coach contract. When the
  // writer accepts a Sharpen revision, this turns on briefly to
  // acknowledge the catch. The CoachAffirmation component auto-hides
  // itself; we just need to flip this back to false when it asks.
  const [showCoachAffirmation, setShowCoachAffirmation] = useState(false);
  // Coach v5 Ask-Coach token — incremented to trigger an active analysis.
  const [askCoachToken, setAskCoachToken] = useState(0);
  // Coach v5 Encouragement System — map of message_id → grade. Loaded
  // from the chain on mount + updated when new grades come back from
  // gradeSentMessage(). Drives the MessageGradeIndicator next to each
  // user's own messages.
  const [messageGrades, setMessageGrades] = useState<Map<string, EncouragementGrade>>(
    () => new Map()
  );
  // Sprint 6: when set, the ReviewSentMessageModal opens for this
  // message. Cleared when the modal closes.
  const [reviewingMessageId, setReviewingMessageId] = useState<string | null>(null);
  const [summarizeOpen, setSummarizeOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [aiAssisted, setAiAssisted] = useState(false);
  const [addingParticipants, setAddingParticipants] = useState(false);
  // Reply state — when set, the composer shows a "Replying to X" pill
  // above the textarea and the next post carries reply_to_id.
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  // Chat→Task selection mode — admin-only. When on, message rows
  // become click-to-select and a sticky bar shows the selection count
  // + "Spawn task" / "Cancel" actions.
  const [spawnSelectMode, setSpawnSelectMode] = useState(false);
  const [spawnSelectedIds, setSpawnSelectedIds] = useState<Set<string>>(
    () => new Set()
  );
  const [spawnPanelOpen, setSpawnPanelOpen] = useState(false);
  // UI-only dismiss for the folded "Decision Dialogue closed" card.
  // We track the decision id so the dismissal applies to THIS dialogue
  // — when an admin opens a fresh dialogue, the new one shows again.
  // Persisted to sessionStorage so it survives a refresh during the
  // same browsing session but doesn't bleed across sessions.
  const [dismissedDecisionId, setDismissedDecisionId] = useState<string | null>(
    null
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(
      `dismissed-decision:${topicId}`
    );
    if (stored) setDismissedDecisionId(stored);
  }, [topicId]);

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
    const [t, m, p, d, grades] = await Promise.all([
      fetchTopic(topicId),
      fetchMessages(topicId),
      fetchParticipants(topicId),
      fetchTopicDecision(topicId),
      fetchTopicMessageGrades(topicId),
    ]);
    setTopic(t);
    setMessages(m);
    setParticipants(p);
    setTopicDecision(d);
    setMessageGrades(grades);
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
  const currentUserRole = useCurrentUserRole();
  const me = useMemo(
    () =>
      currentUserId
        ? participants.find((p) => p.userId === currentUserId)
        : undefined,
    [participants, currentUserId]
  );
  // iAmAdmin is true when the viewer is EITHER:
  //   - a per-topic admin (chat_participants.role === 'admin'), OR
  //   - a company-level admin (profiles.role in CEO/COO/admin).
  // The second branch fixes the Dev LAB regression Darren flagged:
  // company admins should have admin powers on every topic in their
  // company without needing an explicit chat_participants.role flip.
  // Per-topic admin remains meaningful for non-company-admins who get
  // promoted in a specific topic.
  const iAmAdmin =
    me?.role === "admin" || isCompanyAdminRole(currentUserRole);
  const isClosed = topic?.status === "closed";

  const grouped = useMemo(() => groupMessages(messages), [messages]);

  // Build the Spawn Engine context payload from the current
  // selection. Selected messages are the focus; the surrounding ~5
  // messages on either side give the LLM the conversational reality
  // (§1.5 holistic — read the WHOLE context, not just the selection).
  const spawnContextPayload = useMemo<SpawnContextPayload | null>(() => {
    if (!topic || spawnSelectedIds.size === 0) return null;
    const chatMessages = messages.filter((m) => m.kind === "message");
    const selected = chatMessages.filter((m) => spawnSelectedIds.has(m.id));
    if (selected.length === 0) return null;
    // Surrounding window — take the earliest and latest selected
    // indices in the chronological message stream and grab ~5 before
    // the earliest and ~5 after the latest, excluding the selected
    // ones themselves (the LLM already has those as the focus).
    const indices = selected
      .map((m) => chatMessages.findIndex((cm) => cm.id === m.id))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
    const first = indices[0] ?? 0;
    const last = indices[indices.length - 1] ?? 0;
    const before = chatMessages.slice(Math.max(0, first - 5), first);
    const after = chatMessages.slice(
      last + 1,
      Math.min(chatMessages.length, last + 6)
    );
    const selectedSet = new Set(selected.map((m) => m.id));
    const surrounding = [...before, ...after].filter(
      (m) => !selectedSet.has(m.id)
    );
    return {
      chatTopicId: topic.id,
      chatTopicTitle: topic.title,
      chatTopicDescription: topic.description ?? undefined,
      selectedMessageIds: selected.map((m) => m.id),
      selectedMessages: selected.map((m) => ({
        author: m.authorName ?? "Unknown",
        body: (m.body ?? "").slice(0, 4000),
      })),
      surroundingThread: surrounding.map((m) => ({
        author: m.authorName ?? "Unknown",
        body: (m.body ?? "").slice(0, 4000),
      })),
    };
  }, [topic, messages, spawnSelectedIds]);

  const exitSpawnSelectMode = () => {
    setSpawnSelectMode(false);
    setSpawnSelectedIds(new Set());
  };

  const toggleSpawnSelected = (id: string) => {
    setSpawnSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Recent thread context for Coach v3.1 — last 5 user-authored
  // Coach v5 context payload — structured form the v5 prompt consumes
  // directly. Different shape than the v4 recentThread string because the
  // LLM-primary architecture reads each message as its own structured
  // entry rather than as concatenated prose.
  const coachV5ContextPayload = useMemo<CoachContextPayload>(() => {
    const recent: NonNullable<CoachContextPayload["recentThread"]> = [];
    for (let i = Math.max(0, messages.length - 10); i < messages.length; i += 1) {
      const m = messages[i];
      if (!m || m.kind !== "message" || !m.body) continue;
      recent.push({
        author: m.authorName ?? "Unknown",
        body: m.body.slice(0, 2000),
        timestamp: m.createdAt ?? "",
      });
    }
    return {
      recentThread: recent,
      topic: {
        title: topic?.title,
        description: topic?.description ?? undefined,
      },
    };
  }, [messages, topic?.title, topic?.description]);

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
    const replyToSnapshot = replyTo;
    // Optimistic UI: clear the input now so the user can keep typing.
    setDraft("");
    setAiAssisted(false);
    setReplyTo(null);
    try {
      const msg = await postMessage({
        topicId,
        body: trimmed,
        aiAssisted: aiFlag,
        replyToId: replyToSnapshot?.id ?? null,
      });
      setMessages((prev) => [...prev, msg]);
      // PWA Phase 2.2 — fire the push-notification fan-out for this
      // new message. Fire-and-forget; if it fails the message has
      // already landed and nothing breaks.
      void fetch("/api/notifications/notify-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId,
          messageId: msg.id,
          bodyPreview: trimmed.slice(0, 120),
          authorName: msg.authorName ?? "Someone",
          topicTitle: topic?.title ?? "Team Chat",
        }),
      }).catch(() => {
        // Push fan-out is non-blocking. Errors swallow silently here;
        // server-side logs surface the actual cause.
      });
      // Coach v5 — fire the Encouragement System grader. Non-blocking;
      // updates messageGrades when the grade comes back. The message
      // already landed — the grade just drives the indicator next to
      // it (🙌 / Review-with-Coach / nothing).
      void gradeSentMessage({
        sentMessage: trimmed,
        contextType: replyToSnapshot ? "chat_reply" : "chat_message",
        subject: `chat_topic:${topicId}`,
        messageId: msg.id,
        recentThread: coachV5ContextPayload.recentThread,
        parentMessage: replyToSnapshot
          ? {
              author: replyToSnapshot.authorName ?? "Unknown",
              body: replyToSnapshot.body ?? "",
            }
          : undefined,
        onGraded: (grade) => {
          setMessageGrades((prev) => {
            const next = new Map(prev);
            next.set(msg.id, grade);
            return next;
          });
        },
      });
    } catch (err) {
      // Rollback the input so the user can retry without re-typing.
      setDraft(trimmed);
      setAiAssisted(aiFlag);
      setReplyTo(replyToSnapshot);
      toast.error(
        "Couldn't post",
        err instanceof Error ? err.message : "Unknown error."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Scroll a specific message into view + briefly highlight it. Called
  // when the user clicks the reply-context quote on a reply message —
  // takes them back to the original they were responding to.
  const scrollToMessage = (messageId: string) => {
    if (typeof document === "undefined") return;
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-[#FACC15]", "ring-offset-2", "ring-offset-base");
    window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-[#FACC15]", "ring-offset-2", "ring-offset-base");
    }, 1600);
  };

  const startReply = (msg: ChatMessage) => {
    setReplyTo(msg);
    // Bring focus to the composer so the user can type immediately.
    requestAnimationFrame(() => inputRef.current?.focus());
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
    <div className="h-screen w-full bg-base flex flex-col overflow-hidden">
      <TopBar title={topic.title} subtitle={topic.description ?? ""} />

      {/* Topic header bar — on mobile, the right-side chip group is
          horizontally scrollable so chips like 'Coach: on (company)'
          and 'Open as Decision Dialogue' don't get clipped or push
          the page wider than the viewport. Desktop keeps the wrap
          behavior since horizontal space is plenty. py-2 on mobile
          recovers ~8px of vertical space. */}
      <div className="border-b border-default bg-surface/50 px-3 md:px-6 py-2 md:py-3 overflow-x-hidden">
        <div className="max-w-5xl mx-auto flex items-center gap-2 md:gap-4 flex-nowrap md:flex-wrap min-w-0">
          <div className="flex items-center gap-2 md:gap-3 flex-wrap flex-shrink-0">
            <Link
              href="/dashboard/chats"
              className="flex items-center gap-1.5 text-xs font-medium text-primary bg-surface-raised hover:bg-white/10 border border-default hover:border-strong px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              All topics
            </Link>
            {/* Status badge + tag chips removed from the topic header
                per Darren's verification pass — both were visual noise
                competing with the action chip row to the right. Topic
                status remains tracked on the row (drives whether
                composer / Close topic surface), it just doesn't need
                to be re-asserted in the header. Tags stay queryable on
                /dashboard/chats (topic list). */}
          </div>
          {/* Right-side chip group — horizontally scrollable on mobile
              so 'Coach: on (company)' / 'Open as Decision Dialogue' /
              'Close topic' stay reachable without clipping. The wrapper
              uses overflow-x-auto + flex-nowrap; the inner buttons all
              already have flex-shrink-0 via px-2.5 sizing so they don't
              collapse. min-w-0 lets this group shrink below content
              width when the left group needs the room.

              touch-action: pan-x + overscroll-behavior: contain — both
              required so the horizontal swipe stays inside this
              element on iOS PWA. Without them, the swipe propagates
              to the system and accidentally triggers the home /
              app-switcher gesture. The top row is far from the home
              indicator so this is mostly a defensive measure here;
              the composer scroll below is where it really matters. */}
          <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto md:overflow-visible md:flex-none md:flex-nowrap justify-end -mx-1 px-1 [touch-action:pan-x] [overscroll-behavior:contain] [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
            <button
              onClick={() => setShowParticipants((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary border border-default hover:border-strong px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
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
              className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary border border-default hover:border-strong px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
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
                className="flex items-center gap-1.5 text-xs text-arc-300 hover:text-arc-200 border border-arc-400/40 hover:border-arc-400/70 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
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
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors border flex-shrink-0 whitespace-nowrap ${
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
                  className="flex items-center gap-1.5 text-xs text-brand hover:text-primary border border-[#FACC15]/40 hover:border-[#FACC15]/70 disabled:opacity-50 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
                >
                  <Brain className="w-3 h-3" aria-hidden="true" />
                  {openingDialogue ? "Opening…" : "Open as Decision Dialogue"}
                </button>
              )}
            {iAmAdmin && !isClosed && !spawnSelectMode && (
              <button
                onClick={() => setSpawnSelectMode(true)}
                title="Select messages to convert into a structured task with steps"
                className="flex items-center gap-1.5 text-xs text-arc-300 hover:text-arc-200 border border-arc-400/40 hover:border-arc-400/70 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
              >
                <ListPlus className="w-3 h-3" aria-hidden="true" />
                Spawn task
              </button>
            )}
            {iAmAdmin && !isClosed && (
              <button
                onClick={() => setClosingOpen(true)}
                className="flex items-center gap-1.5 text-xs text-accent-text hover:text-accent-text border border-gold-400/40 hover:border-gold-400/70 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
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
        <div className="max-w-5xl mx-auto w-full px-3 md:px-6 mt-4 min-w-0">
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
          scroll past a day's worth of messages (Slack pattern).

          Mobile-overflow defense: every nesting level here has
          overflow-x-hidden + min-w-0 so a single long URL inside a
          message bubble cannot push the page wider than the viewport.
          The 210-message migration brought in raw URLs (Tony Robbins,
          Facebook share links) that broke the original layout. */}
      <div className="relative flex-1 min-h-0 overflow-x-hidden">
        <div
          ref={scrollRef}
          onScroll={onMessagesScroll}
          className="absolute inset-0 overflow-y-auto overflow-x-hidden px-3 md:px-6 py-6"
        >
          <div className="max-w-5xl mx-auto w-full min-w-0">
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
                        a day. Fully opaque bg-base (was 85% before) so
                        message text behind the divider doesn't bleed
                        through — it was reading as "cut off" on mobile
                        where the pill sat directly over message lines.
                        Negative margin is mobile-safe via -mx-3 md:-mx-6
                        (matches parent padding). */}
                    <div className="sticky top-0 z-10 -mx-3 md:-mx-6 px-3 md:px-6 py-2 mb-4 bg-base">
                      <div className="flex items-center gap-3 max-w-5xl mx-auto min-w-0">
                        <div className="flex-1 h-px bg-surface-raised" />
                        <span className="text-[10px] uppercase tracking-widest text-muted font-mono bg-surface border border-default rounded-full px-2.5 py-1 flex-shrink-0">
                          {group.label}
                        </span>
                        <div className="flex-1 h-px bg-surface-raised" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      {group.messages.map((msg) => {
                        const parent = msg.replyToId
                          ? messages.find((m) => m.id === msg.replyToId) ?? null
                          : null;
                        const isSelectable =
                          spawnSelectMode && msg.kind === "message";
                        const isSelected = spawnSelectedIds.has(msg.id);
                        return (
                          <div
                            key={msg.id}
                            className={
                              isSelectable
                                ? `relative rounded-xl transition-colors cursor-pointer ${
                                    isSelected
                                      ? "ring-2 ring-arc-400/70 bg-arc-400/5"
                                      : "hover:bg-white/[0.02]"
                                  }`
                                : undefined
                            }
                            onClick={
                              isSelectable
                                ? (e) => {
                                    // Don't hijack clicks on the row's
                                    // own buttons (Reply, Pin, reply
                                    // quote jump). Selection toggles
                                    // only when the click lands on the
                                    // wrapper itself or the message body.
                                    const t = e.target as HTMLElement;
                                    if (t.closest("button")) return;
                                    toggleSpawnSelected(msg.id);
                                  }
                                : undefined
                            }
                          >
                            {isSelectable && (
                              <div
                                aria-hidden
                                className={`absolute -left-1 top-3 w-4 h-4 rounded-full border-2 transition-colors ${
                                  isSelected
                                    ? "bg-arc-400 border-arc-400"
                                    : "border-arc-400/40 bg-base"
                                }`}
                              />
                            )}
                            <MessageRow
                              msg={msg}
                              parent={parent}
                              currentUserId={currentUserId}
                              coachGrade={messageGrades.get(msg.id) ?? null}
                              viewerIsLeader={iAmAdmin}
                              onTogglePin={() => void handleTogglePin(msg)}
                              onStartReply={() => startReply(msg)}
                              onJumpToParent={(id) => scrollToMessage(id)}
                              onReviewWithCoach={(id) =>
                                setReviewingMessageId(id)
                              }
                            />
                          </div>
                        );
                      })}
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
        {hasNewBelow && !spawnSelectMode && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute left-1/2 -translate-x-1/2 bottom-4 flex items-center gap-1.5 bg-[#FACC15] hover:bg-[#EAB308] text-[#09090B] font-semibold text-xs px-3 py-2 rounded-full shadow-glow-ember transition-colors"
          >
            <ArrowDown className="w-3.5 h-3.5" aria-hidden />
            Jump to latest
          </button>
        )}
        {/* Chat→Task selection bar — surfaces when an admin enters
            spawn-select mode. Floats over the composer so the user
            can see and toggle the selection without losing context.
            "Spawn" is disabled until at least one message is picked. */}
        {spawnSelectMode && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-4 flex items-center gap-2 bg-base/95 border border-arc-400/50 shadow-lg backdrop-blur-sm px-3 py-2 rounded-full">
            <ListChecks
              className="w-3.5 h-3.5 text-arc-300"
              aria-hidden="true"
            />
            <span className="text-xs text-primary font-medium">
              {spawnSelectedIds.size} selected
            </span>
            <span className="text-[10px] text-muted">
              tap messages to include
            </span>
            <button
              type="button"
              onClick={exitSpawnSelectMode}
              className="text-xs text-muted hover:text-primary px-2 py-0.5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setSpawnPanelOpen(true)}
              disabled={spawnSelectedIds.size === 0}
              className="inline-flex items-center gap-1 text-xs font-semibold bg-arc-400 hover:bg-arc-300 disabled:opacity-40 disabled:cursor-not-allowed text-base/100 text-[#09090B] px-3 py-1.5 rounded-full"
            >
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              Spawn task
            </button>
          </div>
        )}
      </div>

      {/* Composer — pb-[safe] keeps the bottom scrollable row above
          the iOS home-indicator gesture zone. Without this, the
          horizontal swipe on the action row sits in the gesture-
          intercept area and accidentally triggers the system app-
          switcher / home gesture, exiting the PWA. The padding picks
          up env(safe-area-inset-bottom) which Next.js exposes via
          viewport-fit=cover (see layout.tsx viewport export). */}
      {!isClosed && (
        <div
          className="border-t border-default bg-surface/50 px-3 md:px-6 py-2 md:py-4 overflow-x-hidden min-w-0"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)",
          }}
        >
          <form
            onSubmit={handleSubmit}
            className="max-w-5xl mx-auto min-w-0"
          >
            {/* In-thread Decision Dialogue card — when present, sits
                directly above the composer so the conversation
                continues to flow above it and the dialogue stays
                anchored. The card folds to a one-line summary once
                decided. */}
            {topicDecision &&
              !(
                topicDecision.phase === "decided" &&
                dismissedDecisionId === topicDecision.id
              ) && (
                <InThreadDecisionDialogue
                  decision={topicDecision}
                  coachOn={companyCoachOn || topic.coachEnabled}
                  iAmAdmin={iAmAdmin}
                  onChange={(next) => void handleDecisionChange(next)}
                  onOpenNew={() => void handleOpenDecisionDialogue()}
                  onDismissFolded={() => {
                    setDismissedDecisionId(topicDecision.id);
                    if (typeof window !== "undefined") {
                      window.sessionStorage.setItem(
                        `dismissed-decision:${topicId}`,
                        topicDecision.id
                      );
                    }
                  }}
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
              <CoachPanelV5
                draft={draft}
                contextType="chat_message"
                contextPayload={coachV5ContextPayload}
                askCoachToken={askCoachToken}
                onAcceptRevision={(revised) => {
                  setDraft(revised);
                  setAiAssisted(true);
                  inputRef.current?.focus();
                  setShowCoachAffirmation(true);
                }}
              />
            )}
            <CoachAffirmation
              show={showCoachAffirmation}
              onHide={() => setShowCoachAffirmation(false)}
            />
            {/* Reply-to pill — surfaces above the textarea when the
                user has clicked Reply on a message. Shows the author
                + a one-line snippet of the parent so context is clear
                before they type. Click X to cancel the reply. */}
            {replyTo && (
              <div className="flex items-start gap-2 mb-2 px-3 py-2 rounded-lg bg-ember-400/[0.06] border border-ember-400/30">
                <Reply
                  className="w-3.5 h-3.5 text-brand mt-0.5 flex-shrink-0"
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-brand uppercase tracking-widest font-semibold mb-0.5">
                    Replying to {replyTo.authorName}
                  </p>
                  <p className="text-xs text-secondary truncate">
                    {(replyTo.body ?? "").replace(/\s+/g, " ").slice(0, 120)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  aria-label="Cancel reply"
                  className="text-muted hover:text-secondary flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" aria-hidden />
                </button>
              </div>
            )}
            <div className="bg-surface border border-ember-400/20 rounded-xl focus-within:border-ember-400/60 transition-colors overflow-hidden">
              {/* Markdown formatting toolbar — B / I / Code / Link /
                  lists / blockquote. Operates directly on the textarea
                  via ref so selection is preserved. Keyboard shortcuts
                  (Ctrl+B etc.) are wired by the component itself. */}
              <ComposerToolbar
                textareaRef={inputRef}
                value={draft}
                onChange={setDraft}
              />
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
                /* text-base (16px) on mobile, text-sm on md+:
                   iOS Safari auto-zooms into any focused input/textarea
                   whose font-size is < 16px. After the auto-zoom the
                   page becomes wider than the viewport and the user
                   has to manually pinch-out to navigate. Setting 16px
                   on mobile prevents the zoom entirely. Desktop keeps
                   the original 14px density. */
                className="w-full min-w-0 bg-transparent text-base md:text-sm text-primary placeholder:text-muted px-4 py-3 focus:outline-none resize-none"
              />
              {/* Composer footer — three lanes:
                    LEFT: horizontally-scrollable secondary tools
                          (Guide my response, Help me formulate).
                          Designed so future composer tools can be
                          added without consuming chat space.
                    MIDDLE: Ask Coach — the constitutional product.
                          Pulled out of the scrollable row and pinned
                          always-visible per Darren's verification
                          pass. Coach v5 is THE feature; treating it
                          as a peer of Guide/Formulate underrated it.
                          Yellow-tinted chip with Brain icon makes it
                          unmistakably the primary action.
                    RIGHT: Send. Anchored, never scrolls. */}
              <div className="flex items-center gap-2 px-2 py-1.5 border-t border-default min-w-0">
                <div
                  className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto -mx-1 px-1 [touch-action:pan-x] [overscroll-behavior:contain] [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
                >
                  <button
                    type="button"
                    onClick={() => setGuideOpen(true)}
                    disabled={!draft.trim()}
                    className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary disabled:opacity-30 border border-default hover:border-arc-400/50 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0 whitespace-nowrap"
                    title="Have the System sharpen your draft before you send it"
                  >
                    <Wand2 className="w-3 h-3" aria-hidden="true" />
                    Guide my response
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormulateOpen(true)}
                    className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary border border-default hover:border-arc-400/50 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0 whitespace-nowrap"
                    title="Get help formulating a fuller response by answering questions first"
                  >
                    <Lightbulb className="w-3 h-3" aria-hidden="true" />
                    Help me formulate
                  </button>
                  {aiAssisted && (
                    <span className="flex items-center gap-1 text-[10px] text-arc-300 flex-shrink-0 whitespace-nowrap">
                      <Sparkles className="w-3 h-3" aria-hidden="true" />
                      AI-assisted
                    </span>
                  )}
                </div>
                {(companyCoachOn || topic.coachEnabled) && (
                  <AskCoachButton
                    disabled={!draft.trim()}
                    onAsk={() => setAskCoachToken((t) => t + 1)}
                  />
                )}
                <button
                  type="submit"
                  disabled={!draft.trim() || submitting}
                  onPointerDown={() => {
                    if (draft.trim() && !submitting) hapticSend();
                  }}
                  className="flex items-center gap-1.5 bg-[#FACC15] hover:bg-[#EAB308] active:scale-95 disabled:opacity-40 disabled:active:scale-100 text-[#09090B] font-semibold px-3 py-1.5 rounded-lg transition-all duration-150 text-xs flex-shrink-0"
                >
                  Send
                  <CornerDownLeft className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            </div>
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
            // v4.0 — drop the generic info-toast and trigger the
            // CoachAffirmation surface instead. The affirmation IS
            // the feedback for accepting a Sharpen revision; a toast
            // saying "draft updated" alongside the warm acknowledgment
            // would feel contradictory and clinical.
            setShowCoachAffirmation(true);
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

      {reviewingMessageId && (() => {
        const target = messages.find((m) => m.id === reviewingMessageId);
        if (!target || !target.body) {
          // Defensive: target message vanished from local state.
          return null;
        }
        // Build the surrounding context — same recent-thread payload
        // we feed the analyze route, but anchored to this message's
        // position (so the Coach sees what came after it too).
        const idx = messages.findIndex((m) => m.id === reviewingMessageId);
        const surrounding = messages
          .slice(Math.max(0, idx - 5), Math.min(messages.length, idx + 6))
          .filter((m) => m.kind === "message" && m.body)
          .map((m) => ({
            author: m.authorName ?? "Unknown",
            body: m.body!.slice(0, 2000),
            timestamp: m.createdAt ?? "",
          }));
        return (
          <ReviewSentMessageModal
            sentMessage={target.body}
            contextPayload={{
              recentThread: surrounding,
              topic: {
                title: topic?.title,
                description: topic?.description ?? undefined,
              },
            }}
            onClose={() => setReviewingMessageId(null)}
          />
        );
      })()}

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

      {/* Chat→Task refinement panel — mounts only when the user has
          selected at least one message and pressed Spawn. The panel
          itself owns the LLM call + draft review; on save it stays
          on this page so the admin can spawn more tasks from the
          same conversation if the thread implied several. */}
      {spawnContextPayload && (
        <TaskRefinementPanel
          open={spawnPanelOpen}
          onClose={() => setSpawnPanelOpen(false)}
          contextType="chat_messages"
          contextPayload={spawnContextPayload}
          onSaved={() => {
            // Clear selection so the admin starts clean for the next
            // spawn. They can stay in spawn-select mode by leaving
            // the toggle on, or exit via the Cancel pill.
            setSpawnSelectedIds(new Set());
          }}
        />
      )}
    </div>
  );
}

// ─── Message rendering ───────────────────────────────────────
