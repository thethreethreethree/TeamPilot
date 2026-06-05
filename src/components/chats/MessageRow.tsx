"use client";

import { Pin, PinOff, Sparkles } from "lucide-react";
import type { ChatMessage } from "@/lib/data/chats";
import { formatTime } from "./utils";

/**
 * MessageRow — renders a single message in the chat stream.
 *
 * Three render paths:
 *   - kind="system"  → centered separator with italic body
 *   - kind="summary" → arc-cyan System summary card with "confirm or correct" label
 *   - default        → avatar + author + timestamp + pinned/AI-assisted chips + body
 *
 * Extracted from the chat detail page during the §1.7 B2 refactor. Pure
 * presentation; pinning state is controlled by the parent via `onTogglePin`.
 * The parent owns the optimistic-toggle logic (see chats/[id]/page.tsx).
 */
export function MessageRow({
  msg,
  currentUserId,
  onTogglePin,
}: {
  msg: ChatMessage;
  /** The id that identifies the viewer — for own-message styling. Null
   *  while the auth session loads; treated as "not mine" until known. */
  currentUserId: string | null;
  onTogglePin: () => void;
}) {
  const isSummary = msg.kind === "summary";
  const isSystem = msg.kind === "system";
  const isMine = currentUserId !== null && msg.authorId === currentUserId;
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
              className="flex items-center gap-0.5 text-[10px] text-accent-text"
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
            className="absolute top-2 right-2 text-muted hover:text-accent-text opacity-0 group-hover:opacity-100 transition-opacity"
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
