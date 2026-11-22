"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Phone, Video } from "lucide-react";
import { StartSessionPanel } from "@/components/sales-coach/StartSessionPanel";
import { StageChips } from "@/components/sales-coach/StageChips";
import { outcomeLabel } from "@/lib/coach/v5/outcomeLabels";
import { conversationDurationSeconds } from "@/lib/coach/conversationDuration";
import { RemoteMacroToggle } from "@/components/remote-sales/RemoteMacroToggle";

/**
 * Remote Sales → Calls. The plan's "Done means" (docs/rss/docs/01-SCOPE.md): a rep uploads or live-records a phone or
 * video call, watches it go Uploading → Transcribing → Analysing → Scoring → Ready, and opens a session page with
 * talk-time lanes, stats, trackers and a scored rubric with evidence. So: start a call here, then every phone/video
 * call with its live stage chips. Rows open the session page, where the Remote call panel lives.
 *
 * Reads /api/coach/sales-session/list?context=remote (REMOTE_CONTEXTS, filtered in the query) — the same access rule
 * as everywhere: a rep sees their own calls, a manager their team.
 */
type Row = {
  id: string;
  clientLabel: string | null;
  context: "phone" | "video" | "in_person";
  status: "active" | "ended" | "reviewed";
  startedAt: string;
  endedAt: string | null;
  audioDurationSeconds: number | null;
  outcome: string | null;
  agentName: string | null;
};

const mmss = (s: number | null) => (s == null ? "—" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);

export function RemoteCallsHome() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/coach/sales-session/list?context=remote", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { sessions?: Row[]; isManager?: boolean; degraded?: boolean };
        if (!live) return;
        if (j.degraded || !j.sessions) throw new Error("degraded");
        setRows(j.sessions);
        setIsManager(!!j.isManager);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const weekAgo = Date.now() - 7 * 86_400_000;
  const thisWeek = (rows ?? []).filter((r) => Date.parse(r.startedAt) >= weekAgo).length;
  const withOutcome = (rows ?? []).filter((r) => r.outcome).length;

  return (
    <div className="space-y-6">
      <RemoteMacroToggle />
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Remote calls at a glance">
        {[
          { k: "Remote calls", v: rows ? rows.length : "—" },
          { k: "This week", v: rows ? thisWeek : "—" },
          { k: "With an outcome", v: rows ? withOutcome : "—" },
        ].map((t) => (
          <div key={t.k} className="rounded-xl border border-default bg-surface p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted">{t.k}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-primary">{t.v}</p>
          </div>
        ))}
      </section>

      <section aria-label="Start a remote call">
        <h2 className="mb-2 text-sm font-semibold text-primary">Start a call</h2>
        <p className="mb-3 text-xs text-secondary">
          Choose <b>Online video</b> or <b>Phone</b>. On the call&apos;s page, record it live or upload the recording; it is
          transcribed, analyzed and scored automatically.
        </p>
        <StartSessionPanel module="remote_sales" />
      </section>

      <section aria-label="Remote calls">
        <h2 className="mb-2 text-sm font-semibold text-primary">Calls</h2>
        {failed ? (
          <p className="rounded-xl border border-default bg-surface p-6 text-center text-xs text-muted">
            Couldn&apos;t load your calls. Refresh to try again.
          </p>
        ) : rows === null ? (
          <p className="flex items-center justify-center gap-2 p-6 text-xs text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading calls…
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-default bg-surface p-6 text-center text-xs text-secondary">
            No phone or video calls yet. Start one above, then record it live or upload the recording on its page.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/dashboard/remote-sales/calls/${r.id}`} className="flex flex-col gap-2 rounded-xl border border-default bg-surface p-4 hover:border-brand sm:flex-row sm:items-center">
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="shrink-0 text-muted">
                      {r.context === "phone" ? <Phone className="h-4 w-4" aria-label="Phone" /> : <Video className="h-4 w-4" aria-label="Video" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-primary">{r.clientLabel ?? "Untitled call"}</span>
                      <span className="block text-[11px] text-muted">
                        {new Date(r.startedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                        {mmss(conversationDurationSeconds(r.audioDurationSeconds, r.startedAt, r.endedAt))}
                        {isManager && r.agentName ? ` · ${r.agentName}` : ""}
                        {r.outcome ? ` · ${outcomeLabel(r.outcome)}` : r.status === "active" ? " · in progress" : " · no outcome yet"}
                      </span>
                    </span>
                  </span>
                  <span className="sm:shrink-0">
                    <StageChips sessionId={r.id} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
