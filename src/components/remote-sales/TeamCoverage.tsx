"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Radar } from "lucide-react";
import type { Coverage } from "@/lib/coach/remote/coverageShare";
import { MIN_CALLS } from "@/lib/coach/remote/coverageShare";

/**
 * Remote Sales → Coaching → What the team's calls cover (2026-11-25; Gong ledger F10.11). For managers: over 7, 30 or 90
 * days of phone/video calls they may open, the share of calls each tracker fired on and each topic the AI read named.
 * Each row opens those calls on Search (same period). Below MIN_CALLS calls no share is shown — a percentage of three
 * calls says nothing. Renders nothing for a rep (the route is manager-only).
 */
type Resp = Coverage & { days: number; since: string };
const pct = (x: number) => `${Math.round(x * 100)}%`;

function Bar({ label, href, calls, total, share, muted }: { label: string; href: string; calls: number; total: number; share: number; muted?: boolean }) {
  return (
    <li className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-2 text-xs">
      <Link href={href} className={`truncate hover:underline ${muted ? "text-muted" : "text-primary"}`} title={label}>
        {label}
      </Link>
      <span className="h-2 overflow-hidden rounded-full bg-base" aria-hidden>
        <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(share * 100, calls ? 2 : 0)}%` }} />
      </span>
      <span className="tabular-nums text-secondary">
        {pct(share)} <span className="text-muted">· {calls} of {total}</span>
      </span>
    </li>
  );
}

export function TeamCoverage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<Resp | null>(null);
  const [state, setState] = useState<"loading" | "hidden" | "failed" | "ok">("loading");

  useEffect(() => {
    let live = true;
    setState("loading");
    fetch(`/api/coach/remote/coverage?days=${days}`, { cache: "no-store" })
      .then(async (r) => {
        if (!live) return;
        if (r.status === 403) return setState("hidden");
        if (!r.ok) return setState("failed");
        setData((await r.json()) as Resp);
        setState("ok");
      })
      .catch(() => live && setState("failed"));
    return () => {
      live = false;
    };
  }, [days]);

  if (state === "hidden") return null;
  const from = data ? data.since.slice(0, 10) : "";
  return (
    <section aria-label="What the team's calls cover" className="rounded-xl border border-default bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <Radar className="h-4 w-4 text-brand" aria-hidden /> What the team&apos;s calls cover
        </h2>
        <div role="group" aria-label="Period" className="inline-flex overflow-hidden rounded-lg border border-default">
          {([7, 30, 90] as const).map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={`px-2.5 py-1 text-xs ${days === d ? "bg-brand/15 font-semibold text-primary" : "text-secondary hover:text-primary"}`}>
              {d} days
            </button>
          ))}
        </div>
      </div>
      {state === "loading" ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…
        </p>
      ) : state === "failed" || !data ? (
        <p className="mt-3 text-xs text-muted">Couldn&apos;t load what the team&apos;s calls cover. Refresh to try again.</p>
      ) : !data.enough ? (
        <p className="mt-3 text-xs text-secondary">
          {data.calls === 0 ? "No finished phone or video calls" : `Only ${data.calls} finished phone or video ${data.calls === 1 ? "call" : "calls"}`} in the last {data.days} days.
          Shares appear from {MIN_CALLS} calls — a percentage of fewer says little.
        </p>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold text-primary">Trackers</h3>
            <p className="text-[11px] text-muted">Share of calls each tracker fired on.</p>
            {data.trackers.length === 0 ? (
              <p className="mt-2 text-xs text-secondary">
                No trackers yet. <Link href="/dashboard/remote-sales/trackers" className="text-primary underline-offset-2 hover:underline">Set one up</Link> to see how often the team says it.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {data.trackers.map((t) => (
                  <Bar key={t.id} label={t.active ? t.name : `${t.name} (retired)`} muted={!t.active} href={`/dashboard/remote-sales/search?tracker=${encodeURIComponent(t.id)}&from=${from}`} calls={t.calls} total={data.calls} share={t.share} />
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold text-primary">Topics</h3>
            <p className="text-[11px] text-muted">Share of calls whose AI read named each topic (top 10).</p>
            {data.topics.length === 0 ? (
              <p className="mt-2 text-xs text-secondary">No topics read from these calls yet.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {data.topics.map((t) => (
                  <Bar key={t.topic} label={t.topic} href={`/dashboard/remote-sales/search?topic=${encodeURIComponent(t.topic)}&from=${from}`} calls={t.calls} total={data.calls} share={t.share} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {state === "ok" && data?.enough && (
        <p className="mt-3 text-[11px] text-muted">
          Out of {data.calls} finished calls you can open. Search finds a topic by its words, so a topic&apos;s link can show a few
          more calls (“price” also finds “pricing”).
        </p>
      )}
    </section>
  );
}
