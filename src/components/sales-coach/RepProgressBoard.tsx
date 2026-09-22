"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, AlertTriangle, CalendarClock, Film } from "lucide-react";
import type { PatternRow } from "@/lib/coach/patterns/readPatterns";
import type { PatternStatus } from "@/lib/coach/patterns/status";
import {
  repTiles,
  repAlerts,
  checkInAgenda,
  timeline,
  type TeamCards,
  type RepProgressRow,
  type AttentionLevel,
} from "@/lib/coach/patterns/repProgress";

/**
 * Pattern Interrupt, Rep progress tab — built from the board opened at full resolution
 * 2026-09-22 and described in `docs/tbc/2026-09-22-rep-progress/think.md`.
 *
 * THE TWO NUMBERS ON THIS BOARD AGREE, WHICH AN EVIDENCE NOTE HAD DENIED. The rep list reads
 * "1 fixed · 1 improving · 2 open" and the panel reads "Open patterns 3": a partition and a total
 * of the same set, with exactly three non-Fixed rows in the table below. Both come from
 * `countPatterns`, which returns `openNotImproving` and `open` as two named fields (§2.2).
 *
 * C8 is still real and is about the WORD, not the arithmetic — one page using "open" in two
 * senses. Hence the list's third number is labelled "open" under a legend that calls it
 * "Still open", and the panel's tile says "Open patterns".
 *
 * EVERY NUMBER ON THIS SCREEN IS A DERIVATION THE ROUTE OR `repProgress.ts` ALREADY MADE. This
 * file positions and colours; it does not decide. In particular it never writes
 * `status !== "fixed"` — that is the founder's C8 ruling and it has one author.
 *
 * NOTHING IS GENERATED. The check-in agenda is three sentences assembled from what is on the
 * record, each carrying the fact behind it, because §3.3 requires that a manager be able to
 * disagree with advice by disagreeing with a fact.
 */

type Wire = {
  cards: TeamCards;
  reps: RepProgressRow[];
};

/** The board's four pills, in its words and its colours. */
const ATTENTION: Record<AttentionLevel, { label: string; className: string }> = {
  needs_1_1: { label: "Needs 1:1", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
  follow_up: { label: "Follow up", className: "bg-ember-400/20 text-brand" },
  new_rep: { label: "New rep", className: "bg-elevated text-muted" },
  on_track: {
    label: "On track",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
};

const STATUS_PILL: Record<PatternStatus, { label: string; className: string }> = {
  new: { label: "New", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
  coaching: { label: "Coaching", className: "bg-ember-400/20 text-brand" },
  improving: {
    label: "Improving",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  stalled: { label: "Stalled", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
  fixed: { label: "Fixed", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
};

/** The timeline legend: Ⓒ Coached · Ⓓ Drill assigned · Ⓡ Rep reviewed. */
const MARKER: Record<string, { letter: string; label: string; className: string }> = {
  coached: { letter: "C", label: "Coached", className: "bg-ember-400 text-ink-950" },
  drill_assigned: { letter: "D", label: "Drill assigned", className: "bg-sky-500 text-white" },
  rep_reviewed: { letter: "R", label: "Rep reviewed", className: "bg-emerald-600 text-white" },
};

const BAR_TONE: Record<PatternStatus, string> = {
  new: "bg-red-400/70",
  coaching: "bg-ember-400/70",
  stalled: "bg-ember-500/80",
  improving: "bg-emerald-500/70",
  fixed: "bg-emerald-600/70",
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function RepProgressBoard({
  progress,
  patterns,
}: {
  progress: Wire;
  /** The SAME array the Patterns tab renders, so the two tabs cannot disagree about a rep. */
  patterns: PatternRow[];
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const reps = progress.reps;
  const active = reps.find((r) => r.repId === selected) ?? reps[0] ?? null;
  const index = active ? reps.findIndex((r) => r.repId === active.repId) : -1;

  if (reps.length === 0) {
    return (
      <div className="rounded-lg border border-default bg-surface px-5 py-8 text-center">
        <p className="text-sm font-medium text-primary">No patterns on the team yet</p>
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted">
          A pattern opens when the same miss shows up in 3 or more of a rep&apos;s last 10
          applicable pitches. Nobody has crossed that line — which is a finding, not an empty page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TeamCardRow cards={progress.cards} />

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <RepList reps={reps} activeId={active?.repId ?? null} onPick={setSelected} />
        {active && (
          <RepPanel
            key={active.repId}
            rep={active}
            own={patterns.filter((p) => p.repId === active.repId)}
            position={{ index, total: reps.length }}
            onStep={(delta) => {
              const next = reps[(index + delta + reps.length) % reps.length];
              if (next) setSelected(next.repId);
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   The five cards
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

function TeamCardRow({ cards }: { cards: TeamCards }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Card
        label="Open patterns"
        value={String(cards.openPatterns)}
        sub={`Across ${cards.acrossReps} rep${cards.acrossReps === 1 ? "" : "s"}`}
      />
      <Card
        label="Fixed this month"
        value={String(cards.fixedThisMonth)}
        tone="text-emerald-700 dark:text-emerald-400"
        // NULL IS NOT ZERO. A team that has fixed nothing has no average, and "Avg 0.0 days to
        // fix" on that tile reads as instant.
        sub={cards.avgDaysToFix === null ? "Nothing fixed yet" : `Avg ${cards.avgDaysToFix} days to fix`}
      />
      <Card
        label="Stalled"
        value={String(cards.stalled)}
        tone="text-red-600 dark:text-red-400"
        sub="Coached 7+ days, no change"
      />
      <Card
        label="Awaiting rep review"
        value={String(cards.awaitingRepReview)}
        tone="text-brand"
        sub="Coached, clips not opened"
      />
      <Card
        label="Points recovered"
        value={cards.pointsRecovered > 0 ? `+${cards.pointsRecovered.toFixed(1)}` : "0.0"}
        tone="text-emerald-700 dark:text-emerald-400"
        sub="Per pitch, team total"
      />
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-default bg-surface p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone ?? "text-primary"}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{sub}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   The rep list
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

function RepList({
  reps,
  activeId,
  onPick,
}: {
  reps: RepProgressRow[];
  activeId: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-default bg-surface p-3">
      <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-muted">
        Reps · needs attention first
      </p>
      <ul className="space-y-1">
        {reps.map((r) => {
          const total = r.fixed + r.improving + r.stillOpen;
          return (
            <li key={r.repId}>
              <button
                type="button"
                onClick={() => onPick(r.repId)}
                className={`w-full rounded-lg px-2.5 py-2 text-left transition ${
                  activeId === r.repId ? "bg-ember-400/10" : "hover:bg-elevated"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-primary">
                    {r.fullName ?? r.repId.slice(0, 8)}
                  </span>
                  {/* The pill's SENTENCE travels with it. A10: a judgement printed beside
                      someone's name must be one they could be shown, in the same words. */}
                  <span
                    title={r.attentionReason}
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${ATTENTION[r.attention].className}`}
                  >
                    {ATTENTION[r.attention].label}
                  </span>
                </div>

                <div className="mt-1.5 flex h-1.5 gap-px overflow-hidden rounded-full bg-elevated">
                  {total > 0 && (
                    <>
                      <span className="bg-emerald-600" style={{ width: `${(r.fixed / total) * 100}%` }} />
                      <span className="bg-emerald-400" style={{ width: `${(r.improving / total) * 100}%` }} />
                      <span className="bg-subtle" style={{ width: `${(r.stillOpen / total) * 100}%` }} />
                    </>
                  )}
                </div>

                {/* The board's third number EXCLUDES improving. Both come from one resolver. */}
                <p className="mt-1 text-[11px] text-muted">
                  {r.fixed} fixed · {r.improving} improving · {r.stillOpen} open
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      <ul className="mt-2 flex flex-wrap gap-3 border-t border-default px-1 pt-2 text-[10px] text-muted">
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden /> Fixed
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden /> Improving
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-subtle" aria-hidden /> Still open
        </li>
      </ul>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   The rep panel
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

function RepPanel({
  rep,
  own,
  position,
  onStep,
}: {
  rep: RepProgressRow;
  own: PatternRow[];
  position: { index: number; total: number };
  onStep: (delta: number) => void;
}) {
  const now = useMemo(() => new Date(), []);
  const tiles = useMemo(() => repTiles(own), [own]);
  const alerts = useMemo(() => repAlerts(own, now), [own, now]);
  const agenda = useMemo(() => checkInAgenda(own), [own]);

  // A calendar month back from today, which is the board's "Pattern timeline · September".
  const window = useMemo(() => {
    const to = new Date(now);
    const from = new Date(now.getTime() - 30 * 86_400_000);
    return { from, to };
  }, [now]);
  const bars = useMemo(() => timeline(own.filter((p) => p.verdict.open || isRecent(p, window.from)), window), [own, window]);

  const fixed = own.filter((p) => !p.verdict.open);

  return (
    <div className="space-y-4 rounded-lg border border-default bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-primary">
              {rep.fullName ?? rep.repId.slice(0, 8)}
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ATTENTION[rep.attention].className}`}
            >
              {ATTENTION[rep.attention].label}
            </span>
          </div>
          {/* The reason, in full, on the panel — not only as a tooltip on the list. */}
          <p className="mt-0.5 text-xs text-muted">{rep.attentionReason}</p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onStep(-1)}
            className="rounded-md border border-default p-1.5 text-muted hover:text-primary"
            aria-label="Previous rep"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          </button>
          <span className="px-1 text-xs tabular-nums text-muted">
            Rep {position.index + 1} of {position.total}
          </span>
          <button
            type="button"
            onClick={() => onStep(1)}
            className="rounded-md border border-default p-1.5 text-muted hover:text-primary"
            aria-label="Next rep"
          >
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card
          label="Open patterns"
          value={String(tiles.openPatterns)}
          sub={tiles.notCoachedYet > 0 ? `${tiles.notCoachedYet} not coached yet` : "All being worked"}
        />
        <Card label="Fixed" value={String(tiles.fixed)} sub="All time" />
        <Card
          label="Avg days to fix"
          value={tiles.avgDaysToFix === null ? "—" : tiles.avgDaysToFix.toFixed(1)}
          sub={tiles.avgDaysToFix === null ? "Nothing fixed yet" : "From first seen to fixed"}
        />
        <Card
          label="Points recovered"
          value={`+${tiles.pointsRecovered.toFixed(1)}`}
          tone="text-emerald-700 dark:text-emerald-400"
          sub="Per pitch, from fixed patterns"
        />
        <Card
          label="Rep reviewed"
          value={`${tiles.reviewed}/${tiles.reviewable}`}
          // The denominator is COACHED patterns. A rep cannot acknowledge coaching that has not
          // happened, and a tile that counted all of them would ask them to.
          sub="Coached patterns acknowledged"
        />
      </div>

      {alerts.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] p-3.5">
          <ul className="space-y-1.5">
            {alerts.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-secondary">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
                <span>
                  <b className="text-red-600 dark:text-red-400">
                    {a.kind === "stalled" ? "Stalled:" : "Waiting on you:"}
                  </b>{" "}
                  {a.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Timeline bars={bars} window={window} />

      <PatternTable own={own} />

      <div className="grid gap-3 lg:grid-cols-2">
        <Agenda items={agenda} />
        <FixedPatterns fixed={fixed} />
      </div>
    </div>
  );
}

/** A pattern fixed inside the window still belongs on the timeline. */
function isRecent(p: PatternRow, from: Date): boolean {
  // Same wire-boundary caution as `eventsOf` in repProgress.ts: a client bundle can outlive the
  // response shape it was compiled against, and a crash here would take the tab down.
  const at = p.fixedAt ?? (p.events ?? []).find((e) => e.kind === "fixed")?.at ?? null;
  return at !== null && Date.parse(at) >= from.getTime();
}

function Timeline({
  bars,
  window: win,
}: {
  bars: ReturnType<typeof timeline>;
  window: { from: Date; to: Date };
}) {
  if (bars.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold text-primary">
          Pattern timeline{" "}
          <span className="font-normal text-muted">
            · {day(win.from.toISOString())} – today
          </span>
        </h4>
        <ul className="flex gap-3 text-[10px] text-muted">
          {Object.entries(MARKER).map(([kind, m]) => (
            <li key={kind} className="flex items-center gap-1">
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold ${m.className}`}
                aria-hidden
              >
                {m.letter}
              </span>
              {m.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2 rounded-lg border border-default p-3">
        {bars.map((b) => (
          <div key={b.patternId} className="grid grid-cols-[minmax(0,180px)_1fr] items-center gap-3">
            <p className="truncate text-xs text-secondary" title={b.label}>
              {b.label}
            </p>
            <div className="relative h-3 rounded-full bg-elevated">
              <span
                className={`absolute inset-y-0 rounded-full ${BAR_TONE[b.status]} ${
                  // A bar that runs off the left is SQUARED there, so a pattern first seen last
                  // month does not read as one that started on the window's first day.
                  b.clippedStart ? "rounded-l-none" : ""
                }`}
                style={{ left: `${b.from * 100}%`, width: `${Math.max(1, (b.to - b.from) * 100)}%` }}
                title={b.clippedStart ? "Started before this window" : undefined}
              />
              {b.markers.map((m, i) => (
                <span
                  key={`${m.kind}-${i}`}
                  title={`${MARKER[m.kind]?.label ?? m.kind} · ${day(m.at)}`}
                  className={`absolute top-1/2 flex h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[8px] font-bold ring-1 ring-base ${
                    MARKER[m.kind]?.className ?? "bg-subtle"
                  }`}
                  style={{ left: `${m.x * 100}%` }}
                >
                  {MARKER[m.kind]?.letter ?? "?"}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PatternTable({ own }: { own: PatternRow[] }) {
  if (own.length === 0) return null;
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold text-primary">Where each pattern stands</h4>
      <div className="overflow-x-auto rounded-lg border border-default">
        <table className="w-full text-xs">
          <thead className="bg-elevated text-[10px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Pattern · last coaching</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-right font-semibold">Open</th>
              <th className="px-3 py-2 text-right font-semibold">Misses then → now</th>
              <th className="px-3 py-2 text-right font-semibold">Clean streak</th>
              <th className="px-3 py-2 text-right font-semibold">Rep reviewed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default">
            {own.map((p) => {
              const c = p.verdict.comparison;
              const reviewedAt = (p.events ?? [])
                .filter((e) => e.kind === "rep_reviewed")
                .sort((a, b) => b.at.localeCompare(a.at))[0];
              return (
                <tr key={p.id}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-primary">{p.label}</p>
                    {p.section && (
                      <p className="text-[10px] uppercase tracking-wide text-muted">{p.section}</p>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted">{lastCoaching(p)}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      title={p.verdict.reason}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_PILL[p.verdict.status].className}`}
                    >
                      {STATUS_PILL[p.verdict.status].label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-secondary">
                    {p.daysOpen} day{p.daysOpen === 1 ? "" : "s"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {/* "—" rather than 0/5 when there is not enough history. No data and a
                        perfect record look identical at zero.

                        FALSY, NOT `=== null`, for the wire-boundary reason above: a client
                        bundle can outlive the response it was compiled against, and
                        `comparison` is a field that did not exist yesterday. Strict-null here
                        turns a missing field into a crash instead of a dash. */}
                    {!c ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span className="text-secondary">
                        {c.thenMisses}/{c.thenOf} →{" "}
                        <b className="text-primary">
                          {c.nowMisses}/{c.nowOf}
                        </b>{" "}
                        <span
                          className={
                            c.direction === "down"
                              ? "text-emerald-700 dark:text-emerald-400"
                              : c.direction === "up"
                                ? "text-red-600 dark:text-red-400"
                                : "text-muted"
                          }
                        >
                          {c.direction === "down" ? "▼" : c.direction === "up" ? "▲" : "→"}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <span
                          key={i}
                          className={`h-1 w-3 rounded-full ${
                            i < p.verdict.streak ? "bg-emerald-600" : "bg-subtle"
                          }`}
                          aria-hidden
                        />
                      ))}
                    </div>
                    <p className="mt-0.5 text-right text-[10px] tabular-nums text-muted">
                      {p.verdict.streak} of 5
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {p.repReviewed ? (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        Yes{reviewedAt ? `, ${day(reviewedAt.at)}` : ""}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function lastCoaching(p: PatternRow): string {
  const latest = (p.events ?? [])
    .filter((e) => e.kind === "coached" || e.kind === "drill_assigned")
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!latest) return "Not coached yet";
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(latest.at)) / 86_400_000));
  const what = latest.kind === "drill_assigned" ? "Drill assigned" : "Coached";
  return `${what} · ${day(latest.at)} (${days}d ago)`;
}

function Agenda({ items }: { items: ReturnType<typeof checkInAgenda> }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-default bg-elevated p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
          Next check-in agenda
        </p>
        <p className="mt-1.5 text-xs text-muted">
          Nothing open for this rep, so there is nothing this board would put on an agenda.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ember-400/30 bg-ember-400/[0.06] p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-brand">
        Next check-in agenda
      </p>
      <ol className="mt-2 space-y-2">
        {items.map((it, i) => (
          <li key={it.patternId} className="flex gap-2 text-xs leading-relaxed text-secondary">
            <span className="font-semibold text-brand tabular-nums">{i + 1}.</span>
            <span>
              {it.text}
              {/* THE FACT BEHIND THE ADVICE, on the screen rather than in a tooltip. §3.3: a
                  manager has to be able to disagree with an item by disagreeing with a fact. */}
              <span className="mt-0.5 block text-[10px] text-muted">{it.because}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled
          title="Scheduling is not wired yet — this board does not create calendar events."
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink-950 px-3 py-1.5 text-xs font-medium text-white opacity-50 dark:bg-white dark:text-ink-950"
        >
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          Schedule check-in
        </button>
        <Link
          href="/dashboard/sales-coach/coach-assessment"
          className="inline-flex items-center gap-1.5 rounded-lg border border-default px-3 py-1.5 text-xs text-secondary hover:text-primary"
        >
          <Film className="h-3.5 w-3.5" aria-hidden />
          Open clips
        </Link>
      </div>
      {/* Said on the screen rather than discovered by pressing it. */}
      <p className="mt-2 text-[10px] text-muted">
        Schedule check-in is not wired to a calendar yet. Open clips goes to the rep&apos;s
        recordings, where every pattern moment is a marker you can jump to.
      </p>
    </div>
  );
}

function FixedPatterns({ fixed }: { fixed: PatternRow[] }) {
  return (
    <div className="rounded-lg border border-default bg-surface p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Fixed patterns</p>
      {fixed.length === 0 ? (
        <p className="mt-1.5 text-xs text-muted">Nothing fixed yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {fixed.map((p) => {
            const at = p.fixedAt ?? (p.events ?? []).find((e) => e.kind === "fixed")?.at ?? null;
            const took =
              at === null
                ? null
                : Math.max(0, Math.floor((Date.parse(at) - Date.parse(p.firstSeen)) / 86_400_000));
            return (
              <li key={p.id} className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-primary">{p.label}</span>
                  <span className="block text-[10px] text-muted">
                    {at ? `Fixed ${day(at)}` : "Fixed"}
                    {took !== null && ` · took ${took} day${took === 1 ? "" : "s"}`}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  +{p.costPerPitch.toFixed(1)} pts/pitch
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
