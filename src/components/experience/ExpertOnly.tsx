"use client";

import { useExperienceMode } from "./ExperienceModeProvider";

/**
 * Renders `children` ONLY in Expert mode; hides them entirely in Standard.
 *
 * For genuinely SUPPLEMENTARY annotation that adds cognitive load a Standard user
 * chose to avoid: methodology §-citations, "why this is structural" explanatory
 * footnotes, verbose helper microcopy. The founder's original ask (2026-07-09):
 * Standard simplifies "every detail… even the explanation of the coaches, Dissects,
 * Summary."
 *
 * Contrast with AdvancedDetail (collapse-behind-a-click, for secondary CONTENT the
 * user might still want). ExpertOnly is for annotation the user does NOT need — a
 * one-click reveal for a one-line footnote is heavier than the footnote. Use it ONLY
 * for optional annotation, NEVER for primary content, data, or an action.
 *
 * Hidden before the mode loads (default Standard) to avoid a flash of footnotes that
 * then vanish; an Expert sees them appear once the mode read resolves.
 */
export function ExpertOnly({ children }: { children: React.ReactNode }) {
  const { isExpert, loaded } = useExperienceMode();
  if (!loaded || !isExpert) return null;
  return <>{children}</>;
}
