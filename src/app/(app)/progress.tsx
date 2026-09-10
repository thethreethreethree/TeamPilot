/**
 * Your Progress — the rep Arena, on its own route.
 *
 * THE SAME PAGE THE PAGER SHOWS. Spec §1 makes the Arena page A of Today's
 * Metrics, and it is; this route exists because it was already there. Home, the
 * Account screen and the Scoreboard all link here, and reps have learned where
 * it lives. Moving a destination out from under someone to satisfy a diagram is
 * the kind of tidy-up that costs a person their place and buys nothing.
 *
 * The body is `components/arena-page.tsx`, imported by both, so there is one
 * Arena rather than two that can drift.
 *
 * THIS SHELL GUARDS THE BOTTOM EDGE ONLY. It is a pushed screen with a native
 * header above it, which supplies the top inset; claiming the top here as well
 * would leave a band of dead space under the header.
 */
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArenaPage } from '@/components/arena-page';

export default function ProgressScreen() {
  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <ArenaPage />
    </SafeAreaView>
  );
}
