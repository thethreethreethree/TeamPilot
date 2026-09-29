"use client";

import { DoorOpen } from "lucide-react";
import { DeckButton } from "@/components/sales-coach/ui/deck";

/**
 * "Start Knocking" — the one button that begins a shift, on BOTH pages of the phone Home pager.
 *
 * Page 1 (the welcome page) has always had it. Page 0 (DoorScreen — the door target a rep LANDS on)
 * gained it on 2026-09-29: the founder's REV 1 note "Put start knocking button at the bottom", confirmed
 * for the app as "bottom of the first Home page" and then for the website as "match it on the website".
 * The Expo app renders its own `StartKnockingButton` in the same two places, so the two stay one product.
 *
 * ONE COMPONENT rather than two copies, because two copies of one button drift — a label, an icon or a
 * destination changed on one page and not the other.
 */
export function StartKnockingButton({ onClick }: { onClick: () => void }) {
  return (
    <DeckButton icon={<DoorOpen className="w-4 h-4" aria-hidden />} onClick={onClick} className="w-full">
      Start Knocking
    </DeckButton>
  );
}
