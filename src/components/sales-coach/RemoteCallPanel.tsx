"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookmarkPlus, EyeOff, Pause, Play, RotateCcw, RotateCw, Scissors, Undo2 } from "lucide-react";
import { skipTo } from "@/lib/coach/remote/trim";
import { useIsSalesCoachManager } from "@/lib/hooks/useCurrentUserRole";

/**
 * The phone/video call panel on the session page (RSS Phase 2; docs/rss/docs/06-UI-SPEC.md §2-4; Gong F9.2,
 * F9.3, F10.1-F10.6):
 *   · player — play/pause, ±10 s, 1-2× speed;
 *   · talk-time lanes under it, labelled You / Customer (Unclear only when present); tapping a row's label
 *     isolates that speaker (the others are skipped), tapping a bar seeks;
 *   · the stat strip — each number beside the rep's own 30-day average, NEVER a Gong benchmark (docs/04), "—"
 *     with the reason when a stat cannot be measured.
 * Speaker and state are never shown by colour alone: every lane has its word, and isolation reads "only".
 *
 * Listening (RSS Phase 4, Gong F16.10): each stretch actually played is sent to POST /api/coach/remote/:id/listen
 * on pause, seek, end and leaving the page. What counts as "listened" is D8 and is decided at read time.
 *
 * Clip & save (RSS Phase 5, Gong F9.13/F12.5): mark a start and an end on the player, title it, save it to your
 * own library ("Mine") or — managers — the company library. A company item reaches peers only after the rep approves
 * it through the existing team-example consent (the panel files that request when the save says it is needed).
 * `?t=<seconds>` on the page URL positions the player there (search hits and library items link this way).
 *
 * Renders, never derives: numbers and lanes come from GET /api/coach/remote/:id/stats (the pipeline's own read).
 * `registerSeek` hands the page a function to play from a second, so the transcript and tracker chips can drive
 * this player without owning it.
 */
type Lanes = { rep: [number, number][]; customer: [number, number][]; unknown: [number, number][] };
type Stats = {
  talkRatioTime: number | null;
  longestRepMonologueMs: number;
  longestCustomerStoryMs: number;
  interactivity: number | null;
  patienceMs: number | null;
  repQuestionsPerHour: number | null;
};
type Wire =
  | { remote: false }
  | { remote: true; measurable: false; untimed: number }
  | {
      remote: true;
      measurable: true;
      estimated: boolean;
      untimed: number;
      stats: Stats;
      lanes: Lanes;
      averages: (Partial<Stats> & { sessions: number }) | null;
      audioUrl: string | null;
    };

const SPEEDS = [1, 1.25, 1.5, 2] as const;
const LANE_LABEL = { rep: "You", customer: "Customer", unknown: "Unclear" } as const;
const LANE_FILL = { rep: "bg-ember-400", customer: "bg-emerald-500", unknown: "bg-sky-500" } as const;
// The playback-speed chip's two states. The selected chip is a brand-red fill with dark ink; an unselected chip has
// no fill and takes text-primary only on hover — the two never sit on one element (theme-audit's red + text-primary
// rule), so they are kept as separate classes rather than one template the audit reads as a single element.
const SPEED_ON = "bg-ember-400 text-ink-950";
const SPEED_OFF = "text-muted hover:text-primary";

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function RemoteCallPanel({
  sessionId,
  registerSeek,
}: {
  sessionId: string;
  registerSeek?: (seek: ((seconds: number) => void) | null) => void;
}) {
  const [wire, setWire] = useState<Wire | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [only, setOnly] = useState<keyof Lanes | null>(null);
  // Listen tracking: where the current played stretch began, and the last position seen while playing.
  const isManager = useIsSalesCoachManager();
  const [clipStart, setClipStart] = useState<number | null>(null);
  const [clipEnd, setClipEnd] = useState<number | null>(null);
  const [clipTitle, setClipTitle] = useState("");
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Trims (RSS Phase 8, 0284): sections cut from this call. Playback skips them; managers can trim and restore.
  const [trims, setTrims] = useState<Array<{ id: string; startMs: number; endMs: number }>>([]);
  const [trimNote, setTrimNote] = useState<string | null>(null);
  const [trimBusy, setTrimBusy] = useState(false);
  const [confirmTrim, setConfirmTrim] = useState(false);
  const playedFrom = useRef<number | null>(null);
  const trimRangesRef = useRef<Array<{ start_ms: number; end_ms: number }>>([]);
  const lastAt = useRef(0);

  const flushListen = useCallback(
    (endSeconds: number) => {
      const start = playedFrom.current;
      playedFrom.current = null;
      if (start === null) return;
      const fromMs = Math.round(start * 1000);
      const toMs = Math.round(endSeconds * 1000);
      if (toMs - fromMs < 1000) return; // under a second is a click, not listening
      const url = `/api/coach/remote/${encodeURIComponent(sessionId)}/listen`;
      const body = JSON.stringify({ fromMs, toMs });
      // keepalive so the last stretch still lands when the page is closing.
      void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    },
    [sessionId],
  );

  useEffect(() => {
    // On leaving: the element may already be detached when React runs this cleanup (in-app navigation), so fall
    // back to the last position seen while playing. flushListen is a no-op when nothing is being played.
    const onHide = () => flushListen(audio.current?.currentTime ?? lastAt.current);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      onHide();
    };
  }, [flushListen]);

  useEffect(() => {
    let live = true;
    fetch(`/api/coach/remote/${encodeURIComponent(sessionId)}/stats`)
      .then(async (r) => (r.ok ? ((await r.json()) as Wire) : null))
      .then((w) => {
        if (live && w) setWire(w);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [sessionId]);

  useEffect(() => {
    let live = true;
    fetch(`/api/coach/remote/${encodeURIComponent(sessionId)}/trim`)
      .then(async (r) => (r.ok ? ((await r.json()) as { trims?: Array<{ id: string; startMs: number; endMs: number }> }) : null))
      .then((j) => {
        if (live && j?.trims) setTrims(j.trims);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [sessionId]);

  const trimRanges = trims.map((t) => ({ start_ms: t.startMs, end_ms: t.endMs }));
  useEffect(() => {
    trimRangesRef.current = trims.map((t) => ({ start_ms: t.startMs, end_ms: t.endMs }));
  }, [trims]);

  const sendTrim = async (body: Record<string, unknown>, done: string) => {
    setTrimBusy(true);
    setTrimNote(null);
    try {
      const r = await fetch(`/api/coach/remote/${encodeURIComponent(sessionId)}/trim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as { trims?: Array<{ id: string; startMs: number; endMs: number }>; error?: string };
      if (!r.ok) {
        setTrimNote(j.error ?? "That didn't work. Nothing was changed.");
        return;
      }
      setTrims(j.trims ?? []);
      setTrimNote(done);
      setClipStart(null);
      setClipEnd(null);
      setConfirmTrim(false);
    } catch {
      setTrimNote("Couldn't reach the server. Nothing was changed.");
    } finally {
      setTrimBusy(false);
    }
  };

  const seek = useCallback((seconds: number) => {
    const el = audio.current;
    if (!el) return;
    const jump = skipTo(Math.max(0, seconds) * 1000, trimRangesRef.current);
    el.currentTime = jump === null ? Math.max(0, seconds) : jump / 1000;
    setAt(el.currentTime);
    void el.play().catch(() => {});
  }, []);

  useEffect(() => {
    registerSeek?.(seek);
    return () => registerSeek?.(null);
  }, [registerSeek, seek]);

  if (!wire || !wire.remote) return null;
  if (!wire.measurable) {
    return (
      <section className="rounded-2xl border border-default bg-base p-4 text-xs text-muted">
        This call&apos;s transcript has no timing yet, so who spoke when can&apos;t be shown.
      </section>
    );
  }

  const { stats, lanes, averages } = wire;
  const ends = [...lanes.rep, ...lanes.customer, ...lanes.unknown].map(([, e]) => e);
  const totalMs = Math.max(1, ...ends);
  const sides = (["rep", "customer", "unknown"] as const).filter((s) => s !== "unknown" || lanes.unknown.length > 0);

  const onTime = (el: HTMLAudioElement) => {
    setAt(el.currentTime);
    if (!el.seeking) lastAt.current = el.currentTime;
    // A trimmed section is never heard: jump past it (and past any trim right after it).
    const past = skipTo(el.currentTime * 1000, trimRanges);
    if (past !== null) {
      el.currentTime = past / 1000;
      return;
    }
    if (!only || el.paused) return;
    // Isolation: skip to the chosen speaker's next stretch; stop after their last.
    const ms = el.currentTime * 1000;
    const inside = lanes[only].some(([s, e]) => ms >= s && ms < e);
    if (inside) return;
    const next = lanes[only].find(([s]) => s > ms);
    if (next) el.currentTime = next[0] / 1000;
    else el.pause();
  };

  const tile = (label: string, value: string, avg: string | null, why?: string) => (
    <div className="rounded-lg border border-default p-2" title={why}>
      <span className="block text-[10px] text-muted">{label}</span>
      <span className="block text-base font-semibold tabular-nums text-primary">{value}</span>
      <span className="block text-[10px] text-muted">{avg === null ? "no average yet" : `your avg ${avg}`}</span>
    </div>
  );
  const pct = (x: number | null | undefined) => (x == null ? "—" : `${Math.round(x * 100)}%`);
  const sec = (x: number | null | undefined) => (x == null ? "—" : `${(x / 1000).toFixed(1)} s`);
  const num = (x: number | null | undefined) => (x == null ? "—" : String(Math.round(x * 10) / 10));
  const a = averages;

  return (
    <section className="rounded-2xl border border-default bg-base p-4 space-y-3" aria-label="Call">
      {wire.audioUrl ? (
        <div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- the transcript below is the caption. */}
          <audio
            ref={audio}
            src={wire.audioUrl}
            preload="metadata"
            onTimeUpdate={(e) => onTime(e.currentTarget)}
            onPlay={() => setPlaying(true)}
            onPause={(e) => {
              setPlaying(false);
              flushListen(e.currentTarget.currentTime);
            }}
            onPlaying={(e) => {
              if (playedFrom.current === null) playedFrom.current = e.currentTarget.currentTime;
            }}
            onSeeking={() => flushListen(lastAt.current)}
            onSeeked={(e) => {
              lastAt.current = e.currentTarget.currentTime;
              if (!e.currentTarget.paused) playedFrom.current = e.currentTarget.currentTime;
            }}
            onEnded={(e) => flushListen(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => {
              const t = Number(new URLSearchParams(window.location.search).get("t"));
              if (Number.isFinite(t) && t > 0) {
                e.currentTarget.currentTime = t;
                setAt(t);
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => seek(at - 10)} aria-label="Back 10 seconds" className="rounded-lg border border-default p-2 text-muted hover:text-primary">
              <RotateCcw className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => (audio.current?.paused ? void audio.current.play().catch(() => {}) : audio.current?.pause())}
              aria-label={playing ? "Pause" : "Play"}
              className="rounded-lg bg-ember-400 p-2 text-ink-950"
            >
              {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
            </button>
            <button type="button" onClick={() => seek(at + 10)} aria-label="Forward 10 seconds" className="rounded-lg border border-default p-2 text-muted hover:text-primary">
              <RotateCw className="h-4 w-4" aria-hidden />
            </button>
            <span className="text-xs tabular-nums text-muted">
              {mmss(at * 1000)} / {mmss(totalMs)}
            </span>
            <div className="ml-auto flex gap-1" role="group" aria-label="Speed">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={speed === s}
                  onClick={() => {
                    setSpeed(s);
                    if (audio.current) audio.current.playbackRate = s;
                  }}
                  className={`rounded px-1.5 py-0.5 text-[11px] ${speed === s ? SPEED_ON : SPEED_OFF}`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            {clipStart === null ? (
              <button type="button" onClick={() => { setClipStart(at); setClipEnd(null); setSaveNote(null); }}
                className="inline-flex items-center gap-1 rounded-lg border border-default px-2 py-1 text-muted hover:text-primary">
                <Scissors className="h-3.5 w-3.5" aria-hidden /> Start a clip at {mmss(at * 1000)}
              </button>
            ) : clipEnd === null ? (
              <>
                <span className="text-secondary">Clip from {mmss(clipStart * 1000)}</span>
                <button type="button" disabled={at - clipStart < 1} onClick={() => setClipEnd(at)}
                  className="rounded-lg border border-default px-2 py-1 text-muted hover:text-primary disabled:opacity-50">
                  End clip at {mmss(at * 1000)}
                </button>
                <button type="button" onClick={() => setClipStart(null)} className="px-1 text-muted hover:text-primary">Cancel</button>
              </>
            ) : (
              <>
                <span className="text-secondary">Clip {mmss(clipStart * 1000)}–{mmss(clipEnd * 1000)}</span>
                {isManager && (confirmTrim ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="text-secondary">Remove this section from playback, the transcript and the AI&apos;s reads?</span>
                    <button type="button" disabled={trimBusy}
                      onClick={() => void sendTrim({ startMs: Math.round(clipStart * 1000), endMs: Math.round(clipEnd * 1000) }, "Trimmed. The AI's reads of this call are being redone without it.")}
                      className="rounded-lg bg-ember-400 px-2 py-1 font-medium text-ink-950 disabled:opacity-50">
                      {trimBusy ? "Trimming…" : "Trim it"}
                    </button>
                    <button type="button" onClick={() => setConfirmTrim(false)} className="px-1 text-muted hover:text-primary">Keep it</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmTrim(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-default px-2 py-1 text-muted hover:text-primary">
                    <EyeOff className="h-3.5 w-3.5" aria-hidden /> Trim this section
                  </button>
                ))}
                <input value={clipTitle} onChange={(e) => setClipTitle(e.target.value)} maxLength={120} placeholder="Clip title"
                  aria-label="Clip title" className="min-w-0 flex-1 rounded border border-default bg-surface px-2 py-1 text-xs text-primary" />
                <button type="button" onClick={() => { setClipStart(null); setClipEnd(null); }} className="px-1 text-muted hover:text-primary">Cancel</button>
              </>
            )}
            <div className="ml-auto flex gap-1">
              {(["mine", ...(isManager ? (["company"] as const) : [])] as const).map((scope) => (
                <button key={scope} type="button" disabled={saving || (clipStart !== null && (clipEnd === null || !clipTitle.trim()))}
                  onClick={async () => {
                    setSaving(true);
                    setSaveNote(null);
                    try {
                      const clip = clipStart !== null && clipEnd !== null
                        ? { startMs: Math.round(clipStart * 1000), endMs: Math.round(clipEnd * 1000), title: clipTitle.trim() }
                        : undefined;
                      const r = await fetch("/api/coach/remote/library", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "add", scope, sessionId, clip }),
                      });
                      const j = (await r.json().catch(() => ({}))) as { error?: string; needsApproval?: boolean; pitchId?: string | null };
                      if (!r.ok) { setSaveNote(j.error ?? "Couldn't save it."); return; }
                      let msg = `Saved to ${scope === "company" ? "the company library" : "your library"}.`;
                      if (j.needsApproval && j.pitchId) {
                        // One consent path: the existing team-example request (0260), which also rings the rep's bell.
                        const ask = await fetch("/api/coach/sales-session/pitch-recordings/share", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ pitchId: j.pitchId, kind: "requested" }),
                        }).catch(() => null);
                        msg += ask?.ok ? " The rep has been asked to approve it; peers hear it once they do." : " Peers will hear it once the rep approves it as a team example.";
                      } else if (j.needsApproval) {
                        msg += " Peers will hear it once the call is scored and the rep approves it.";
                      }
                      setSaveNote(msg);
                      setClipStart(null); setClipEnd(null); setClipTitle("");
                    } catch {
                      setSaveNote("Couldn't reach the server. Try again.");
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-default px-2 py-1 text-muted hover:text-primary disabled:opacity-50">
                  <BookmarkPlus className="h-3.5 w-3.5" aria-hidden />
                  {clipStart !== null ? "Save clip" : "Save call"} to {scope === "company" ? "Company" : "Mine"}
                </button>
              ))}
            </div>
          </div>
          {saveNote && (
            <p className="mt-1 text-[11px] text-secondary" role="status">
              {saveNote}{" "}
              <Link href="/dashboard/sales-coach/library" className="text-brand hover:underline">Open the library</Link>
            </p>
          )}
          {trims.length > 0 && (
            <ul className="mt-2 space-y-1 text-[11px]" aria-label="Trimmed sections">
              {trims.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-secondary">
                  <EyeOff className="h-3.5 w-3.5 text-muted" aria-hidden />
                  <span>Trimmed {mmss(t.startMs)}–{mmss(t.endMs)}: skipped in playback, left out of the transcript and the AI&apos;s reads</span>
                  {isManager && (
                    <button type="button" disabled={trimBusy}
                      onClick={() => void sendTrim({ restoreTrimId: t.id }, "Restored. The AI's reads of this call are being redone with it.")}
                      className="ml-auto inline-flex items-center gap-1 text-brand hover:underline disabled:opacity-50">
                      <Undo2 className="h-3.5 w-3.5" aria-hidden /> Restore
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {trimNote && (
            <p className="mt-1 text-[11px] text-secondary" role="status">{trimNote}</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted">No recording is saved for this call, so there is nothing to play.</p>
      )}

      <div className="space-y-1.5" aria-label="Talk-time lanes">
        {sides.map((side) => (
          <div key={side} className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={only === side}
              onClick={() => setOnly(only === side ? null : side)}
              disabled={!wire.audioUrl}
              title={wire.audioUrl ? `Play only ${LANE_LABEL[side]}` : undefined}
              className={`w-24 shrink-0 text-left text-xs ${only === side ? "font-semibold text-primary" : "text-muted hover:text-primary"}`}
            >
              {LANE_LABEL[side]}
              {only === side ? " · only" : ""}
            </button>
            <div className="relative h-3.5 flex-1 overflow-hidden rounded bg-surface-raised">
              {lanes[side].map(([s, e]) => (
                <button
                  key={`${s}-${e}`}
                  type="button"
                  disabled={!wire.audioUrl}
                  onClick={() => seek(s / 1000)}
                  aria-label={`${LANE_LABEL[side]} ${mmss(s)} to ${mmss(e)}`}
                  className={`absolute top-0 h-full ${LANE_FILL[side]} opacity-80 hover:opacity-100`}
                  style={{ left: `${(s / totalMs) * 100}%`, width: `${Math.max(0.4, ((e - s) / totalMs) * 100)}%` }}
                />
              ))}
              {wire.audioUrl && (
                <span aria-hidden className="absolute top-0 h-full w-0.5 bg-primary" style={{ left: `${Math.min(100, ((at * 1000) / totalMs) * 100)}%` }} />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {tile("Talk ratio (time)", pct(stats.talkRatioTime), a ? pct(a.talkRatioTime) : null)}
        {tile("Longest monologue", mmss(stats.longestRepMonologueMs), a?.longestRepMonologueMs != null ? mmss(a.longestRepMonologueMs) : null)}
        {tile("Longest customer story", mmss(stats.longestCustomerStoryMs), a?.longestCustomerStoryMs != null ? mmss(a.longestCustomerStoryMs) : null)}
        {tile("Patience", sec(stats.patienceMs), a ? sec(a.patienceMs) : null, stats.patienceMs == null ? "You never answered right after the customer on this call." : undefined)}
        {tile("Questions / hour", num(stats.repQuestionsPerHour), a ? num(a.repQuestionsPerHour) : null)}
        {tile("Interactivity /10", num(stats.interactivity), a ? num(a.interactivity) : null, stats.interactivity == null ? "Only one side spoke." : undefined)}
      </div>
      <p className="text-[11px] text-muted">
        Measured from this call only; your averages are your own last 30 days, not a target.
        {wire.estimated ? " Some lines' end times were estimated (until the next person spoke), so pauses count as talk." : ""}
        {wire.untimed ? ` ${wire.untimed} line${wire.untimed === 1 ? "" : "s"} had no time and are left out.` : ""}
      </p>
    </section>
  );
}
