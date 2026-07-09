"use client";

import { Layers, Minimize2 } from "lucide-react";
import { useExperienceMode } from "@/components/experience/ExperienceModeProvider";
import type { ExperienceMode } from "@/lib/experience/mode";

/**
 * Settings panel for Experience Mode (migration 0110). A per-user choice between
 * a simplified experience and the full system. Mirrors LearningModePanel's
 * card/precedent (§A28).
 *
 * Copy discipline: §A8 (growth-aware participant, not a dumbed-down tool) + §A18
 * (the label invites the behavior) — "Standard" is framed as "the essentials,
 * less at once," NOT "the lite/lesser version." §3.4: it states honestly that
 * Standard shows less, and that the full detail is always one click away
 * (the drill-in), so the user knows exactly what they're choosing.
 */
const OPTIONS: Array<{
  mode: ExperienceMode;
  label: string;
  blurb: string;
  Icon: typeof Layers;
}> = [
  {
    mode: "standard",
    label: "Standard",
    blurb:
      "Simplified. Shorter, plain-language guidance and a calmer interface — the essentials, less at once. Full detail is always one click away.",
    Icon: Minimize2,
  },
  {
    mode: "expert",
    label: "Expert",
    blurb:
      "The full system. Complete reasoning, every panel and control, nothing collapsed.",
    Icon: Layers,
  },
];

export function ExperienceModePanel() {
  const { mode, setMode, loaded } = useExperienceMode();

  return (
    <div className="glass-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Layers className="h-4 w-4 text-ember-300" aria-hidden />
        <h2 className="text-sm font-semibold text-primary">Experience Mode</h2>
      </div>
      <p className="mb-4 text-xs text-secondary leading-relaxed">
        Choose how much the System shows you at once. Set once here; it applies
        across the whole app — including C.A.R.E and the Sales Coach — and
        follows you across devices. It shapes what <span className="text-primary font-medium">you</span> read
        (coaching, dissects, summaries); the messages you send to customers or
        teammates stay full quality regardless.
      </p>

      <div
        role="radiogroup"
        aria-label="Experience Mode"
        className="grid gap-2 sm:grid-cols-2"
      >
        {OPTIONS.map(({ mode: m, label, blurb, Icon }) => {
          // Gate the active indicator on `loaded`: before the server read
          // resolves, `mode` is the default 'standard', so an Expert user would
          // briefly see Standard highlighted, then watch it correct — a
          // wrong-state flash (§1.5.1 layer 4). Show neither as active until we
          // actually know the user's preference.
          const active = loaded && mode === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!loaded}
              onClick={() => void setMode(m)}
              className={`flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-all disabled:opacity-50 ${
                active
                  ? "border-ember-400 bg-ember-400/10"
                  : "border-default bg-surface-raised hover:border-ember-400/50"
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon
                  className={`h-3.5 w-3.5 ${active ? "text-ember-300" : "text-muted"}`}
                  aria-hidden
                />
                <span
                  className={`text-xs font-semibold ${active ? "text-primary" : "text-secondary"}`}
                >
                  {label}
                </span>
                {active && (
                  <span className="ml-auto text-[10px] uppercase tracking-widest text-ember-300">
                    Active
                  </span>
                )}
              </span>
              <span className="text-[11px] leading-relaxed text-muted">
                {blurb}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
