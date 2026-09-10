/**
 * Today's Metrics — ONE module with TWO swipeable pages (spec §1).
 *
 * This tab used to be the door field read alone, and the Arena was a separate
 * screen a rep reached from Home or Account. The web app puts them together
 * behind a toggle, and the reason is the rep's own question: "how am I doing
 * today?" has two halves — how the doors went, and how the pitches scored — and
 * having to remember that one lives in a tab and the other behind a link is the
 * app asking the rep to know its filing system.
 *
 * PAGE ORDER IS NOT ARBITRARY. Progress is index 0 and every open lands there,
 * because it is the answer to the question the rep actually opened the app to
 * ask. The field metrics are the working detail behind it.
 *
 * THE ARENA STILL HAS ITS OWN ROUTE. `/(app)/progress` renders the same page in
 * its own shell, so every existing link to it keeps working — from Home, from
 * Account, and from the Scoreboard. Nothing was moved out from under a rep who
 * had learned where it was.
 *
 * THE SHELL LIVES HERE. Both pages are shell-less bodies; the safe-area insets,
 * the toggle and the horizontal track belong to this screen, which is what lets
 * each page keep its own vertical scroll untouched.
 */
import { SafeAreaView } from 'react-native-safe-area-context';

import { SwipePager } from '@/components/swipe-pager';
import { ArenaPage } from '@/components/arena-page';
import { DoorMetricsPage } from '@/components/door-metrics-page';
import { PaneBoundary } from '@/components/pane-boundary';

export default function TodaysMetricsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <SwipePager
        pages={[
          {
            key: 'progress',
            label: 'Progress',
            render: () => (
              // Each pane has its OWN boundary. Putting these two screens into one
              // tree is what made that necessary: without it, a throw in the Arena
              // replaces the whole tab, and a rep at a door loses their field
              // figures because a gauge failed. See pane-boundary.tsx.
              <PaneBoundary name="arena" subject="Your progress">
                <ArenaPage />
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
        ]}
      />
    </SafeAreaView>
  );
}
