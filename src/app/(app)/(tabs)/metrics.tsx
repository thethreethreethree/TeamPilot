/**
 * Today's Metrics — ONE module with FOUR swipeable pages.
 *
 * WHERE THE PITCH SCORE BOARDS LIVE, by the founder's ruling R-A of 2026-09-22. The build plan had
 * placed them under Pitch Performance; the mockup's own bottom bar highlights **Today's Metrics**
 * on p1 — amber icon, amber label — and the canvas agrees. So the drawn segmented control is this
 * tab's control, and its third segment is this tab's existing content rather than anything new.
 *
 * FOUR SEGMENTS, NOT THREE, by ruling R-D. The drawing shows `Progress | Breakdown | Metrics`, and
 * "Progress" there means the Pitch Score board. This phone already had a Progress page — the
 * gamification Arena — and the two are different systems measuring different things. The founder
 * was asked which is "the system" and answered **name both**: Pitch Score takes `Progress`, the
 * Arena becomes `Points`, and the Arena keeps its own route so nothing a rep learned is deleted.
 *
 * WHAT THAT OBLIGES. Two point totals, two milestone sets and two "best" figures now sit in one
 * control, one swipe apart. Each surface states what it counts, in its own copy, beside the number
 * — the Arena's badges were relabelled to say "session" where they said "pitch", and the Pitch
 * Score strip is headed "Milestones · pitches". A rep who can reach both and is told neither is
 * being asked to reconcile them privately, which the web's register names as the cost of this
 * decision that has never been priced.
 *
 * ONE PERIOD ACROSS PROGRESS AND BREAKDOWN, held here. The guide's Step 2 requires it: *"The period
 * selection carries across Progress and Breakdown."* Two boards reading different periods would
 * disagree while a rep switched between them, and the gauge is the last place anyone would notice.
 * It does NOT reach Metrics or Points, which have their own windows and say so.
 *
 * PAGE ORDER FOLLOWS THE DRAWING. Progress is index 0 and every open lands there, which is what the
 * mockup shows and also the answer to the question a rep opened the app to ask. The Arena was index
 * 0 until today; it is now index 3, and that is a real change to muscle memory — mitigated by its
 * own route surviving untouched, not by pretending it did not move.
 *
 * THE ARENA STILL HAS ITS OWN ROUTE. `/(app)/progress` renders the same page in its own shell, so
 * every existing link keeps working — from Home, from Account, and from the Scoreboard.
 *
 * THE SHELL LIVES HERE. Every page is a shell-less body; the safe-area insets, the control and the
 * horizontal track belong to this screen, which is what lets each page keep its own vertical
 * scroll untouched.
 */
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SwipePager } from '@/components/swipe-pager';
import { ArenaPage } from '@/components/arena-page';
import { DoorMetricsPage } from '@/components/door-metrics-page';
import { PaneBoundary } from '@/components/pane-boundary';
import { PitchBreakdownPage } from '@/components/pitch-breakdown-page';
import { PitchProgressPage } from '@/components/pitch-progress-page';
import { DEFAULT_PERIOD, type Period } from '@/lib/pitch-score/period';

export default function TodaysMetricsScreen() {
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <SwipePager
        pages={[
          {
            key: 'pitch-progress',
            label: 'Progress',
            render: () => (
              // Each pane has its OWN boundary. Putting four screens into one tree is what makes
              // that necessary: without it, a throw in any one of them replaces the whole tab, and
              // a rep at a door loses their field figures because a gauge failed.
              <PaneBoundary name="pitch-progress" subject="Your Pitch Score">
                <PitchProgressPage period={period} onPeriodChange={setPeriod} />
              </PaneBoundary>
            ),
          },
          {
            key: 'pitch-breakdown',
            label: 'Breakdown',
            render: () => (
              <PaneBoundary name="pitch-breakdown" subject="Your rubric averages">
                <PitchBreakdownPage period={period} onPeriodChange={setPeriod} />
              </PaneBoundary>
            ),
          },
          {
            key: 'metrics',
            label: 'Metrics',
            render: () => (
              <PaneBoundary name="door-metrics" subject="Today's metrics">
                <DoorMetricsPage />
              </PaneBoundary>
            ),
          },
          {
            key: 'points',
            label: 'Points',
            render: () => (
              <PaneBoundary name="arena" subject="Your points">
                <ArenaPage />
              </PaneBoundary>
            ),
          },
        ]}
      />
    </SafeAreaView>
  );
}
