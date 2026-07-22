"use client";

import { useState } from "react";
import { Brain } from "lucide-react";
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
 * Visual rank — promoted to a primary chip (brand-yellow tint, Brain
 * icon, always-visible position) per Darren's verification pass. The
 * Coach is the constitutional product; the other composer buttons
 * (Guide my response, Help me formulate) are secondary tools. Hiding
 * Ask Coach inside a scrollable row alongside them was undersell.
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
      title="Coach reads your draft and offers a teaching-shaped suggestion — guide, don't overtake"
      className={`flex items-center gap-1.5 text-xs font-semibold text-brand bg-ember-400/10 border border-ember-400/50 hover:border-ember-400/80 hover:bg-ember-400/15 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0 ${
        pulse ? "scale-95" : ""
      }`}
      aria-label={label}
    >
      <Brain className="w-3.5 h-3.5" aria-hidden />
      {label}
    </button>
  );
}
