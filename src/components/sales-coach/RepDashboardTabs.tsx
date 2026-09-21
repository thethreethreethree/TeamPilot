"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { RepArena } from "./RepArena";
import { PitchBreakdown } from "./PitchBreakdown";
import { PitchMilestones } from "./PitchMilestones";
import { TodaysMetrics } from "./doorlog/TodaysMetrics";

/**
 * The rep dashboard's sub-nav: Progress | Breakdown | Metrics.
 *
 * SPECIFIED. The 2026-09-19 rep dashboard sheet draws exactly these three tabs above the Progress
 * board. The product had the first two stacked vertically on one page and no third.
 *
 * THE METRICS TAB IS THE EXISTING MACRO COMPONENT, by founder decision (2026-09-22). The sheet has
 * four content pages and none of them is Metrics — it names the tab and never draws it — so its
 * contents were not something to infer. `doorlog/TodaysMetrics` is the founder's own 2026-08-19
 * Macro spec, already built, already rep-facing, and `TodaysMetricsPager` had already paired it
 * with the Arena under the labels "Progress" and "Metrics". The sheet's sub-nav was describing
 * something that existed.
 *
 * Tabs rather than a stack, and it is not only the sheet saying so. Three boards down one page is
 * four screens of scrolling in which the Breakdown's thirty percentages sit between a rep and
 * anything else. The sheet's order is also an argument: where you stand, then why, then the field
 * read.
 *
 * WHY THIS IS A CLIENT COMPONENT AND THE PAGE IS NOT. Route segment config is silently ignored in a
 * `"use client"` file — INVARIANT 27 exists because a `dynamic` export stranded in a client page
 * broke `build:ci` earlier this month. The page stays a server shell; the tab state lives here.
 */

const TABS = [
  { key: "progress", label: "Progress" },
  { key: "breakdown", label: "Breakdown" },
  { key: "metrics", label: "Metrics" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function RepDashboardTabs() {
  const [tab, setTab] = useState<TabKey>("progress");
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  /**
   * Arrow keys move between tabs, which is what a tablist is expected to do.
   *
   * Focus moves with the selection: a keyboard user who arrows to Metrics and presses Tab should
   * land inside Metrics, not back at the tab they started on.
   */
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = TABS.findIndex((t) => t.key === tab);
    const next =
      e.key === "ArrowRight" ? (i + 1) % TABS.length
      : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length
      : e.key === "Home" ? 0
      : e.key === "End" ? TABS.length - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next]!.key);
    buttons.current[next]?.focus();
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div
        role="tablist"
        aria-label="Rep dashboard"
        className="flex gap-1 px-4 md:px-8 pt-4 pb-3 shrink-0"
      >
        {TABS.map((t, i) => (
          <button
            key={t.key}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            role="tab"
            id={`rep-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`rep-panel-${t.key}`}
            /* Only the selected tab is in the tab order — a tablist is one stop, then arrow keys. */
            tabIndex={tab === t.key ? 0 : -1}
            onClick={() => setTab(t.key)}
            onKeyDown={onKeyDown}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${
              tab === t.key
                ? "bg-ember-400 text-ink-950"
                : "border border-default text-secondary hover:bg-base/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/*
        One panel rendered at a time, not all three hidden with CSS. Each fetches on mount, and
        three boards loading behind a tab nobody opened is three requests and three spinners for a
        rep who wanted one number.
      */}
      <div
        role="tabpanel"
        id={`rep-panel-${tab}`}
        aria-labelledby={`rep-tab-${tab}`}
        className="flex-1 min-h-0 overflow-y-auto"
      >
        {tab === "progress" && (
          <>
            <RepArena />
            <div className="px-4 md:px-8 pb-8 max-w-4xl mx-auto w-full">
              <PitchMilestones />
            </div>
          </>
        )}
        {tab === "breakdown" && (
          <div className="px-4 md:px-8 pb-8 max-w-4xl mx-auto w-full">
            <PitchBreakdown />
          </div>
        )}
        {tab === "metrics" && <TodaysMetrics />}
      </div>
    </div>
  );
}
