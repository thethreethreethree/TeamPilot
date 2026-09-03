import { CalibrationTool } from "@/components/sales-coach/CalibrationTool";

/**
 * /dashboard/sales-coach/calibration — gamification Phase 6. A manager hand-scores transcripts blind and compares
 * to the AI, to confirm the score is trustworthy before it drives the leaderboard. Manager-only (the route + nav
 * both gate it). The SalesCoachShell layout provides the nav.
 */
export default function CalibrationPage() {
  return <CalibrationTool />;
}
