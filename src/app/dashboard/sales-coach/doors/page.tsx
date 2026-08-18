import { DoorLog } from "@/components/sales-coach/doorlog/DoorLog";

/**
 * /dashboard/sales-coach/doors — Macro Mode Tab 1 (Door Log). The field UI; a per-rep toggle (alongside
 * the normal Sales Coach) routes reps here. Client-driven (recorder + state machine); this shell just
 * mounts it.
 */
export const dynamic = "force-dynamic";

export default function DoorsPage() {
  return <DoorLog />;
}
