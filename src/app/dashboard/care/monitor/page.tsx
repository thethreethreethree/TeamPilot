"use client";

import { Activity } from "lucide-react";

export default function CareMonitorPage() {
  return (
    <>
      <header className="px-8 py-4 border-b border-default bg-base/60">
        <h1 className="text-lg font-semibold text-primary">Monitor</h1>
        <p className="text-[11px] text-muted">
          Live view of who&apos;s on the site and what they&apos;re looking at
        </p>
      </header>
      <div className="flex-1 flex items-center justify-center px-8 text-center">
        <div>
          <Activity
            className="w-10 h-10 text-muted mx-auto mb-3"
            aria-hidden
          />
          <p className="text-sm text-primary font-medium mb-1">
            Live monitor coming next
          </p>
          <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
            Real-time view of active visitors, their pages, and pending chats.
            Wires to Supabase realtime channels — Sprint 3d.
          </p>
        </div>
      </div>
    </>
  );
}
