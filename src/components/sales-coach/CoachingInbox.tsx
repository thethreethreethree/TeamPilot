"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Inbox, Loader2 } from "lucide-react";

/**
 * The manager's coaching inbox on Coach Assessment (RSS Phase 4, Gong F16.4; docs/rss/docs/06-UI-SPEC.md).
 *
 * Every feedback request from a rep the manager may see (reporting tree), with columns:
 *   Rep · Call · Asked · Note · Status (Open / Answered — in words) · You played (how much of the call you heard).
 * Filters: Open only / all, and To you / everyone. Each row links to the call, where the manager comments,
 * corrects or answers; any of those sent to the rep closes the request (derived server-side, never stored).
 *
 * Coaching METRICS sit under the list and show the D8 line until D8 is decided — never a number under a guess.
 * Empty, waiting-on-migration and failed are three different sentences: an unreadable inbox must never read as
 * an empty one.
 */
type Item = {
  id: string;
  sessionId: string;
  repName: string | null;
  callLabel: string | null;
  context: string | null;
  askedAt: string;
  message: string | null;
  toYou: boolean;
  toNamedManager: boolean;
  open: boolean;
  youListenedSeconds: number;
};
type Wire = { available: false; reason: string } | { available: true; items: Item[] };
type Metrics =
  | { decided: false; decision: string; reason: string }
  | { decided: true; since: string; sessions: number; feedbackGiven: Record<string, number>; callsListened: Record<string, number> };

const CHANNEL: Record<string, string> = { phone: "Phone", video: "Video", in_person: "In person" };
const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

export function CoachingInbox() {
  const [wire, setWire] = useState<Wire | null>(null);
  const [failed, setFailed] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [openOnly, setOpenOnly] = useState(true);
  const [toYouOnly, setToYouOnly] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let live = true;
    fetch("/api/coach/remote/coaching-inbox")
      .then(async (r) => {
        if (r.status === 403) return null; // not a manager: render nothing
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as Wire;
      })
      .then((w) => live && w && setWire(w))
      .catch(() => live && setFailed(true));
    fetch("/api/team")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { members?: Array<{ id: string; full_name?: string | null }> } | null) => {
        if (live && d?.members) setNames(Object.fromEntries(d.members.map((m) => [m.id, m.full_name ?? "Unnamed teammate"])));
      })
      .catch(() => {});
    fetch("/api/coach/remote/coaching-metrics")
      .then(async (r) => (r.status === 409 || r.ok ? ((await r.json()) as Metrics) : null))
      .then((m) => live && m && setMetrics(m))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const items = useMemo(
    () => (wire && wire.available ? wire.items.filter((i) => (!openOnly || i.open) && (!toYouOnly || i.toYou)) : []),
    [wire, openOnly, toYouOnly],
  );

  if (!wire && !failed) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading the coaching inbox…
      </p>
    );
  }
  if (failed) return <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">The coaching inbox couldn&apos;t be loaded. Reload to try again.</p>;
  if (!wire) return null;
  if (!wire.available) return <p className="text-xs text-muted">{wire.reason}</p>;

  const openCount = wire.items.filter((i) => i.open).length;

  return (
    <section className="rounded-2xl border border-default bg-surface p-4 space-y-3" aria-label="Coaching inbox">
      <div className="flex flex-wrap items-center gap-2">
        <Inbox className="h-4 w-4 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold text-primary">Feedback requests</h2>
        <span className="text-xs text-muted">{openCount} open</span>
        <div className="ml-auto flex gap-1" role="group" aria-label="Filters">
          <button type="button" aria-pressed={openOnly} onClick={() => setOpenOnly(!openOnly)}
            className={`rounded-full border px-2.5 py-1 text-[11px] ${openOnly ? "border-strong text-primary font-semibold" : "border-default text-muted"}`}>
            Open only
          </button>
          <button type="button" aria-pressed={toYouOnly} onClick={() => setToYouOnly(!toYouOnly)}
            className={`rounded-full border px-2.5 py-1 text-[11px] ${toYouOnly ? "border-strong text-primary font-semibold" : "border-default text-muted"}`}>
            To you
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted">
          {wire.items.length === 0 ? "No rep has asked for feedback in the last 90 days." : "Nothing matches these filters."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-muted">
              <tr>
                <th className="py-1 pr-3 font-medium">Rep</th>
                <th className="py-1 pr-3 font-medium">Call</th>
                <th className="py-1 pr-3 font-medium">Asked</th>
                <th className="py-1 pr-3 font-medium">Note</th>
                <th className="py-1 pr-3 font-medium">Status</th>
                <th className="py-1 font-medium">You played</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-t border-default align-top">
                  <td className="py-2 pr-3 text-primary">{i.repName ?? "A rep"}</td>
                  <td className="py-2 pr-3">
                    <Link href={`/dashboard/remote-sales/calls/${i.sessionId}`} className="text-brand hover:underline">
                      {i.callLabel || "Untitled call"}
                    </Link>
                    <span className="block text-[10px] text-muted">{CHANNEL[i.context ?? ""] ?? "Call"}</span>
                  </td>
                  <td className="py-2 pr-3 text-muted whitespace-nowrap">
                    {ago(i.askedAt)}
                    <span className="block text-[10px]">{i.toNamedManager ? (i.toYou ? "to you" : "to their manager") : "to managers"}</span>
                  </td>
                  <td className="py-2 pr-3 text-secondary max-w-[18rem]">{i.message ?? <span className="text-muted">—</span>}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {i.open ? <span className="font-semibold text-primary">Open</span> : <span className="text-muted">Answered</span>}
                  </td>
                  <td className="py-2 tabular-nums text-muted">{i.youListenedSeconds > 0 ? mmss(i.youListenedSeconds) : "not yet"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-muted">
        A request closes when a comment sent to the rep, a score correction or a dispute answer is made on that call after it.
        {metrics && !metrics.decided ? ` Coaching metrics: not shown yet — ${metrics.reason}` : ""}
      </p>
      {/* Coaching metrics (D8 decided 2026-11-22): per manager, over the last 30 days of phone/video calls they may see.
          Feedback = deliberate coaching (a comment sent, a correction, a dispute answer, a pattern coached); listened =
          played at least half the call. */}
      {metrics?.decided && (
        <div className="rounded-xl border border-default bg-base/40 p-3" aria-label="Coaching metrics">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-primary">Coaching in the last 30 days</p>
            {/* Coaching export (2026-11-23, F16.11): the same numbers as a CSV; the download is audit-logged. */}
            <a href="/api/coach/remote/coaching-metrics?format=csv" className="text-[11px] text-brand hover:underline">Download CSV</a>
          </div>
          {(() => {
            const ids = [...new Set([...Object.keys(metrics.feedbackGiven), ...Object.keys(metrics.callsListened)])].sort(
              (a, b) => (metrics.feedbackGiven[b] ?? 0) - (metrics.feedbackGiven[a] ?? 0),
            );
            if (ids.length === 0) {
              return (
                <p className="mt-1 text-xs text-secondary">
                  No feedback given or calls listened to yet across {metrics.sessions} phone and video {metrics.sessions === 1 ? "call" : "calls"}.
                </p>
              );
            }
            return (
              <table className="mt-2 w-full text-left text-xs">
                <thead className="text-[11px] text-muted">
                  <tr>
                    <th className="py-1 font-normal">Manager</th>
                    <th className="py-1 font-normal">Feedback given</th>
                    <th className="py-1 font-normal">Calls listened to</th>
                  </tr>
                </thead>
                <tbody>
                  {ids.map((id) => (
                    <tr key={id} className="border-t border-default">
                      <td className="py-1.5 text-primary">{names[id] ?? "A teammate"}</td>
                      <td className="py-1.5 tabular-nums text-primary">{metrics.feedbackGiven[id] ?? 0}</td>
                      <td className="py-1.5 tabular-nums text-primary">{metrics.callsListened[id] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
          <p className="mt-1 text-[11px] text-muted">
            Feedback counts a comment sent to the rep, a score correction, a dispute answer or a pattern marked coached. A call
            counts as listened once at least half of it was played.
          </p>
        </div>
      )}
    </section>
  );
}
