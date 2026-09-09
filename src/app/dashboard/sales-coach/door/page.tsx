import TopBar from "@/components/layout/TopBar";
import { DoorScreen } from "@/components/sales-coach/doorlog/DoorScreen";

/**
 * Reachable preview of the door home screen (docs/2ND MAIN PANEL DASKBOARD, Phase 07). This direct route lets
 * the founder + reps see the screen on a real device BEFORE it becomes page 0 of the Home pager (Phase 06,
 * the last increment) — de-risking the change to the live Macro home.
 */
export default function DoorHomePreviewPage() {
  return (
    <>
      <TopBar title="Door tracker" subtitle="Sales Coach" />
      <div className="flex-1 overflow-y-auto bg-base">
        <DoorScreen />
      </div>
    </>
  );
}
