"use client";

import { Lightbulb, Moon, Sun } from "lucide-react";
import { useLearningMode } from "@/components/learning/LearningModeProvider";
import { useTheme } from "@/components/theme/ThemeProvider";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * Settings panel for Learning Mode. Per migration 0051 and founder
 * design direction:
 *
 *   - Toggle persists to profiles.learning_mode_enabled
 *   - Enabling it auto-switches the theme to dark (lightbulb +
 *     darkness is the brand metaphor; the feature only makes
 *     visual sense against a dark surface)
 *   - If the user is currently in light mode WITH the toggle
 *     already on (e.g., they enabled it earlier then switched
 *     themes manually), we surface an honest banner explaining
 *     that the lightbulb is dormant until they switch back
 *
 * Per CLAUDE.md §3.3 — the panel explains the constraint instead
 * of hiding it. The user knows what they're opting into.
 */
export function LearningModePanel() {
  const { enabled, toggleEnabled, isDark } = useLearningMode();
  const { setPreference } = useTheme();

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb
              className={`w-4 h-4 ${enabled && isDark ? "text-ember-300" : "text-muted"}`}
              aria-hidden
            />
            <h2 className="text-sm font-semibold text-primary">
              Learning Mode
            </h2>
          </div>
          <p className="text-xs text-secondary leading-relaxed">
            A lightbulb appears in the corner of every dashboard page.
            Click it to illuminate the interface — every annotated
            element shows a teaching entry on hover, not just a label.
            Each entry covers <span className="text-primary font-medium">what
            the feature is</span>, <span className="text-primary font-medium">why
            it exists</span>, <span className="text-primary font-medium">how to
            use it well</span>, and <span className="text-primary font-medium">the
            transferable principle</span> behind it. Every entry also has
            an <span className="text-primary font-medium">Ask Jeff what this
            does</span> button — opens a conversation where you can
            ask follow-ups about that specific feature. The goal is
            fluency, not familiarity — a user who works through the
            layer can explain the System to someone else.
          </p>
        </div>
        <LearningHint
          category="Learning Mode (meta)"
          title="The toggle you're hovering"
          whatItIs="The Learning Mode opt-in toggle itself. When on, persisted to your profile (cross-device). When off, the lightbulb FAB never renders. Enabling auto-switches the theme to dark — the brand metaphor only lands against a dark surface."
          why="The fact that THIS feature has its own teaching hint is intentional. Learning Mode shouldn't be invisible chrome the user enables and forgets — it should teach about itself the same way it teaches about every other surface. Hovering this toggle should explain WHY the feature exists, not just what it does."
          how="Toggle on to enable; the lightbulb appears bottom-right in dark mode. Click the lightbulb to illuminate the page (every annotated element pulses and shows a teaching popover on hover). Click again to dim. Toggle off here when you no longer want it available."
          principle="A learning surface that doesn't teach about itself is teaching by exception. The discipline applies to every feature including this one."
        >
          <label
            className="relative inline-flex items-center cursor-pointer flex-shrink-0"
            aria-label="Toggle Learning Mode"
          >
            <input
              type="checkbox"
              className="sr-only peer"
              checked={enabled}
              onChange={() => void toggleEnabled()}
            />
            <span className="w-10 h-5 bg-surface-raised border border-default rounded-full peer-checked:bg-ember-400/20 peer-checked:border-ember-400 transition-all relative">
              <span
                className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-secondary transition-transform ${
                  enabled ? "translate-x-5 bg-ember-400" : ""
                }`}
              />
            </span>
          </label>
        </LearningHint>
      </div>

      {/* Constraint explanation — always visible so it's never a
          surprise gate. */}
      <div className="mt-4 pt-3 border-t border-default">
        <p className="text-[11px] text-muted uppercase tracking-widest font-bold mb-1.5">
          Why dark mode only
        </p>
        <p className="text-[11px] text-secondary leading-relaxed">
          The ELOSTATE logo is a lightbulb. A bulb in daylight is just
          an object; a bulb in darkness is illumination — idea, guidance,
          the moment something clicks. Learning Mode renders only in
          dark mode because that&apos;s where the brand metaphor lives.
          Enabling Learning Mode automatically switches you to dark mode.
        </p>
      </div>

      {/* Honest banner — preference is on, but theme is light. */}
      {enabled && !isDark && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-md border border-ember-400/40 bg-ember-400/5">
          <Sun className="w-3.5 h-3.5 text-ember-300" aria-hidden />
          <p className="flex-1 text-[11px] text-secondary leading-relaxed">
            Learning Mode is on but you&apos;re in light mode — the
            lightbulb is dormant. Switch to dark mode to use it.
          </p>
          <button
            type="button"
            onClick={() => setPreference("dark")}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-ember-300 hover:text-primary"
          >
            <Moon className="w-3 h-3" aria-hidden /> Dark mode
          </button>
        </div>
      )}
    </div>
  );
}
