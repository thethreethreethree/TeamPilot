"use client";

import { Pin, PinOff, Reply, Sparkles } from "lucide-react";
import type { ChatMessage } from "@/lib/data/chats";
import { formatTime } from "./utils";
import {
  avatarColorFor,
  avatarInitialsFor,
  avatarTextColorFor,
} from "@/lib/brand/avatar";
import { renderMessageBody } from "@/lib/chat/markdown";
import { MessageGradeIndicator } from "./MessageGradeIndicator";

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
}) {
  const isSummary = msg.kind === "summary";
  const isSystem = msg.kind === "system";
  const isMine = currentUserId !== null && msg.authorId === currentUserId;
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
    <div
      id={`msg-${msg.id}`}
      className="flex gap-2 md:gap-3 group rounded-xl transition-shadow min-w-0"
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
          <div
            className="chat-message-body text-sm text-primary leading-relaxed pr-14 break-words space-y-1"
            style={{ overflowWrap: "anywhere" }}
          >
            {renderMessageBody(msg.body)}
          </div>
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
          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
    </div>
  );
}
