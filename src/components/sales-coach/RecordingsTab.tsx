"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Play, Pause, RotateCcw, RotateCw, Send, SlidersHorizontal, Share2, Info } from "lucide-react";
import type { PitchRecordingRow, PitchRecordingDetail } from "@/lib/coach/recordings/readRecordings";
import type { MomentKind } from "@/lib/coach/recordings/keyMoments";
import type { ShareState } from "@/lib/coach/recordings/shareState";
import { linesAround } from "@/lib/coach/recordings/keyMoments";
import { loadPeaks } from "@/lib/coach/recordings/peaks";

/**
 * The Recordings tab — Project 4 of the 2026-09-19 coaching build.
 *
 * Built from the board opened and read 2026-09-22, recorded in
 * `docs/SYSTEM UPDATES AND REVISION 09-22-2026/EVIDENCE.md`:
 * `Coach Assessment  Recordings tab open (web).pdf` — a list on the left, a player with a marker
 * strip and a legend (Missed / Pattern / Bonus / Comment), KEY MOMENTS, TRANSCRIPT AT 7:22, and
 * three buttons: Save and send to rep, Adjust score, Save as team example.
 *
 * WHY THIS SCREEN IS THE ONE THE OTHER FOUR DEPEND ON. Every number on every board in this
 * product traces back to an LLM's reading of a recording. Until a manager can press play at the
 * second a score moved and hear it, the whole system asks to be trusted rather than checked.
 * Section 3.3 is explicit that making the human a participant is what makes an
 * accurate-but-unwelcome finding survivable, and A11 that the system mirrors rather than judges.
 * The audio IS the mirror.
 *
 * NOTHING HERE DERIVES A MOMENT, A POINT VALUE OR A PERMISSION. `keyMoments()` builds the marker
 * set once and the strip and the list render the same array, or the strip would show eight marks
 * above a list of seven. `shareState()` replays the consent log and returns `shareable`; this
 * component branches on that field and never asks itself whether a revocation counted (2.2).
 */

type Wire = PitchRecordingDetail & { share: ShareState; viewerId: string };

const SPEEDS = [1, 1.25, 1.5, 2] as const;

/** The board's legend, in its colours and its words. */
const MARKER: Record<MomentKind, { dot: string; label: string }> = {
  missed: { dot: "bg-red-500", label: "Missed" },
  violation: { dot: "bg-red-500", label: "Missed" },
  pattern: { dot: "bg-amber-700", label: "Pattern" },
  bonus: { dot: "bg-emerald-500", label: "Bonus" },
  /**
   * A bonus the scorer HEARD and declined — confidence under the floor — or one a manager removed
   * (0256 demotes rather than deletes). Grey, because the one thing it must not read as is a
   * bonus: it moved the score by nothing. "Considered" is the honest word — the judgement
   * happened and this is its record, which is the entire reason these rows are stored.
   *
   * Its absence from this map is what blanked the whole tab: `MARKER[m.kind].dot` on a kind with
   * no entry is `undefined.dot`.
   */
  rejected_bonus: { dot: "bg-ink-500", label: "Considered" },
  comment: { dot: "bg-sky-500", label: "Comment" },
};

/**
 * Every marker lookup driven by WIRE DATA goes through here, never `MARKER[kind]` directly.
 *
 * The map is `Record<MomentKind, …>`, so TypeScript treats an index by `MomentKind` as always
 * present — which is true of the TYPE and was not true of the DATA. A value the database allowed
 * and this union did not reached `.dot` on `undefined` and took the entire tab down with it.
 *
 * Narrowing at the read boundary (`asEventType`) is the real fix; this is the second wall. A
 * manager losing one dot is recoverable. A manager losing the screen is what happened.
 */
function markerFor(kind: MomentKind): { dot: string; label: string } {
  return MARKER[kind] ?? { dot: "bg-ink-500", label: "Moment" };
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const OUTCOME: Record<string, string> = { sold: "Sold", follow_up: "Follow-up", no_sale: "No sale" };

export default function RecordingsTab({
  repId,
  isManager,
  onCount,
}: {
  repId: string;
  isManager: boolean;
  /** Reports the rep's total scored-pitch count once, so the tab label can show it. */
  onCount?: (total: number) => void;
}) {
  const [list, setList] = useState<{
    rows: PitchRecordingRow[];
    capped: boolean;
    /**
     * How many scored pitches this rep has, not how many are in `rows`.
     *
     * Optional because a browser holding a bundle from before this field will not receive it, and
     * absent must mean "no count" rather than zero — the fifth new wire field today, and the first
     * four taught this the hard way.
     */
    total?: number;
  } | null>(null);
  const [listFailed, setListFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setList(null);
    setListFailed(false);
    fetch(`/api/coach/sales-session/pitch-recordings?repId=${encodeURIComponent(repId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { rows: PitchRecordingRow[]; capped: boolean; total?: number }) => {
        if (!live) return;
        setList({ rows: d.rows, capped: d.capped, total: d.total });
        // The board's tab label needs this number while the OTHER tab is showing, so it is handed
        // upward rather than kept here.
        //
        // NO GUARD FLAG, deliberately. The first version kept one in state and read it inside the
        // effect, which lint caught as a stale closure — and it was right: the flag would have been
        // read at its value from the previous render. The effect already runs once per `repId` and
        // this fetch resolves once per run, with `live` covering a late resolve, so a second
        // notification for the same rep is not reachable. A flag guarding an unreachable case is a
        // flag that will be wrong about a reachable one later.
        if (typeof d.total === "number") onCount?.(d.total);
        // Open the newest automatically. A manager who clicked Recordings came to listen to
        // something; a list beside an empty panel makes them click twice to start (1.5.1 layer 3).
        setOpenId(d.rows[0]?.pitchId ?? null);
      })
      .catch(() => live && setListFailed(true));
    return () => {
      live = false;
    };
  }, [repId, onCount]);

  if (listFailed) {
    return (
      <Shell>
        <p className="text-sm text-muted">
          The recordings could not be loaded. This is a failed read, not an empty history — reload
          before concluding anything about this rep.
        </p>
      </Shell>
    );
  }

  if (!list) {
    return (
      <Shell>
        <p className="text-sm text-muted">Loading recordings…</p>
      </Shell>
    );
  }

  if (list.rows.length === 0) {
    return (
      <Shell>
        <p className="text-sm text-muted">
          No scored recordings yet. A pitch appears here once it has been scored — the list is
          built from Pitch Scores, so a recording that has not been through scoring will not show.
        </p>
      </Shell>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div>
        {/*
          The design's list header: "RECENT RECORDINGS" on the left, "7 all time" on the right.
          The count is NOT rows.length — this read is bounded at LIST_LIMIT and the surface says so
          below, so for any rep with more the two numbers differ and "100 all time" would be a page
          presented as the whole set.
        */}
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Recent recordings
          </h4>
          {typeof list.total === "number" && (
            <span className="text-[11px] text-muted">{list.total} all time</span>
          )}
        </div>
      <ol className="space-y-2">
        {list.rows.map((r) => (
          <li key={r.pitchId}>
            <button
              type="button"
              onClick={() => setOpenId(r.pitchId)}
              className={`w-full rounded-xl border p-3 text-left transition ${
                openId === r.pitchId
                  ? "border-ember-400 bg-ember-400/10"
                  : "border-subtle bg-surface hover:border-ember-400/50"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-strong">{when(r.recordedAt)}</span>
                <span className="text-lg font-semibold tabular-nums text-strong">
                  {r.total.toFixed(1)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                {r.durationS !== null && <span className="tabular-nums">{clock(r.durationS)}</span>}
                {r.outcome && <span>{OUTCOME[r.outcome] ?? r.outcome}</span>}
                {/* The board labels an excluded pitch rather than hiding it: a rep who sees a
                    score and a manager who does not would be looking at different histories. */}
                {!r.qualifying && (
                  <span className="rounded bg-red-500/15 px-1.5 py-0.5 font-medium text-red-600 dark:text-red-400">
                    Not counted
                  </span>
                )}
                {r.patternMoments > 0 && (
                  <span className="text-amber-700 dark:text-amber-500">
                    {r.patternMoments} pattern moment{r.patternMoments === 1 ? "" : "s"}
                  </span>
                )}
                {!r.hasAudio && <span className="italic">No audio</span>}
              </div>
            </button>
          </li>
        ))}
        {list.capped && (
          <li className="px-1 text-xs text-muted">
            {/*
              SAYS WHAT IT IS SHOWING OF, now that the total exists. The old line named the bound
              (100) and not the set, which is the same sentence three of today's fixes replaced —
              and it named the number itself, a second copy of LIST_LIMIT that would drift the
              first time that moved (§2.2). Both come from the data now.
            */}
            Showing the {list.rows.length} most recent
            {typeof list.total === "number" ? ` of ${list.total}` : ""}. Older recordings are on
            the record and not on this list.
          </li>
        )}
      </ol>
      </div>

      {openId ? <Player key={openId} pitchId={openId} isManager={isManager} /> : null}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-subtle bg-surface p-6">
      <div className="mb-2 flex items-center gap-2 text-strong">
        <Mic className="h-4 w-4" aria-hidden />
        <h3 className="text-sm font-semibold">Recordings</h3>
      </div>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
   The player
   ═══════════════════════════════════════════════════════════════════════════════════════════ */

function Player({ pitchId, isManager }: { pitchId: string; isManager: boolean }) {
  const [wire, setWire] = useState<Wire | null>(null);
  const [failed, setFailed] = useState(false);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [peaksNote, setPeaksNote] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/coach/sales-session/pitch-recordings?pitchId=${encodeURIComponent(pitchId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Wire) => live && setWire(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [pitchId]);

  // Real peaks or none. See peaks.ts — a drawn-from-nothing waveform under clickable markers is
  // a picture of audio that is not this audio, on the one screen built for checking the machine.
  const audioUrl = wire?.audioUrl ?? null;
  useEffect(() => {
    if (!audioUrl) return;
    const ac = new AbortController();
    let live = true;
    setPeaks(null);
    setPeaksNote(null);
    void loadPeaks(audioUrl, ac.signal).then((res) => {
      if (!live) return;
      if (res.status === "ok") setPeaks(res.peaks);
      else setPeaksNote(res.reason);
    });
    return () => {
      live = false;
      ac.abort();
    };
  }, [audioUrl]);

  const seek = useCallback((to: number) => {
    const el = audio.current;
    const next = Math.max(0, to);
    setAt(next);
    if (el) el.currentTime = next;
  }, []);

  useEffect(() => {
    const el = audio.current;
    if (el) el.playbackRate = speed;
  }, [speed, wire]);

  if (failed) {
    return (
      <div className="rounded-xl border border-subtle bg-surface p-6 text-sm text-muted">
        This recording could not be loaded.
      </div>
    );
  }
  if (!wire) {
    return (
      <div className="rounded-xl border border-subtle bg-surface p-6 text-sm text-muted">Loading…</div>
    );
  }

  const duration = wire.durationS ?? 0;
  const pct = duration > 0 ? Math.min(100, (at / duration) * 100) : 0;
  const win = linesAround(wire.lines, at, 2);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-subtle bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-strong">{when(wire.recordedAt)}</h3>
          {/*
            THE DESIGN'S ARITHMETIC, not a list of the parts: "58.5 base +5.0 −2.0 = 61.5", with
            the total large and in the accent colour. The numbers were already all here; what was
            missing is that they add up in front of the reader. A manager arguing with a score
            needs to see the sum working, not four values and a comma.
          */}
          <p className="flex items-baseline gap-1.5 text-xs text-muted">
            <span className="tabular-nums">{wire.base.toFixed(1)} base</span>
            <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
              +{wire.bonus.toFixed(1)}
            </span>
            <span className="tabular-nums text-red-600 dark:text-red-400">
              −{wire.violations.toFixed(1)}
            </span>
            <span aria-hidden>=</span>
            <span className="text-lg font-semibold tabular-nums text-ember-400">
              {wire.total.toFixed(1)}
            </span>
            <span>{wire.band ? `· ${wire.band}` : "· Not counted"}</span>
          </p>
        </div>

        {wire.audioUrl ? (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- the transcript panel below
                IS the caption, placed and highlighted at the playhead. */}
            <audio
              ref={audio}
              src={wire.audioUrl}
              preload="metadata"
              onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              className="hidden"
            />

            <MarkerStrip
              moments={wire.moments}
              duration={duration}
              peaks={peaks}
              pct={pct}
              at={at}
              onSeek={seek}
            />
            {peaksNote && <p className="mt-1 text-[11px] text-muted">{peaksNote}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => seek(at - 10)}
                className="rounded-lg border border-subtle p-2 text-muted hover:text-strong"
                aria-label="Back 10 seconds"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = audio.current;
                  if (!el) return;
                  if (el.paused) void el.play();
                  else el.pause();
                }}
                className="rounded-lg bg-ember-400 p-2 text-ink-950"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
              </button>
              <button
                type="button"
                onClick={() => seek(at + 10)}
                className="rounded-lg border border-subtle p-2 text-muted hover:text-strong"
                aria-label="Forward 10 seconds"
              >
                <RotateCw className="h-4 w-4" aria-hidden />
              </button>

              <span className="ml-1 text-xs tabular-nums text-muted">
                {clock(at)}
                {duration > 0 && ` / ${clock(duration)}`}
              </span>

              <div className="ml-auto flex gap-1">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeed(s)}
                    className={`rounded px-2 py-1 text-xs tabular-nums ${
                      speed === s ? "bg-ember-400 text-ink-950" : "text-muted hover:text-strong"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">
            This pitch was scored without audio, so there is nothing to play. The key moments below
            are still the scorer&apos;s findings.
          </p>
        )}

        <Legend />
      </div>

      <KeyMoments wire={wire} onSeek={seek} />
      <Transcript win={win} approximate={wire.linesApproximate} at={at} />
      {isManager && <Actions wire={wire} at={at} />}
    </div>
  );
}

function Legend() {
  // "violation" is deliberately absent: it shares the red dot AND the "Missed" label with
  // `missed`, so listing it would print the same chip twice. `rejected_bonus` is NOT a duplicate
  // — it is its own colour and its own word, and a manager seeing a grey dot needs the key.
  const shown: MomentKind[] = ["missed", "pattern", "bonus", "rejected_bonus", "comment"];
  return (
    <ul className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted">
      {shown.map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${MARKER[k].dot}`} aria-hidden />
          {MARKER[k].label}
        </li>
      ))}
    </ul>
  );
}

function MarkerStrip({
  moments,
  duration,
  peaks,
  pct,
  at,
  onSeek,
}: {
  moments: PitchRecordingDetail["moments"];
  duration: number;
  peaks: number[] | null;
  pct: number;
  at: number;
  onSeek: (s: number) => void;
}) {
  const placeable = useMemo(
    () => (duration > 0 ? moments.filter((m) => m.atSeconds !== null) : []),
    [moments, duration]
  );

  return (
    <div className="relative">
      <div className="relative h-16 overflow-hidden rounded-lg bg-elevated">
        {peaks ? (
          <div className="absolute inset-0 flex items-center gap-px px-px">
            {peaks.map((p, i) => (
              <span
                key={i}
                className="flex-1 rounded-sm bg-ember-400/40"
                style={{ height: `${Math.max(2, p * 100)}%` }}
              />
            ))}
          </div>
        ) : (
          <div className="absolute inset-x-0 top-1/2 h-px bg-subtle" />
        )}

        {/* The playhead. */}
        <div className="absolute inset-y-0 w-px bg-strong" style={{ left: `${pct}%` }} aria-hidden />

        {placeable.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSeek(m.atSeconds ?? 0)}
            title={`${clock(m.atSeconds ?? 0)} · ${m.label}`}
            aria-label={`Jump to ${clock(m.atSeconds ?? 0)}, ${m.label}`}
            className="absolute top-0 h-3 w-3 -translate-x-1/2 rounded-full ring-2 ring-base"
            style={{ left: `${((m.atSeconds ?? 0) / duration) * 100}%` }}
          >
            <span className={`block h-full w-full rounded-full ${markerFor(m.kind).dot}`} />
          </button>
        ))}
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(1, Math.floor(duration))}
        value={Math.min(at, Math.max(1, Math.floor(duration)))}
        onChange={(e) => onSeek(Number(e.currentTarget.value))}
        aria-label="Seek"
        className="mt-1 w-full accent-ember-400"
      />
    </div>
  );
}

function KeyMoments({ wire, onSeek }: { wire: Wire; onSeek: (s: number) => void }) {
  return (
    <div className="rounded-xl border border-subtle bg-surface p-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {/*
          "· click to jump" is the affordance half of the design's label, and it is the half that
          tells a manager these rows DO something. The rows have been clickable since they were
          built; nothing said so.
        */}
        Key moments <span className="font-normal">· click to jump</span>
      </h4>
      {wire.moments.length === 0 ? (
        <p className="text-sm text-muted">Nothing was flagged in this pitch.</p>
      ) : (
        <ul className="space-y-1">
          {wire.moments.map((m) => {
            const placed = m.atSeconds !== null;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={!placed}
                  onClick={() => onSeek(m.atSeconds ?? 0)}
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left enabled:hover:bg-elevated disabled:cursor-default"
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${markerFor(m.kind).dot}`} aria-hidden />
                  <span className="w-12 shrink-0 text-xs tabular-nums text-muted">
                    {placed ? clock(m.atSeconds ?? 0) : "—"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-strong">{m.label}</span>
                    {m.detail && <span className="block truncate text-xs text-muted">{m.detail}</span>}
                  </span>
                  {m.points !== null && (
                    <span
                      /*
                       * THREE cases, not two. A rejected bonus is stored with `points: 0`, and
                       * the old binary painted everything not-negative green — so "considered and
                       * declined" rendered as a green 0, the one reading it must never have.
                       */
                      className={`shrink-0 text-sm font-semibold tabular-nums ${
                        m.points < 0
                          ? "text-red-600 dark:text-red-400"
                          : m.points > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted"
                      }`}
                    >
                      {m.points > 0 ? "+" : ""}
                      {m.points}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* BOTH counts, never just the placeable one. Eight flagged moments of which three can be
          jumped to is not three flagged moments, and a strip showing three agrees with itself and
          disagrees with the pitch. */}
      {wire.coverage.unplaced > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
          <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          {wire.coverage.unplaced} of {wire.coverage.total} moments have no timestamp — they were
          scored from a transcript without timing, so they are listed but cannot be jumped to.
        </p>
      )}
    </div>
  );
}

function Transcript({
  win,
  approximate,
  at,
}: {
  win: ReturnType<typeof linesAround>;
  approximate: boolean;
  at: number;
}) {
  return (
    <div className="rounded-xl border border-subtle bg-surface p-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Transcript at {clock(at)}
        {approximate && <span className="ml-2 normal-case tracking-normal">(approximate)</span>}
      </h4>
      {!win ? (
        <p className="text-sm text-muted">No transcript was stored for this recording.</p>
      ) : (
        <ol className="space-y-1">
          {win.lines.map((l, i) => (
            <li
              key={`${i}-${l.text.slice(0, 12)}`}
              className={`rounded px-2 py-1 text-sm ${
                i === win.focusIndex ? "bg-ember-400/15 text-strong" : "text-muted"
              }`}
            >
              {l.speaker !== "unknown" && (
                <span className="mr-2 text-xs uppercase tracking-wide text-muted">
                  {l.speaker === "agent" ? "Rep" : "Customer"}
                </span>
              )}
              {l.text}
            </li>
          ))}
        </ol>
      )}
      {approximate && win && (
        <p className="mt-2 text-xs text-muted">
          This transcript has no per-line timing, so the highlighted line is the nearest by
          position, not by the clock.
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
   The three buttons
   ═══════════════════════════════════════════════════════════════════════════════════════════ */

function Actions({ wire, at }: { wire: Wire; at: number }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [share, setShare] = useState<ShareState>(wire.share);

  const comment = async (sendToRep: boolean) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setSaid(null);
    try {
      const res = await fetch("/api/coach/sales-session/pitch-recordings/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pitchId: wire.pitchId,
          timestampS: Math.round(at),
          body: text.trim(),
          sendToRep,
        }),
      });
      const d = (await res.json()) as { error?: string; notified?: boolean };
      if (!res.ok) setSaid(d.error ?? "Could not save the comment.");
      else {
        setText("");
        setSaid(
          sendToRep
            ? d.notified
              ? `Sent to the rep at ${clock(at)}.`
              : `Saved at ${clock(at)} and visible to the rep, but the notification did not go out.`
            : `Saved at ${clock(at)}. Not sent — the rep cannot see it yet.`
        );
      }
    } catch {
      setSaid("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const askToShare = async () => {
    if (busy) return;
    setBusy(true);
    setSaid(null);
    try {
      const res = await fetch("/api/coach/sales-session/pitch-recordings/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pitchId: wire.pitchId, kind: "requested" }),
      });
      const d = (await res.json()) as { error?: string };
      if (!res.ok) setSaid(d.error ?? "Could not send the request.");
      else {
        setShare({ ...share, status: "pending", requestedAt: new Date().toISOString() });
        setSaid("Asked the rep. Nobody else can hear it until they say yes.");
      }
    } catch {
      setSaid("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-subtle bg-surface p-4">
      <label
        htmlFor="rec-comment"
        className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
      >
        Comment at {clock(at)}
      </label>
      <textarea
        id="rec-comment"
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        rows={2}
        maxLength={2000}
        placeholder="What should the rep hear here?"
        className="w-full rounded-lg border border-subtle bg-base p-2 text-sm text-strong"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => void comment(true)}
          className="flex items-center gap-1.5 rounded-lg bg-ember-400 px-3 py-1.5 text-xs font-medium text-ink-950 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          Save and send to rep
        </button>
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => void comment(false)}
          className="rounded-lg border border-subtle px-3 py-1.5 text-xs text-muted hover:text-strong disabled:opacity-50"
        >
          Save privately
        </button>

        {/* Adjust score is the DISPUTE QUEUE's write path, not a second one. The override log is
            append-only and `apply_pitch_score_override` recomputes the total; a button here that
            wrote its own would bypass both (2.2). */}
        <a
          href={`/dashboard/sales-coach/coach-assessment#dispute-${wire.pitchId}`}
          className="flex items-center gap-1.5 rounded-lg border border-subtle px-3 py-1.5 text-xs text-muted hover:text-strong"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          Adjust score
        </a>

        <ShareButton share={share} busy={busy} onAsk={() => void askToShare()} />
      </div>

      {said && <p className="mt-2 text-xs text-muted">{said}</p>}
    </div>
  );
}

/**
 * "Save as team example" — a REQUEST, never a switch.
 *
 * The guide: *needs the rep's permission before other reps can hear it.* A10 says a user sees
 * what the system sees about them; this is stronger, because it is other people hearing a
 * recording of them. The button asks, and `shareState().shareable` — replayed from the
 * append-only log, not recomputed here — decides whether it may actually be played.
 */
function ShareButton({ share, busy, onAsk }: { share: ShareState; busy: boolean; onAsk: () => void }) {
  if (share.shareable) {
    return (
      <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <Share2 className="h-3.5 w-3.5" aria-hidden />
        Cleared as a team example
      </span>
    );
  }
  if (share.status === "pending") {
    return (
      <span className="rounded-lg border border-subtle px-3 py-1.5 text-xs text-muted">
        Waiting on the rep&apos;s permission
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onAsk}
      className="flex items-center gap-1.5 rounded-lg border border-subtle px-3 py-1.5 text-xs text-muted hover:text-strong disabled:opacity-50"
    >
      <Share2 className="h-3.5 w-3.5" aria-hidden />
      {share.status === "declined" || share.status === "revoked"
        ? "Ask again to use as a team example"
        : "Save as team example"}
    </button>
  );
}
