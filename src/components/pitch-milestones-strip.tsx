/**
 * MILESTONES — the Progress board's badge strip (mockup p1, element 10).
 *
 * THE PERIOD TOGGLE DOES NOT REACH THIS STRIP, and it says so on screen. Every badge here is a
 * first or an Nth — your first counted pitch, your hundredth — so the route takes no period at all.
 * A strip sitting under a Day gauge with nothing said would read as "your milestones today", which
 * is a sentence that cannot be true. One line of copy is cheaper than the alternative, which is a
 * rep quietly learning the wrong thing about what the toggle changes.
 *
 * EARNED SHOWS THE DATE, UNEARNED SHOWS THE CRITERIA [OBSERVED, mockup p1: earned badges are amber
 * with a date beneath, unearned are grey with the condition]. A locked badge whose condition is
 * hidden is just a locked box — it tells a rep something exists and nothing about how to reach it.
 *
 * THE THIRD STATE IS THE ONE THAT MATTERS. `milestoneStatus` returns 'unknown' when the server did
 * not send a key at all, which is not the same as sending null. Rendering the two the same way
 * tells a rep who has recorded a hundred pitches that they have recorded none — the confident-zero
 * failure this app has now caught six times.
 *
 * NOT THE ARENA'S FIVE. These count qualifying PITCHES; the Arena's count SESSIONS on the points
 * ledger, and both are reachable in one swipe under the founder's R-D ruling. The header says which
 * this is, beside the number, because a rep asked to reconcile two unlabelled sets privately is
 * being handed the cost §M of the web's register names as never having been priced.
 */
import { Text, View } from 'react-native';

import { badgeDay } from '@/lib/format';
import { milestoneLine } from '@/lib/gamification/milestone-dates';
import { pitchMilestoneRows } from '@/lib/pitch-score/milestones';
import type { MilestonesResponse } from '@/lib/pitch-score/types';

export function PitchMilestonesStrip({ data }: { data: MilestonesResponse | null }) {
  return (
    <View className="mt-8 gap-2">
      <Text
        accessibilityRole="header"
        className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
      >
        Milestones · pitches
      </Text>

      {data == null ? (
        <Text className="font-body text-sm leading-relaxed text-muted-foreground">
          Could not load your milestones. Pull down to try again.
        </Text>
      ) : (
        <>
          <Text className="font-body text-xs leading-relaxed text-muted-foreground">
            Each one is a first, so the period above does not change them. Your session badges are
            in Points and count something else.
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {pitchMilestoneRows(data.milestones).map((m) => {
              const earned = m.status.state === 'earned';
              /*
                SHARED WITH THE ARENA, NOT RE-IMPLEMENTED. This was nine lines re-deriving exactly
                what `milestoneLine` already does — date when earned, criteria when not, a failure
                sentence otherwise. It was caught the moment that failure sentence was reworded:
                one copy changed and this one did not, which is the duplicated-decision class in
                miniature and inside a file whose own docblock warns about it.

                The mockup shows the criteria ONLY where the badge is unearned — once you have it,
                what it took is no longer the useful sentence; when you got it is. That is the rule
                `milestoneLine` encodes.
              */
              const line = milestoneLine(m.status, m.caption, badgeDay);

              return (
                <View
                  key={m.key}
                  accessible
                  accessibilityLabel={
                    m.status.state === 'earned'
                      ? `${m.title}: earned ${badgeDay(m.status.at)}`
                      : m.status.state === 'not-yet'
                        ? `${m.title}: not yet. ${m.caption}`
                        : `${m.title}: cannot be checked right now. ${m.caption}`
                  }
                  className={`rounded-lg border px-3 py-2 ${
                    earned ? 'border-primary bg-surface' : 'border-border-control'
                  }`}
                >
                  <Text
                    className={`font-emphasis text-sm ${
                      earned ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {m.title}
                  </Text>
                  <Text className="mt-1 font-body text-xs text-muted-foreground">{line}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}
