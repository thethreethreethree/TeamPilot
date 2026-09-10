/**
 * Report a problem, from OUTSIDE the app.
 *
 * WHY THIS ROUTE EXISTS. The reporting screen lived only behind the auth gate,
 * which meant the one failure it could never hear about was the one most likely
 * to strand a rep: not being able to sign in. A person locked out has no menu,
 * no Home, and — until this — no way to tell anybody.
 *
 * Same component as the in-app route. It works signed out: the report says
 * "Account: not signed in" rather than leaving a blank, and the crash log lives
 * on the phone rather than in a session.
 *
 * BOTH EDGES ARE CLAIMED HERE, unlike the in-app twin. There is no native header
 * above this one to supply the top inset.
 */
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReportProblemPage } from '@/components/report-problem-page';

export default function AuthReportProblemScreen() {
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <ReportProblemPage />
    </SafeAreaView>
  );
}
