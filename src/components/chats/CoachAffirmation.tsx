"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

/**
 * CoachAffirmation — v4.0 (2026-06-12).
 *
 * The third Coach contract — making the writer FEEL they've grown when
 * they catch and revise their own pattern — had no UI surface until
 * v4.0. We tracked `coach.suggestion_accepted` to the §3.1 chain so the
 * System learned about the writer's growth; we gave the writer nothing
 * back. That asymmetry was the structural absence v4.0 closes.
 *
 * When the writer accepts a Sharpen suggestion (clicks "Use the
 * suggestion" in GuideMyResponseModal), this component renders a
 * brief, warm acknowledgment near the composer. The phrasing comes
 * from real peer-coach interactions — short, present, generous, not
 * congratulatory in a way that performs surprise. The writer DID the
 * work; this just acknowledges it.
 *
 * Non-intrusive by design:
 *   - Auto-hides after 4 seconds (long enough to read once, short
 *     enough to not block the composer)
 *   - No close button — closing it would be more friction than just
 *     ignoring it
 *   - Rotates through phrases on each show so it doesn't feel templated
 *
 * Constitutional bearing: A11 (mirror frame) still holds — the System
 * isn't asserting the writer was wrong before or right now. It's
 * acknowledging the writer's choice to revise without grading it.
 */

const AFFIRMATION_PHRASES = [
  "Nice catch — you saw the pattern and made the move.",
  "That's the practice — noticing, then choosing.",
  "Good work — that's how the pattern gets less automatic.",
  "Solid revision. The catch IS the skill.",
  "Nice — that pause before sending is the whole game.",
] as const;

const VISIBLE_MS = 4000;

export function CoachAffirmation({
  show,
  onHide,
}: {
  show: boolean;
  onHide: () => void;
}) {
  // Pick a fresh phrase each time `show` flips on — so the writer
  // doesn't see the same line twice in a row. The choice is local
  // state, regenerated on every show transition.
  const [phrase, setPhrase] = useState<string>(AFFIRMATION_PHRASES[0]);

  useEffect(() => {
    if (!show) return;
    const next =
      AFFIRMATION_PHRASES[
        Math.floor(performance.now() / 1000) % AFFIRMATION_PHRASES.length
      ] ?? AFFIRMATION_PHRASES[0];
    setPhrase(next);
    const t = window.setTimeout(onHide, VISIBLE_MS);
    return () => window.clearTimeout(t);
  }, [show, onHide]);

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-300"
    >
      <Sparkles className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
      <p className="text-xs leading-relaxed">{phrase}</p>
    </div>
  );
}
