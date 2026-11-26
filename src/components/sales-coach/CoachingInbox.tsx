"use client";

import { withTeam } from "@/lib/coach/remote/teamQuery";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Inbox, Loader2 } from "lucide-react";
import type { RepCoaching } from "@/lib/coach/remote/feedback";
import { ALERT_WORDS, type AlertKind } from "@/lib/coach/remote/interactionAlerts";
import { useCurrentUserId } from "@/lib/hooks/useCurrentUserId";

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
type Wire = { available: false; reason: string } | { available: true; items: Item[]; truncated?: boolean };
type Metrics =
  | { decided: false; decision: string; reason: string }
  | {
      decided: true;
      since: string;
      sessions: number;
      feedbackGiven: Record<string, number>;
      /** F16.8: distinct calls with feedback / with a comment sent, per manager. Absent from an older server. */
      callsWithFeedback?: Record<string, number>;
      callsWithComments?: Record<string, number>;
      callsListened: Record<string, number>;
      /** F16.8: median hours from a request to this manager's first answer, and how many answers. */
      responseHours?: Record<string, { medianHours: number; answered: number }>;
      /** F16.5 (2026-11-25): one row per rep — RepCoaching from feedback.ts, already sorted overdue-first. */
      byRep?: RepCoaching[];
      /** F16.8 (2026-11-26): the same counts for the same length of time just before. Absent from an older server. */
      previous?: {
        feedbackGiven: Record<string, number>;
        callsWithFeedback: Record<string, number>;
        callsWithComments: Record<string, number>;
        callsListened?: Record<string, number>;
        responseHours?: Record<string, { medianHours: number; answered: number }>;
      };
      /** The period the numbers cover (7, 30 or 90 days). Absent from an older server, which always counted 30. */
      days?: number;
      /** F16.6 (2026-11-26): interaction alerts on the calls not yet coached; null = couldn't load; absent = none to check. */
      alerts?: { baselineCalls: number; needed: number; byCall: Record<string, AlertKind[]> } | null;
    };

const CHANNEL: Record<string, string> = { phone: "Phone", video: "Video", in_person: "In person" };
const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

const daysAgo = (iso: string) => {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};


/** The change against the same length of time just before (F16.8): "▲3" / "▼2"; nothing when unchanged or unknown.
 *  Neutral colour — the team's own trend, not a grade (a slower response is shown the same way as a faster one). */
function Delta({ now, before, days, unit = "" }: { now: number | undefined; before: number | undefined; days: number; unit?: string }) {
  if (now === undefined || before === undefined || now === before) return null;
  const d = Math.round((now - before) * 10) / 10;
  if (d === 0) return null;
  return (
    <span className="ml-1 text-[10px] text-muted" title={`${before}${unit} in the ${days} days before`}>
      {d > 0 ? "▲" : "▼"}
      {Math.abs(d)}
      {unit}
    </span>
  );
}

const PERIODS = [7, 30, 90] as const;
const hoursText = (h: number) => (h < 24 ? `${h} h` : `${Math.round((h / 24) * 10) / 10} d`);
/** The response-time change in the unit shown beside it: hours under a day, else days (review 2026-11-26). */
const responseDelta = (now: number, before: number, days: number) =>
  now < 24 ? <Delta now={now} before={before} days={days} unit=" h" /> : <Delta now={Math.round((now / 24) * 10) / 10} before={Math.round((before / 24) * 10) / 10} days={days} unit=" d" />;

export function CoachingInbox({ team }: { team?: string } = {}) {
  // F16.6: which rep's uncoached calls are listed (one at a time).
  const [openRep, setOpenRep] = useState<string | null>(null);
  // F16.6 (2026-11-26): in that list, only the calls with an interaction alert.
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [wire, setWire] = useState<Wire | null>(null);
  const [failed, setFailed] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [openOnly, setOpenOnly] = useState(true);
  const [toYouOnly, setToYouOnly] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  // F16.8 (2026-11-26): the period the manager table covers — the same choices as Team call stats.
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  // F16.6 (2026-11-26): looking at another manager's team, whose coaching to show — everyone's, only that manager's
  // (theirs), or only yours. A filter on the rows; the numbers themselves don't change.
  const me = useCurrentUserId();
  const [coachedBy, setCoachedBy] = useState<"all" | "theirs" | "mine">("all");
  useEffect(() => setCoachedBy("all"), [team]);
  // Whether the metrics are decided (D8), kept apart from the numbers so the period buttons stay on screen while a
  // period loads or after it fails (review 2026-11-26: clearing the numbers used to take the buttons with them).
  const [metricsDecided, setMetricsDecided] = useState(false);
  const [metricsFailed, setMetricsFailed] = useState(false);

  useEffect(() => {
    let live = true;
    // A new team: clear the last one's numbers first, so a failed or refused load never leaves them on screen
    // under the new team's name (review 2026-11-26).
    setWire(null);
    setFailed(false);
    setOpenRep(null);
    fetch(withTeam("/api/coach/remote/coaching-inbox", team))
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
    return () => {
      live = false;
    };
  }, [team]);

  // The metrics follow the team AND the period. Cleared first, so a slow or failed load never shows the last team's
  // or period's numbers under the new heading; `live` drops an answer that arrives after a newer choice.
  useEffect(() => {
    let live = true;
    setMetrics(null);
    setMetricsFailed(false);
    fetch(withTeam(`/api/coach/remote/coaching-metrics?days=${days}`, team))
      .then(async (r) => (r.status === 409 || r.ok ? ((await r.json()) as Metrics) : Promise.reject(new Error(String(r.status)))))
      .then((m) => {
        if (!live) return;
        setMetrics(m);
        setMetricsDecided(!!m.decided);
      })
      .catch(() => live && setMetricsFailed(true));
    return () => {
      live = false;
    };
  }, [team, days]);

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
          {wire.available && wire.truncated && (
            <p className="mb-1 text-[11px] text-secondary">Showing the {wire.items.length} most recent requests from the last 90 days.</p>
          )}
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
      {(metrics?.decided || (metricsDecided && !metrics)) && (
        <div className="rounded-xl border border-default bg-base/40 p-3" aria-label="Coaching metrics">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-primary">Coaching in the last {metrics?.days ?? days} days</p>
            <div className="flex items-center gap-3">
              {/* Another manager's team: whose coaching to show (only shown when a team other than yours is picked). */}
              {team && team !== me && (
                <div className="flex gap-1" role="group" aria-label="Coaching by">
                  {(["all", "theirs", "mine"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={coachedBy === k}
                      onClick={() => setCoachedBy(k)}
                      className={`rounded px-1.5 py-0.5 text-[11px] ${coachedBy === k ? "bg-surface-raised font-semibold text-primary" : "text-muted hover:text-primary"}`}
                    >
                      {k === "all" ? "Everyone" : k === "theirs" ? names[team] ?? "Their manager" : "You"}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-1" role="group" aria-label="Period">
                {PERIODS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={days === p}
                    onClick={() => setDays(p)}
                    className={`rounded px-1.5 py-0.5 text-[11px] ${days === p ? "bg-surface-raised font-semibold text-primary" : "text-muted hover:text-primary"}`}
                  >
                    {p} days
                  </button>
                ))}
              </div>
              {/* Coaching export (2026-11-23, F16.11): the same numbers as a CSV — same team and period as on screen
                  (2026-11-26: the link used to ignore the team picker); the download is audit-logged. */}
              <a href={withTeam(`/api/coach/remote/coaching-metrics?format=csv&days=${days}`, team)} className="text-[11px] text-brand hover:underline">Download CSV</a>
            </div>
          </div>
          {!metrics && (
            <p className="mt-1 text-xs text-secondary" role={metricsFailed ? "alert" : undefined}>
              {metricsFailed ? `Couldn't load coaching for the last ${days} days. Pick a period to try again.` : "Loading…"}
            </p>
          )}
          {metrics && (() => {
            // A manager who coached in the period before but not now still gets a row — their ▼ is the point (F16.8).
            const ids = [...new Set([...Object.keys(metrics.feedbackGiven), ...Object.keys(metrics.callsListened), ...Object.keys(metrics.responseHours ?? {}), ...Object.keys(metrics.previous?.feedbackGiven ?? {}), ...Object.keys(metrics.previous?.callsListened ?? {}), ...Object.keys(metrics.previous?.responseHours ?? {})])]
              .filter((id) => coachedBy === "all" || (coachedBy === "theirs" ? id === team : id === me))
              .sort((a, b) => (metrics.feedbackGiven[b] ?? 0) - (metrics.feedbackGiven[a] ?? 0));
            if (ids.length === 0 && coachedBy !== "all") {
              return <p className="mt-1 text-xs text-secondary">{coachedBy === "mine" ? "You haven't coached this team in this period." : "That manager hasn't coached their team in this period."}</p>;
            }
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
                    <th className="py-1 font-normal">Calls with feedback</th>
                    <th className="py-1 font-normal">Calls with comments</th>
                    <th className="py-1 font-normal">Calls listened to</th>
                    <th className="py-1 font-normal">Typical response</th>
                  </tr>
                </thead>
                <tbody>
                  {ids.map((id) => (
                    <tr key={id} className="border-t border-default">
                      <td className="py-1.5 text-primary">{names[id] ?? "A teammate"}</td>
                      <td className="py-1.5 tabular-nums text-primary">
                        {metrics.feedbackGiven[id] ?? 0}
                        {metrics.previous && <Delta now={metrics.feedbackGiven[id] ?? 0} before={metrics.previous.feedbackGiven[id] ?? 0} days={metrics.days ?? 30} />}
                      </td>
                      <td className="py-1.5 tabular-nums text-primary">
                        {metrics.callsWithFeedback?.[id] ?? 0}
                        {metrics.previous && <Delta now={metrics.callsWithFeedback?.[id] ?? 0} before={metrics.previous.callsWithFeedback[id] ?? 0} days={metrics.days ?? 30} />}
                      </td>
                      <td className="py-1.5 tabular-nums text-primary">
                        {metrics.callsWithComments?.[id] ?? 0}
                        {metrics.previous && <Delta now={metrics.callsWithComments?.[id] ?? 0} before={metrics.previous.callsWithComments[id] ?? 0} days={metrics.days ?? 30} />}
                      </td>
                      <td className="py-1.5 tabular-nums text-primary">
                        {metrics.callsListened[id] ?? 0}
                        {metrics.previous?.callsListened && <Delta now={metrics.callsListened[id] ?? 0} before={metrics.previous.callsListened[id] ?? 0} days={metrics.days ?? 30} />}
                      </td>
                      <td className="py-1.5 tabular-nums text-secondary">
                        {metrics.responseHours?.[id] ? `${hoursText(metrics.responseHours[id]!.medianHours)} (${metrics.responseHours[id]!.answered})` : "—"}
                        {/* Only when both periods have answers: "no answers" is not zero hours. */}
                        {metrics.responseHours?.[id] && metrics.previous?.responseHours?.[id] && (
                          responseDelta(metrics.responseHours[id]!.medianHours, metrics.previous.responseHours[id]!.medianHours, metrics.days ?? 30)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
          <p className="mt-1 text-[11px] text-muted">
            Feedback counts a comment sent to the rep, a score correction, a dispute answer or a pattern marked coached. A call
            counts as listened once at least half of it was played. Typical response: the middle time from a rep&apos;s request
            to that manager&apos;s answer (how many answers in brackets). ▲/▼ compare with the {metrics?.days ?? days} days just before.
          </p>
        </div>
      )}
      {/* By rep (F16.5): who needs coaching — overdue first. Same rule and same 30 days as the table above. */}
      {metrics?.decided && metrics.byRep && metrics.byRep.length > 0 && (
        <div className="rounded-xl border border-default bg-base/40 p-3" aria-label="Coaching by rep">
          <p className="text-xs font-semibold text-primary">Your reps, last 30 days</p>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-left text-xs">
              <thead className="text-[11px] text-muted">
                <tr>
                  <th className="py-1 pr-2 font-normal">Rep</th>
                  <th className="py-1 pr-2 font-normal">Last feedback</th>
                  <th className="py-1 pr-2 text-right font-normal">Feedback</th>
                  <th className="py-1 pr-2 text-right font-normal">Open requests</th>
                  <th className="py-1 text-right font-normal">Calls · not yet coached</th>
                </tr>
              </thead>
              <tbody>
                {metrics.byRep.map((r) => (
                  <tr key={r.repId} className="border-t border-default">
                    <td className="py-1.5 pr-2 text-primary">{r.name}</td>
                    <td className={`py-1.5 pr-2 ${r.overdue ? "text-amber-700 dark:text-amber-300" : "text-secondary"}`}>
                      {r.overdue ? "Overdue · " : ""}
                      {r.lastFeedbackAt ? daysAgo(r.lastFeedbackAt) : "never"}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-primary">{r.feedback30}</td>
                    <td className={`py-1.5 pr-2 text-right tabular-nums ${r.openRequests ? "font-semibold text-primary" : "text-muted"}`}>{r.openRequests}</td>
                    <td className="py-1.5 text-right tabular-nums text-secondary">
                      {r.calls30} ·{" "}
                      {r.callsWithoutFeedback30 > 0 ? (
                        <button
                          type="button"
                          aria-expanded={openRep === r.repId}
                          onClick={() => setOpenRep(openRep === r.repId ? null : r.repId)}
                          className="font-semibold text-brand hover:underline"
                        >
                          {r.callsWithoutFeedback30}
                        </button>
                      ) : (
                        0
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(() => {
            const rep = metrics.byRep.find((x) => x.repId === openRep);
            if (!rep || rep.uncoached.length === 0) return null;
            const alerts = metrics.alerts;
            const alertsOf = (id: string) => alerts?.byCall[id] ?? [];
            const flagged = rep.uncoached.filter((c) => alertsOf(c.id).length > 0).length;
            const shown = alertsOnly && alerts ? rep.uncoached.filter((c) => alertsOf(c.id).length > 0) : rep.uncoached;
            return (
              <div className="mt-2 rounded-lg border border-default bg-surface p-2" aria-label={`${rep.name}'s calls not yet coached`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-primary">{rep.name}&apos;s calls with no feedback yet</p>
                  {alerts && alerts.needed === 0 && (
                    <label className="flex items-center gap-1 text-[11px] text-secondary">
                      <input type="checkbox" checked={alertsOnly} onChange={(e) => setAlertsOnly(e.target.checked)} />
                      Only calls with an interaction alert ({flagged})
                    </label>
                  )}
                </div>
                {alerts === null && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">Couldn&apos;t load interaction alerts.</p>}
                {alerts && alerts.needed > 0 && (
                  <p className="mt-1 text-[11px] text-muted">
                    Interaction alerts start once this team has {alerts.needed} more analyzed call{alerts.needed === 1 ? "" : "s"} to compare against.
                  </p>
                )}
                <ul className="mt-1 space-y-1">
                  {shown.map((c) => (
                    <li key={c.id}>
                      <Link href={`/dashboard/remote-sales/calls/${c.id}`} className="block rounded px-1 py-0.5 text-xs hover:bg-base">
                        <span className="flex justify-between gap-2">
                          <span className="text-primary">{c.label ?? "Untitled call"}</span>
                          <span className="text-muted">{new Date(c.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · Go to call</span>
                        </span>
                        {alertsOf(c.id).length > 0 && (
                          <span className="mt-0.5 flex flex-wrap gap-1">
                            {alertsOf(c.id).map((a) => (
                              <span key={a} className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] text-amber-700 dark:text-amber-300">
                                {ALERT_WORDS[a]}
                              </span>
                            ))}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
                {shown.length === 0 && <p className="mt-1 text-[11px] text-muted">None of these calls has an interaction alert.</p>}
              </div>
            );
          })()}
          <p className="mt-1 text-[11px] text-muted">
            Overdue: calls in the last 30 days and no feedback in that time. &ldquo;Not yet coached&rdquo; counts the rep&apos;s calls
            with no feedback on them. An interaction alert means the call was further out than 9 in 10 of this team&apos;s analyzed calls — unusual for
            this team, not necessarily wrong.
          </p>
        </div>
      )}
    </section>
  );
}
