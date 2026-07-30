"use client";

import { Shield, FileLock2, Trash2, History } from "lucide-react";

/**
 * C.A.R.E Data & Privacy — transparency (settings pillar 4a, the non-destructive half).
 *
 * Read-only, honest statement of how C.A.R.E handles data. It describes MECHANISMS that exist in the
 * codebase (append-only immutability via DB triggers; the RCD retention purge with a configurable window +
 * media-bytes-first deletion) — it does NOT claim data "is purged" as a fact, because the purge cron is a
 * deployment step (CRON_SECRET + a schedule). Honesty-first: state what's guaranteed + what's a config
 * step, never a comforting claim the system isn't actually performing.
 *
 * Honesty-first: it states what's guaranteed + what's a config step, never a comforting claim the system
 * isn't actually performing. Per-tenant retention CONTROL + data EXPORT are deliberately NOT here yet —
 * those are founder decisions (retention = a data-deletion policy; export = a new PII-bearing endpoint).
 * This panel makes the current posture visible; it does not fake a control.
 */
export function DataPrivacyPanel() {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <Shield className="w-3.5 h-3.5 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold text-primary">Data &amp; privacy</h2>
      </div>
      <p className="text-xs text-secondary leading-relaxed">
        How C.A.R.E handles your data. This is a transparency summary — the current guarantees, stated
        honestly.
      </p>

      <ul className="space-y-2.5">
        <li className="flex items-start gap-2.5 rounded-lg border border-default bg-base p-3">
          <History className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
          <span className="min-w-0">
            <span className="block text-xs font-medium text-primary">Append-only history</span>
            <span className="block text-[11px] text-muted mt-0.5">
              Conversations and messages are recorded as history and are immutable at the database level —
              the system appends, it never silently edits or erases what happened.
            </span>
          </span>
        </li>
        <li className="flex items-start gap-2.5 rounded-lg border border-default bg-base p-3">
          <FileLock2 className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
          <span className="min-w-0">
            <span className="block text-xs font-medium text-primary">Customer content is access-controlled</span>
            <span className="block text-[11px] text-muted mt-0.5">
              If you capture conversations from third-party channels, that customer content and any media are
              stored as PII in private, per-tenant storage — reachable only through short-lived signed access,
              not public URLs.
            </span>
          </span>
        </li>
        <li className="flex items-start gap-2.5 rounded-lg border border-default bg-base p-3">
          <Trash2 className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
          <span className="min-w-0">
            <span className="block text-xs font-medium text-primary">Retention purge</span>
            <span className="block text-[11px] text-muted mt-0.5">
              A retention job removes captured customer data older than a configurable window (default 90
              days), deleting the media bytes from storage first so nothing is left orphaned. Confirm with
              your admin that it&apos;s scheduled for your deployment — until it&apos;s scheduled, nothing is
              purged.
            </span>
          </span>
        </li>
      </ul>

      <p className="text-[11px] text-muted">
        Want a custom retention window or a data export? Those are deliberate choices we set up with you —
        ask and we&apos;ll configure them; we don&apos;t show a control here that isn&apos;t actually wired.
      </p>
    </section>
  );
}
