"use client";

import { useState } from "react";
import { Sparkles, MessageCircleQuestion, AlertCircle } from "lucide-react";
import type { EncouragementGrade } from "@/lib/coach/v5/types";

/**
 * MessageGradeIndicator — Coach v5.0 Encouragement System surface.
 *
 * Spec: docs/COACH_PROMPT_DESIGN.md §10.
 *
 * Asymmetric visibility model — what renders depends on (a) the grade,
 * (b) whether this is the viewer's own message, (c) whether the viewer
 * has executive/admin authority over the sender:
 *
 *   - productive + own message → 🙌 (intrinsic motivation, sender only)
 *   - productive + others' message → NOTHING (peers don't see 🙌)
 *   - needs_guidance + own message → "Review with Coach" CTA (CTA, not warning)
 *   - needs_guidance + own message viewed by leader → "Needs Guidance" label
 *   - needs_guidance + peer message → NOTHING
 *   - neutral / withheld → NOTHING for everyone
 *
 * Per A18: the label is the structural defense against misuse. The
 * leader sees "Needs Guidance" — a call to mentor. Never "Warning",
 * never "Poor message", never a red icon. The data invites help; the
 * label keeps it that way.
 *
 * Peers see nothing in either direction. Dignity preserved.
 */

export function MessageGradeIndicator({
  grade,
  isOwnMessage,
  viewerIsLeader,
  onReviewClick,
  onLeaderGuideClick,
}: {
  grade: EncouragementGrade | null;
  /** Is the message being rendered authored by the current viewer? */
  isOwnMessage: boolean;
  /** Does the viewer have executive/admin authority over the sender?
   *  True for CEOs / exec roles / company admins viewing a non-self
   *  team member's message. */
  viewerIsLeader: boolean;
  /** Sender-side: fired when user clicks "Review with Coach" CTA. */
  onReviewClick?: () => void;
  /** Leader-side: fired when leader clicks the "Needs Guidance" label. */
  onLeaderGuideClick?: () => void;
}) {
  if (!grade || grade === "neutral" || grade === "withheld") return null;

  // Productive grade — own message only. Peers and leaders don't see
  // the 🙌 because peer-visible reward distorts intrinsic motivation,
  // and the leader's role is to guide where help is needed, not to
  // track who's doing well.
  if (grade === "productive") {
    if (!isOwnMessage) return null;
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] text-emerald-300 select-none"
        title="Coach: productive communication"
        aria-label="Coach indicator: productive communication"
      >
        <Sparkles className="w-3 h-3" aria-hidden />
        <span>Nice — that landed well.</span>
      </span>
    );
  }

  // needs_guidance grade. Two visibility paths:
  // - Own message → "Review with Coach" CTA (sender)
  // - Others' message viewed by a leader → "Needs Guidance" label
  // - Otherwise → nothing
  if (grade === "needs_guidance") {
    if (isOwnMessage) {
      return (
        <button
          type="button"
          onClick={onReviewClick}
          className="inline-flex items-center gap-1 text-[10px] text-brand hover:text-[#EAB308] border border-[#FACC15]/30 hover:border-[#FACC15]/60 bg-[#FACC15]/[0.06] hover:bg-[#FACC15]/[0.12] rounded-md px-1.5 py-0.5 transition-colors"
          title="Coach noticed something. Click to learn together."
        >
          <MessageCircleQuestion className="w-3 h-3" aria-hidden />
          Review with Coach
        </button>
      );
    }
    if (viewerIsLeader) {
      return <NeedsGuidanceLabel onGuideClick={onLeaderGuideClick} />;
    }
    return null;
  }

  return null;
}

/**
 * The leader-visible label for a needs_guidance message. Per A18 the
 * framing is "Needs Guidance" — call to mentorship — NEVER "Warning"
 * or "Poor." The label opens a small affordance to invite the leader
 * into a coaching conversation, never to surface punishment.
 */
function NeedsGuidanceLabel({ onGuideClick }: { onGuideClick?: () => void }) {
  const [showHint, setShowHint] = useState(false);
  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        onClick={() => {
          setShowHint((v) => !v);
          if (showHint) onGuideClick?.();
        }}
        onBlur={() => setShowHint(false)}
        className="inline-flex items-center gap-1 text-[10px] text-secondary hover:text-primary border border-default hover:border-[#FACC15]/30 bg-surface rounded-md px-1.5 py-0.5 transition-colors"
        aria-label="Needs Guidance — click for guidance options"
      >
        <AlertCircle className="w-3 h-3 text-brand/70" aria-hidden />
        Needs Guidance
      </button>
      {showHint && (
        <span
          role="dialog"
          className="ml-2 inline-flex items-center gap-1.5 text-[10px] text-secondary bg-surface border border-default rounded-md px-2 py-1"
        >
          This message could use guidance. Want to start a coaching
          conversation?
        </span>
      )}
    </span>
  );
}
