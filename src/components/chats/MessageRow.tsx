"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Pin, PinOff, Reply, Sparkles, X } from "lucide-react";
import { hapticThreshold } from "@/lib/pwa/haptics";
import { type ChatMessage, isWithinEditWindow } from "@/lib/data/chats";
import { formatTime } from "./utils";
import {
  avatarColorFor,
  avatarInitialsFor,
  avatarTextColorFor,
} from "@/lib/brand/avatar";
import { renderMessageBody } from "@/lib/chat/markdown";
import { MessageGradeIndicator } from "./MessageGradeIndicator";
import { InlineAttachment } from "@/components/files/InlineAttachment";

/**
 * MessageRow — renders a single message in the chat stream.
 *
 * Three render paths:
 *   - kind="system"  → centered separator with italic body
 *   - kind="summary" → arc-cyan System summary card with "confirm or correct" label
 *   - default        → avatar + author + timestamp + pinned/AI-assisted chips + body
 *
 * Threaded reply support:
 *   - If `parent` is supplied (the message this one is replying to),
 *     the row renders a compact quote pill above the body. Clicking
 *     the quote calls onJumpToParent so the chat page can smooth-scroll
 *     to the original.
 *   - `onStartReply` exposes a hover-revealed Reply button so the
 *     viewer can start a threaded reply to this row.
 *
 * Avatars use profile-customized color/initials when set, otherwise
 * deterministic defaults from src/lib/brand/avatar.ts.
 *
 * Each row gets `id="msg-<id>"` so the scrollToMessage helper on the
 * chat page can find it and apply the highlight ring.
 */
export function MessageRow({
  msg,
  parent,
  currentUserId,
  coachGrade,
  viewerIsLeader,
  onTogglePin,
  onStartReply,
  onJumpToParent,
  onReviewWithCoach,
  onEdit,
}: {
  msg: ChatMessage;
  /** Parent message this row replies to. Null when not a reply, or
   *  when the parent is outside the loaded window. */
  parent?: ChatMessage | null;
  currentUserId: string | null;
  /** Coach v5 Encouragement System grade for this message, or null
   *  if it hasn't been graded yet (or grading isn't applicable). */
  coachGrade?: import("@/lib/coach/v5/types").EncouragementGrade | null;
  /** Does the viewing user have leader/admin authority over the
   *  sender? Drives the "Needs Guidance" label visibility per A18. */
  viewerIsLeader?: boolean;
  onTogglePin: () => void;
  onStartReply?: () => void;
  onJumpToParent?: (parentId: string) => void;
  /** Fired when sender clicks the "Review with Coach" CTA on their
   *  own needs_guidance-graded message. Sprint 6 wires the actual
   *  retrospective review flow. */
  onReviewWithCoach?: (messageId: string) => void;
  /** Queue #8 message editing. Called when the sender saves an edit
   *  to their own message. Returns ok + optional error so the row can
   *  surface a denial (e.g. the 30-min window passed server-side). */
  onEdit?: (
    messageId: string,
    newBody: string
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const isSummary = msg.kind === "summary";
  const isSystem = msg.kind === "system";
  const isMine = currentUserId !== null && msg.authorId === currentUserId;
  // Queue #8: the sender may edit their own text message within the
  // 30-minute window. The affordance shows only when all hold; the
  // database (migration 0068 RLS) is the real gate.
  const canEdit =
    !!onEdit &&
    isMine &&
    msg.kind === "message" &&
    isWithinEditWindow(msg.createdAt);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.body ?? "");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const startEdit = () => {
    setDraft(msg.body ?? "");
    setEditError(null);
    setEditing(true);
  };
  const cancelEdit = () => {
    setEditing(false);
    setEditError(null);
  };
  const saveEdit = async () => {
    if (!onEdit) return;
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      setEditError("A message can't be empty.");
      return;
    }
    if (trimmed === (msg.body ?? "")) {
      setEditing(false);
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    const res = await onEdit(msg.id, trimmed);
    setSavingEdit(false);
    if (res.ok) {
      setEditing(false);
    } else {
      setEditError(res.error ?? "Couldn't save the edit.");
    }
  };
  const bg = msg.authorAvatarColor ?? avatarColorFor(msg.authorId, msg.authorName);
  const initials =
    msg.authorAvatarInitials ?? avatarInitialsFor(msg.authorName);
  const fg = avatarTextColorFor(bg);

  if (isSystem) {
    return (
      <div
        id={`msg-${msg.id}`}
        className="flex items-center gap-2 justify-center py-2 transition-shadow"
      >
        <div className="h-px flex-1 bg-surface-raised max-w-16" />
        <span className="text-[10px] text-muted italic">{msg.body}</span>
        <div className="h-px flex-1 bg-surface-raised max-w-16" />
      </div>
    );
  }

  if (isSummary) {
    return (
      <div id={`msg-${msg.id}`} className="flex gap-3 group transition-shadow">
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
          <div className="bg-arc-400/5 border border-arc-400/20 rounded-xl px-3 py-2 min-w-0">
            <div
              className="chat-message-body text-sm text-primary leading-relaxed break-words space-y-1"
              style={{ overflowWrap: "anywhere" }}
            >
              {renderMessageBody(msg.body)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SwipeToReplyRow
      msgId={msg.id}
      onReplyTriggered={onStartReply}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold border border-default/40"
        style={{ backgroundColor: bg, color: fg }}
        title={isMine ? "Your avatar — customize in Settings" : msg.authorName}
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
          {/* Queue #8: always-visible (edited) label per §A10 (no
              shadow read) + §A18 (the honest label). Shown to everyone
              whenever the message has been edited — never hidden. */}
          {msg.editedAt && (
            <span
              className="text-[10px] text-muted italic"
              title={`Edited ${formatTime(msg.editedAt)}`}
            >
              (edited)
            </span>
          )}
          {/* AI-assisted badge — A18 asymmetric visibility (2026-06-13).
              The badge is the same data the system has always recorded
              (msg.aiAssisted), but who sees it now matters:
                - Sender (own message): yes — transparency about what
                  the system tracks on them; no shame, just honesty
                - Admins / executives: yes — they need to understand
                  team communication behavior over time
                - Peers: no — the user's screenshot annotation captured
                  the structural issue: "they are afraid that others
                  might see them incapable of responding without AI
                  guidance"
              Same pattern as the Encouragement System grade indicators
              from Sprint 5: peer visibility breaks the contract; sender
              + leader visibility serves it. The data unchanged; what
              we surface to whom is the structural defense. */}
          {msg.aiAssisted && (isMine || viewerIsLeader) && (
            <span
              className="flex items-center gap-0.5 text-[10px] text-arc-300"
              title={
                isMine
                  ? "You used the System to sharpen this message"
                  : "This author used the System to sharpen this message"
              }
            >
              <Sparkles className="w-2.5 h-2.5" aria-hidden="true" />
              AI-assisted
            </span>
          )}
          {msg.pinned && (
            <span
              className="flex items-center gap-0.5 text-[10px] text-accent-text"
              title="Pinned to priority data assets"
            >
              <Pin className="w-2.5 h-2.5" aria-hidden="true" />
              Pinned
            </span>
          )}
        </div>
        {/* Reply context quote — surfaces when this message replies to
            another. Click jumps to the parent message in the stream.
            If the parent is outside the loaded window we still render
            a placeholder so the reply doesn't look orphaned. */}
        {msg.replyToId && (
          <button
            type="button"
            onClick={() =>
              parent && onJumpToParent && onJumpToParent(parent.id)
            }
            disabled={!parent || !onJumpToParent}
            className="w-full text-left flex items-start gap-2 mb-1 pl-2 py-1 rounded-md border-l-2 border-ember-400/60 bg-ember-400/[0.04] hover:bg-ember-400/[0.08] disabled:opacity-60 transition-colors min-w-0"
            title={parent ? "Jump to original message" : "Original message not loaded"}
          >
            <Reply className="w-3 h-3 text-brand mt-0.5 flex-shrink-0" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-brand font-semibold tracking-wide mb-0.5">
                {parent?.authorName ?? "Original message"}
              </p>
              <p className="text-[11px] text-secondary truncate">
                {parent
                  ? (parent.body ?? "").replace(/\s+/g, " ").slice(0, 140)
                  : "Outside the loaded window — scroll up to find it."}
              </p>
            </div>
          </button>
        )}
        <div
          className={`relative rounded-xl px-3 py-2 min-w-0 ${
            msg.pinned
              ? "bg-ember-400/[0.04] border border-ember-400/30"
              : "bg-surface/40 border border-ember-400/15"
          }`}
        >
          {/* Markdown render — supports bold, italic, code, links,
              lists, blockquote, auto-linked URLs. Long unbroken
              URLs wrap mid-string via the renderer's break-all class
              so mobile doesn't horizontally overflow. */}
          {editing ? (
            /* Queue #8 inline editor. Replaces the body while the
               sender edits; Save calls onEdit (-> editMessage). */
            <div className="space-y-1.5">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    void saveEdit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEdit();
                  }
                }}
                rows={Math.min(8, Math.max(2, draft.split("\n").length))}
                autoFocus
                className="w-full bg-base border border-ember-400/40 rounded-md px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:border-ember-400/70 resize-none"
              />
              {editError && (
                <p className="text-[11px] text-red-300">{editError}</p>
              )}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void saveEdit()}
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1 text-[11px] bg-ember-400 hover:bg-ember-500 disabled:opacity-50 text-[#09090B] font-semibold px-2.5 py-1 rounded-md"
                >
                  <Check className="w-3 h-3" aria-hidden />
                  {savingEdit ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1 text-[11px] text-secondary hover:text-primary border border-default hover:border-strong px-2.5 py-1 rounded-md"
                >
                  <X className="w-3 h-3" aria-hidden />
                  Cancel
                </button>
                <span className="text-[10px] text-muted">
                  ⌘/Ctrl+Enter to save · Esc to cancel
                </span>
              </div>
            </div>
          ) : (
            <div
              className="chat-message-body text-sm text-primary leading-relaxed pr-14 break-words space-y-1"
              style={{ overflowWrap: "anywhere" }}
            >
              {msg.kind === "attachment" && msg.mediaUrl ? (
                <InlineAttachment
                  mediaUrl={msg.mediaUrl}
                  mediaType={msg.mediaType ?? null}
                  fallbackTitle={msg.body ?? undefined}
                />
              ) : (
                renderMessageBody(msg.body)
              )}
            </div>
          )}
          {/* Coach v5 Encouragement System indicator — renders 🙌 /
              Review-with-Coach / Needs Guidance with strict visibility
              rules (sender sees own grade; leader sees others'
              needs_guidance; peers see nothing). Spec: COACH_PROMPT_
              DESIGN.md §10. */}
          {coachGrade && (
            <div className="mt-1.5">
              <MessageGradeIndicator
                grade={coachGrade}
                isOwnMessage={isMine}
                viewerIsLeader={viewerIsLeader ?? false}
                onReviewClick={() => onReviewWithCoach?.(msg.id)}
              />
            </div>
          )}
          {/* Action buttons (Reply / Pin) — visible by default on
              touch devices, hover-revealed on devices with a real
              cursor. The hover-only pattern silently fails on touch
              (no hover event), which is why these were effectively
              invisible on phones. The `(hover: hover)` media query
              targets pointer-capable devices; everywhere else they
              stay at opacity-100. */}
          <div className="absolute top-2 right-2 flex items-center gap-1 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
            {canEdit && !editing && (
              <button
                type="button"
                onClick={startEdit}
                aria-label="Edit message"
                title="Edit — within 30 minutes of sending"
                className="text-muted hover:text-brand"
              >
                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
            {onStartReply && (
              <button
                type="button"
                onClick={onStartReply}
                aria-label="Reply to this message"
                title="Reply — threads under this message"
                className="text-muted hover:text-brand"
              >
                <Reply className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
            <button
              onClick={onTogglePin}
              aria-label={msg.pinned ? "Unpin message" : "Pin message"}
              title={
                msg.pinned
                  ? "Remove from priority data"
                  : "Pin as priority data — the brain learns from pinned messages"
              }
              className="text-muted hover:text-accent-text"
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
    </SwipeToReplyRow>
  );
}

/**
 * SwipeToReplyRow — Phase 5.4 wrapper that renders the message row
 * and supports a right-swipe gesture to trigger reply.
 *
 * Behavior:
 *   - Touch-drag right from the message → reply indicator slides in
 *     from the left edge while the message itself translates with
 *     the finger (damped after threshold).
 *   - Past 60px → release fires onReplyTriggered. Below threshold,
 *     snap back.
 *   - Threshold haptic when crossing the commit zone.
 *   - PWA-standalone only. In browser-tab context the gesture is
 *     disabled so it doesn't fight horizontal scrolling.
 *   - msgId is forwarded to the outer div as the `id` attribute so
 *     scroll-to-message (used by the reply-to jump button) keeps
 *     working.
 */
function SwipeToReplyRow({
  msgId,
  onReplyTriggered,
  children,
}: {
  msgId: string;
  onReplyTriggered?: () => void;
  children: React.ReactNode;
}) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const lockedDirection = useRef<"horizontal" | "vertical" | null>(null);
  const swipeRef = useRef(0);
  const [swipe, setSwipe] = useState(0);
  const [committed, setCommitted] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
  }, []);

  const enabled = isStandalone && !!onReplyTriggered;
  const THRESHOLD = 60;
  const MAX_SWIPE = 110;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!enabled) return;
    const t = e.touches[0];
    if (!t) return;
    startX.current = t.clientX;
    startY.current = t.clientY;
    lockedDirection.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!enabled || startX.current === null || startY.current === null) return;
    const t = e.touches[0];
    if (!t) return;
    const deltaX = t.clientX - startX.current;
    const deltaY = t.clientY - startY.current;

    // Lock the gesture direction on first significant movement.
    // If user moves more vertically than horizontally, treat as
    // scroll and bail out — don't fight the message stream's
    // vertical scroll.
    if (lockedDirection.current === null) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (absX < 8 && absY < 8) return; // dead zone — wait for clear intent
      lockedDirection.current = absX > absY ? "horizontal" : "vertical";
    }

    if (lockedDirection.current === "vertical") return;
    if (deltaX <= 0) {
      swipeRef.current = 0;
      setSwipe(0);
      return;
    }
    // Damp past the threshold so the message doesn't fly off the
    // screen if the user keeps dragging — same rubber-band feel as
    // pull-to-refresh.
    const damped =
      deltaX <= THRESHOLD
        ? deltaX
        : THRESHOLD + Math.sqrt(deltaX - THRESHOLD) * 8;
    const clamped = Math.min(MAX_SWIPE, damped);
    const wasBelow = swipeRef.current < THRESHOLD;
    const nowAtOrAbove = clamped >= THRESHOLD;
    if (wasBelow && nowAtOrAbove) {
      hapticThreshold();
      setCommitted(true);
    } else if (clamped < THRESHOLD && committed) {
      setCommitted(false);
    }
    swipeRef.current = clamped;
    setSwipe(clamped);
  };

  const handleTouchEnd = () => {
    if (!enabled || startX.current === null) return;
    const final = swipeRef.current;
    startX.current = null;
    startY.current = null;
    lockedDirection.current = null;
    if (final >= THRESHOLD && onReplyTriggered) {
      // Trigger fires after the snap-back animation so the swipe
      // feels resolved before the composer's "Replying to" pill
      // appears.
      window.setTimeout(() => onReplyTriggered(), 150);
    }
    swipeRef.current = 0;
    setSwipe(0);
    setCommitted(false);
  };

  // Indicator opacity ramps from 0 → 1 as the user swipes toward
  // the threshold. Committed state (past threshold) is fully solid.
  const indicatorOpacity = committed ? 1 : Math.min(1, swipe / THRESHOLD);

  return (
    <div
      id={`msg-${msgId}`}
      className="relative min-w-0"
      onTouchStart={enabled ? handleTouchStart : undefined}
      onTouchMove={enabled ? handleTouchMove : undefined}
      onTouchEnd={enabled ? handleTouchEnd : undefined}
      onTouchCancel={enabled ? handleTouchEnd : undefined}
    >
      {/* Reply indicator — sits BEHIND the message, revealed as the
          message slides right. Brand-amber Reply icon in a circle on
          the left edge. */}
      {enabled && (
        <div
          aria-hidden
          className="absolute left-0 top-0 bottom-0 flex items-center pointer-events-none"
          style={{
            opacity: indicatorOpacity,
            transform: `translateX(${Math.min(swipe / 2, 30)}px)`,
          }}
        >
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
              committed
                ? "bg-ember-400 text-[#09090B]"
                : "bg-ember-400/20 text-brand"
            }`}
          >
            <Reply className="w-4 h-4" aria-hidden />
          </div>
        </div>
      )}

      <div
        className="flex gap-2 md:gap-3 group rounded-xl transition-shadow min-w-0"
        style={{
          transform: enabled && swipe > 0 ? `translateX(${swipe}px)` : undefined,
          transition: swipe === 0 ? "transform 200ms ease-out" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
