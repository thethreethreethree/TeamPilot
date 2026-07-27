"use client";

import RcdPanel from "@/components/care/RcdPanel";

/**
 * /dashboard/care/rcd — Raw Conversation Data as a dedicated C.A.R.E Tools destination.
 *
 * Moved here from the persistent CareShell footer (founder 2026-07-28): RCD is now a deliberate
 * stop in C.A.R.E Tools rather than always-underfoot at the bottom of every page. RcdPanel is
 * self-contained (fetches its own data via useRcd + self-titles with a count badge), so we render
 * it defaultOpen — the panel IS the page here, so it should not start collapsed.
 */
export default function RcdPage() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-base">
      <div className="px-6 pt-6 pb-1">
        <p className="text-sm text-secondary leading-relaxed max-w-3xl">
          Full conversations captured from connected channels (WhatsApp, Gmail, and more) via the
          browser extension — every message, who said it, and any images — collected here so the
          whole team has the complete record in one place.
        </p>
      </div>
      <RcdPanel defaultOpen />
    </div>
  );
}
