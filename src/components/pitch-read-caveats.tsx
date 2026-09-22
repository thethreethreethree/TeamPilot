/**
 * What the read says about ITSELF — rendered on every board that prints its numbers.
 *
 * TWO CAVEATS, BOTH USUALLY FALSE, BOTH RENDERED ANYWAY. That is the whole point of them. A board
 * that averaged over a bound it silently hit reports a different number from the one it names, and
 * nothing on screen is wrong: the figure is correct for the rows that were read and the caption
 * describes the period that was asked for.
 *
 *   `capped` — the server's reader hit its row bound, so these are a TRUNCATION of the period
 *   rather than the period. It is the reader's own verdict, not `rows.length >= limit`, because a
 *   caller re-deriving that from a copied constant keeps answering with the old number the first
 *   time the limit moves. One route on the web was doing exactly that.
 *
 *   `skippedPreVerdict` — pitches scored before `section_points` existed. Including them with
 *   zeros would drag every section average down and read as a coaching problem; guessing their
 *   sections would be wrong on any objection-free pitch. So the server excludes and COUNTS them,
 *   and the count is only useful if somebody prints it.
 *
 * ONE COMPONENT BECAUSE TWO BOARDS SHOW THE SAME READ. Progress and Breakdown are panes of one
 * screen, sharing one period and — since the in-flight coalescer — literally one response. Two
 * copies of this wording would have been correct on the day they were written, which is the
 * property that makes duplicated decisions invisible in this product's own register.
 */
import { Text } from 'react-native';

import type { BreakdownResponse } from '@/lib/pitch-score/types';

export function PitchReadCaveats({ data }: { data: BreakdownResponse }) {
  const skipped = data.skippedPreVerdict;

  return (
    <>
      {data.capped ? (
        <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
          This is as far back as the read goes, so these figures cover part of the period rather
          than all of it.
        </Text>
      ) : null}

      {skipped > 0 ? (
        <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
          {skipped} {skipped === 1 ? 'pitch was' : 'pitches were'} scored before the section
          breakdown existed, so {skipped === 1 ? 'it is' : 'they are'} left out of these averages
          rather than counted as zero.
        </Text>
      ) : null}
    </>
  );
}
