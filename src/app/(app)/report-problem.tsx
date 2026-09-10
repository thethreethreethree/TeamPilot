/**
 * Report a problem, inside the app.
 *
 * The body is `components/report-problem-page.tsx`, shared with the route under
 * `(auth)` so a rep who cannot sign in reaches the same screen. One page, two
 * doors, rather than two pages that drift apart.
 *
 * THIS SHELL GUARDS THE BOTTOM EDGE ONLY. It is a pushed screen with a native
 * header above it, which supplies the top inset.
 */
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReportProblemPage } from '@/components/report-problem-page';

export default function ReportProblemScreen() {
  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <ReportProblemPage />
    </SafeAreaView>
  );
}
