"use client";

import { useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { hapticTap } from "@/lib/pwa/haptics";

/**
 * AskCoachButton — composer-footer trigger for Coach v5.0 active mode.
 *
 * The button lives in every composer surface (chat, decision dialogue,
 * task fields, feedback, smoke test). Clicking it increments a token
 * that CoachPanelV5 watches; the panel then fires an Ask-Coach analysis
 * regardless of whether Auto-Coach would have surfaced anything.
 *
 * This is the user-pull side of the Coach interaction model — the
 * passive Auto-Coach speaks when it has something to say; the active
 * Ask-Coach gives the user the affordance to invite the Coach to read
 * any draft, even one Auto-Coach judged "correct."
 *
 * Spec: docs/COACH_PROMPT_DESIGN.md §1.2
 *
 * Usage:
 *   const [askToken, setAskToken] = useState(0);
 *   <CoachPanelV5 askCoachToken={askToken} ... />
 *   <AskCoachButton disabled={!draft.trim()} onAsk={() => setAskToken(t => t+1)} />
 */
export function AskCoachButton({
  disabled,
  onAsk,
  label = "Ask Coach",
}: {
  disabled?: boolean;
  onAsk: () => void;
  label?: string;
}) {
  // Local pulse animation when clicked — a tiny visual confirmation
  // the click landed even before the LLM call returns. The panel itself
  // will surface the "Coach is reading…" spinner once the request fires.
  const [pulse, setPulse] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    setPulse(true);
    hapticTap();
    onAsk();
    window.setTimeout(() => setPulse(false), 300);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 text-[10px] text-secondary hover:text-primary border border-default hover:border-[#FACC15]/40 rounded-md px-2 py-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
        pulse ? "scale-95" : ""
      }`}
      aria-label={label}
    >
      <MessageCircleQuestion
        className="w-3 h-3 text-brand"
        aria-hidden
      />
      {label}
    </button>
  );
}
