"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Lightbulb,
  Target,
  Radio,
  AlertTriangle,
  ChevronRight,
  Repeat,
  FileText,
  Award,
  Sparkles,
  TrendingUp,
  Quote,
  ChevronDown,
} from "lucide-react";
import { DeckCard } from "@/components/sales-coach/ui/deck";
import { LoadingButton } from "@/components/sales-coach/ui/LoadingButton";
import { SessionRecordingUpload } from "@/components/sales-coach/SessionRecordingUpload";
import { conversationDurationSeconds } from "@/lib/coach/conversationDuration";
import { afterPitchNeedsHeal } from "@/lib/coach/v5/afterPitchHeal";
import { shouldOfferBlankReadRecovery } from "@/lib/coach/v5/blankReadRecovery";
import {
  detectCaptureGap,
  afterPitchNeedsAutoRecover,
  type CaptureGap,
} from "@/lib/coach/v5/captureGap";
import { LinkProgress } from "@/components/sales-coach/ui/NavigationProgress";
import { LearningHint } from "@/components/learning/LearningHint";
import { useExperienceMode } from "@/components/experience/ExperienceModeProvider";
// §A13 — the moment/score shapes live once in summaryTypes (imported, not
// re-declared) so a new field like `sentiment` can't silently drift this page.
import type {
  SalesMoment as Moment,
  ScoreCategory,
} from "@/lib/coach/v5/summaryTypes";
// Outcome capture reuses the ONE definition + endpoint the session page uses
// (§A21 compose-don't-fork). In Standard the After-Pitch is the post-call screen,
// so the outcome — the consequence the coach measures against (§3.5) — is logged
// here, one tap, rather than lost when the dense session page is skipped.
import {
  OUTCOME_LABELS,
  OUTCOME_ORDER,
  type SalesOutcome,
} from "@/lib/coach/v5/outcomeLabels";

/**
 * After Pitch Summary — the rep's private "between doors" debrief (AMD-006
 * L4 surface for the PDF spec, founder 2026-07-02).
 *
 * Mobile-first: a phone card the rep glances at on the doorstep before the
 * next door. Our mono-amber identity, NOT the PDF's blue/red — the breakdown
 * moment is BURNT AMBER (ember-800), accents are ember, positives emerald,
 * per docs/BRAND.md + tokens.ts ("no red").
 *
 * Privacy (A18): the scoreboard here is the rep's private self-assessment.
 * The API + RLS enforce that only the owning rep can load this; a manager gets
 * a 403 / null.
 *
 * Continuity (AMD-006 L3): the summary auto-generates on arrival (ready before
 * the next driveway) and "Start Next Door" opens the next session in one tap,
 * carrying the same context — the rep never dead-ends.
 */

type CueLoopEntry = {
  cueText: string;
  mode: "suggestion" | "guide_response";
  timestampLabel: string | null;
  determination: "followed" | "partial" | "ignored" | null;
  source: "rep_marked" | "inferred" | null;
  evidence: string | null;
};
type Strength = { point: string; example: string };
type Growth = { opportunity: string; nextStep: string };
type Summary = {
  hasSignal: boolean;
  narrative: {
    hasSignal: boolean;
    strengths: Strength[];
    growthAreas: Growth[];
    closing?: string;
  };
  moments: Moment[];
  scores: ScoreCategory[];
  cueLoop: CueLoopEntry[];
  focus: { focus: string; why: string } | null;
};
type Session = {
  id: string;
  context: "in_person" | "video";
  clientLabel: string | null;
  audioDurationSeconds: number | null;
  // The saved-recording pointer (audit F3): the [id] GET already returns it (getSession → mapSession);
  // typing it here lets After-Pitch offer the one-tap re-transcribe when the audio saved but the transcript
  // didn't land — the exact STT-outage recovery scenario that produces this screen's empty state.
  audioAssetUrl: string | null;
  territory: string | null;
  approach: string | null;
  offer: string | null;
  startedAt?: string;
  endedAt?: string | null;
  outcome?: SalesOutcome | null;
};

/** Conversation length for the header ("2m 43s"). Prefers the recording's REAL audio length when the
 *  session was populated by an UPLOAD (audioDurationSeconds) over the session wall-clock — for an upload
 *  the started..ended span is just how long the session sat open, not the call, which showed "62m 47s" for
 *  a 4-minute clip (§3.5 measurement honesty). Live sessions have no audio length, so they fall back to the
 *  wall-clock, which is correct there. Null until a real duration is known — no fabricated number (§3.4). */
function durationLabel(
  audioSeconds?: number | null,
  start?: string,
  end?: string | null
): string | null {
  // Shared prefer-audio-else-wall-clock rule (audit F8); this surface shows exact m + s, so round the
  // (possibly fractional) wall-clock to whole seconds — audio lengths are already whole, so round is a no-op
  // there, preserving the prior behaviour exactly.
  const secs = conversationDurationSeconds(audioSeconds, start, end);
  if (secs === null) return null;
  const total = Math.round(secs);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Next-door label: increment a trailing number so "Door 17" → "Door 18",
 *  else reuse the label. Keeps the rep flowing without a form (AMD-006 L3). */
function nextDoorLabel(prev: string | null): string {
  if (!prev) return "Next door";
  const m = prev.match(/^(.*?)(\d+)\s*$/);
  if (m && m[2]) return `${m[1] ?? ""}${parseInt(m[2], 10) + 1}`;
  return prev;
}

export default function AfterPitchPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  // Experience dial (0110). Standard = the founder's simplified debrief: scores +
  // your-read + cue loop + Start Next Door, and NOTHING that adds words without
  // adding a decision. Expert = today's full surface, untouched (founder 2026-07-15:
  // "Keep Expert mode exactly how it is. But simplify the Sales Coach on Standard").
  // The removed blocks (moments timeline, What-happened replay, the breakdown 3-up)
  // are the ones crossed out in the spec PDF — they are momentum cost, not learning.
  const { isStandard } = useExperienceMode();
  const [session, setSession] = useState<Session | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  // The rep sees their full summary (incl. private scores) + Start Next Door.
  // A manager sees the same growth substance with scores stripped, and no
  // Start Next Door (they aren't the one walking to the next door).
  const [isOwner, setIsOwner] = useState(true);
  // The neutral factual "what happened" replay — reuses the existing session
  // summary engine (A21: compose, don't fork a second summarizer).
  const [whatHappened, setWhatHappened] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const generatingRef = useRef(false);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  // Auto-generate fires at most ONCE per session id. Its only other guard is the load()
  // dependency array, which includes `isStandard` — a value ExperienceModeProvider mutates
  // AFTER mount (the server-rendered initialMode can default to "standard" then reconcile to
  // "expert" for an Expert rep). That flip re-runs load() while the first (slow LLM) generate()
  // is still in flight, so `existing` is still null and a SECOND generate() would fire — double
  // LLM cost + double DB write + a duplicate after_pitch_summary_generated event polluting the
  // KPI stream. Keying the guard on id (not a bare bool) lets a genuine session switch re-arm it.
  const autoGenAttemptedFor = useRef<string | null>(null);
  // Automatic post-call recovery for a one-sided (customer-missing) transcript (2026-08-14). Fires at most
  // ONCE per id on the client (this latch); the durable at-most-once is the server auto_recover_attempted_at
  // marker, since a reload re-mounts. Ordered BEFORE the auto-heal in load(): a customer-missing session must
  // re-transcribe cleanly (recovering the missing side) rather than waste an LLM heal on the one-sided
  // transcript that produced the blank read.
  const autoRecoverAttemptedFor = useRef<string | null>(null);
  const [autoRecovering, setAutoRecovering] = useState(false);
  const [autoRecoverResolved, setAutoRecoverResolved] = useState(false);
  // The auto-recover terminal status, kept so the UI can be honest per outcome. In particular "still-one-sided"
  // (the audio genuinely holds ONE voice) must NOT show the re-transcribe card — re-transcribing reproduces the
  // same one-sided result (a false-promise loop). The API returns the distinct status precisely so we can say so.
  const [autoRecoverOutcome, setAutoRecoverOutcome] = useState<string | null>(null);
  // "What happened" is the longest block; collapsed by default so it doesn't
  // eat the viewport and bury the breakdown/scores below it (founder 2026-07-03).
  const [showWhatHappened, setShowWhatHappened] = useState(false);
  const [savingOutcome, setSavingOutcome] = useState<SalesOutcome | null>(null);
  // Spec 1b: name the session AFTER recording, once the rep knows what it was.
  const [renaming, setRenaming] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");

  const saveRename = useCallback(async () => {
    const label = labelDraft.trim();
    setRenaming(false);
    if (!label) return;
    try {
      const res = await fetch(`/api/coach/sales-session/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientLabel: label }),
      });
      if (res.ok) setSession((await res.json()).session);
    } catch {
      /* best-effort; the label just stays as it was */
    }
  }, [id, labelDraft]);

  // Log the call's result. Append-only, same endpoint the session page uses:
  // re-selecting records a correction, never erases the earlier read. This is the
  // consequence the coach grades itself against (§3.5), so in the Standard flow —
  // where this screen replaces the session page — it must be capturable right here.
  // useRef latch — same append-only double-write class as the session page's recordOutcome (build xl). /outcome
  // appends an immutable coach.session_outcome_recorded event per call; setSavingOutcome (useState) only disables
  // the button on the next render, so a fast double-click would append two identical events. Checked+set before
  // the first await, released in finally (a deliberate later re-record still works).
  const outcomeSubmitRef = useRef(false);
  const recordOutcome = useCallback(
    async (outcome: SalesOutcome) => {
      if (outcomeSubmitRef.current) return;
      outcomeSubmitRef.current = true;
      setSavingOutcome(outcome);
      try {
        const res = await fetch(`/api/coach/sales-session/${id}/outcome`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outcome }),
        });
        if (res.ok) setSession((await res.json()).session);
      } finally {
        setSavingOutcome(null);
        outcomeSubmitRef.current = false;
      }
    },
    [id]
  );

  // Returns the freshly-built summary so a caller can decide what to do next (e.g. route a first-visit
  // customer-missing read into auto-recover — 2026-08-14 finding ②). Null on latch-skip / error / 403.
  const generate = useCallback(async (): Promise<Summary | null> => {
    // Synchronous latch: /after-pitch runs the LLM and appends a
    // coach.after_pitch_summary_generated event with no already-generated
    // guard, so a double-fire (manual click racing the auto-gen effect, or a
    // double-click) wastes an LLM call and duplicates the event.
    if (generatingRef.current) return null;
    generatingRef.current = true;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/coach/sales-session/${id}/after-pitch`, {
        method: "POST",
      });
      if (res.status === 403) {
        setError("This summary is private to the rep who ran the call.");
        return null;
      }
      if (!res.ok) {
        setError(`Couldn't build the summary (HTTP ${res.status}).`);
        return null;
      }
      const d = await res.json();
      setSummary(d.summary);
      setIsOwner(d.isOwner ?? true);
      return (d.summary ?? null) as Summary | null;
    } catch {
      setError("Couldn't build the summary.");
      return null;
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  }, [id]);

  // Automatic recovery of a one-sided (customer-missing) transcript: re-diarize the saved audio server-side,
  // auto-assign the agent, replace the broken transcript, then rebuild + display the read. On any non-recovered
  // outcome (couldn't decide, still one-sided, already attempted, failed) fall back to the manual one-tap card.
  const autoRecover = useCallback(async () => {
    setAutoRecovering(true);
    try {
      const res = await fetch(`/api/coach/sales-session/${id}/auto-recover`, {
        method: "POST",
      });
      const d = (await res.json().catch(() => ({}))) as { status?: string };
      if (res.ok && d.status === "recovered") {
        // The corrected two-sided transcript is saved (the server after() regenerates the other artifacts);
        // rebuild + display the After-Pitch read from it. Mirrors the manual recovery's onRecovered.
        await generate();
      } else if (d.status === "canonical") {
        // The transcript is ALREADY two-sided — a prior recovery succeeded, but this session's STORED After-Pitch
        // is still the OLD blank customer-missing read (the post-recovery client generate() was lost: the rep
        // navigated away or dropped network in that window). Regenerate from the now-canonical transcript so the
        // reload HEALS the stale blank instead of showing it forever (2026-08-14 finding ⑥). This fires at most
        // once — the regenerated read is two-sided, so the next visit no longer detects a capture gap.
        await generate();
        setAutoRecoverResolved(true);
      } else {
        // Non-recovered terminal. Record WHICH one so the card can be honest — still-one-sided renders a
        // terminal message instead of a re-transcribe card that would only reproduce the one-sided result.
        setAutoRecoverOutcome(d.status ?? "failed");
        setAutoRecoverResolved(true);
      }
    } catch {
      setAutoRecoverOutcome("failed");
      setAutoRecoverResolved(true);
    } finally {
      setAutoRecovering(false);
    }
  }, [id, generate]);

  const load = useCallback(async () => {
    try {
      const [sRes, apRes, sumRes] = await Promise.all([
        fetch(`/api/coach/sales-session/${id}`).catch(() => null),
        fetch(`/api/coach/sales-session/${id}/after-pitch`).catch(() => null),
        // "What happened" is only rendered on the EXPERT branch; Standard never
        // shows it, so don't pay for the round-trip there (audit cycle 1, AMD-006
        // L1 — don't do work the surface won't use).
        isStandard
          ? Promise.resolve(null)
          : fetch(`/api/coach/sales-session/${id}/summarize`).catch(() => null),
      ]);
      let hasSavedRecording = false;
      let isVideoSession = false;
      if (sRes && sRes.ok) {
        const s = (await sRes.json()).session;
        setSession(s);
        hasSavedRecording = !!s?.audioAssetUrl;
        // A video session's mic is agent-only by design (the prospect is on the far end), so its transcript is
        // EXPECTED one-sided and its audio holds one voice — auto-recover would just burn a guaranteed-to-decline
        // diarization. Skip it. (Audit 2026-08-14 finding ⑤.)
        isVideoSession = s?.context === "video";
      }
      if (sumRes && sumRes.ok)
        setWhatHappened((await sumRes.json()).summary ?? null);
      let existing: Summary | null = null;
      if (apRes && apRes.ok) {
        const d = await apRes.json();
        existing = d.summary;
        setIsOwner(d.isOwner ?? true);
      }
      setSummary(existing);
      setLoading(false);
      // Auto-generate on arrival if none stored yet — "ready before the next
      // driveway" (AMD-006 L3). Cheap no-op if the transcript is too thin
      // (assembler returns hasSignal:false). Guarded to fire ONCE per id so a
      // post-mount mode reconcile can't trigger a duplicate LLM generation.
      //
      // Auto-HEAL (2026-08-06): ALSO regenerate when the stored summary has NO signal (!hasSignal). Past
      // sessions whose "Your read" came back blank during the 2026-07-30→08-06 reasoning-starvation outage
      // cached an EMPTY narrative; now that the token budget is fixed, re-generating on next view fills in the
      // real read instead of showing a permanent blank. Self-limiting: once a real narrative is stored
      // (hasSignal:true) this no longer fires, so a healthy session regenerates at most once.
      //
      // Auto-HEAL, part 2 (2026-08-13, audit e828f0e9+1): the composite `hasSignal` above is
      // `narrative.hasSignal || moments || scores || cueLoop` (afterPitch.ts). The scores are DETERMINISTIC —
      // computeQuestionRate returns a category for ANY session with agent turns — so a session with a BLANK
      // read but present scores stored `hasSignal:true` and this heal NEVER re-fired: the read stayed
      // permanently blank while the composite claimed signal (INV22 "error dressed as no-data", surviving at
      // the UI). We now ALSO heal when the NARRATIVE specifically came back blank. This is targeted, not
      // wasteful: scores-present ⟺ agent-turns-present, and a call with real agent turns that produced NO
      // narrative can only be a starved/errored read (the genuine-thin, no-agent-turns case has no scores →
      // composite false → the first clause already handles it). Bounded once-per-mount by the ref below.
      //
      // Auto-RECOVER takes precedence over the heal (2026-08-14). The customer-missing capture gap (talk_ratio
      // caveat present, agent turns scored) ALSO satisfies afterPitchNeedsHeal (scores>0 && blank narrative) —
      // but a heal just re-runs the LLM on the SAME one-sided transcript and stays blank. Re-transcribing first
      // recovers the missing customer side, so the rebuilt read has both sides. Only when auto-recover does not
      // apply (no capture gap / no saved audio) do we fall through to the LLM heal.
      if (
        !isVideoSession &&
        afterPitchNeedsAutoRecover(existing, hasSavedRecording) &&
        autoRecoverAttemptedFor.current !== id
      ) {
        autoRecoverAttemptedFor.current = id;
        void autoRecover();
      } else if (
        afterPitchNeedsHeal(existing) &&
        autoGenAttemptedFor.current !== id &&
        // Share the auto-recover latch: on a mode-reconcile re-run of load(), auto-recover's `if` is skipped
        // (its latch is set) and we must NOT then fall into a heal that re-runs the LLM on the same one-sided
        // transcript (double cost + duplicate KPI event). (Audit 2026-08-14 finding ②.)
        autoRecoverAttemptedFor.current !== id
      ) {
        autoGenAttemptedFor.current = id;
        // FIRST-VISIT recovery (2026-08-14 hole-hunt): on a customer-missing session's first view `existing` is
        // null, so afterPitchNeedsAutoRecover(existing,…) above was false and only a BLANK read was generated —
        // Standard reps, who get no mode-reconcile re-render to re-run load(), were then stranded on it (the
        // exact incident + user this recovery exists for). Generate first, then if the FRESH summary is the
        // recoverable customer-missing gap, engage auto-recover from it — no second mount required.
        const fresh = await generate();
        if (
          !isVideoSession &&
          afterPitchNeedsAutoRecover(fresh, hasSavedRecording) &&
          autoRecoverAttemptedFor.current !== id
        ) {
          autoRecoverAttemptedFor.current = id;
          void autoRecover();
        }
      }
    } catch {
      setLoading(false);
    }
  }, [id, generate, autoRecover, isStandard]);

  // Reset per-session view state when the id changes, so one rep's private scoreboard/summary
  // can't flash into another session's view. Latent today (After-Pitch is only reached by a fresh
  // mount from the session page, never after-pitch→after-pitch), floored now so a future
  // sessions-list "→ After-Pitch" deep link can't surface the bleed. Keyed on [id] only, so a
  // same-id mode reconcile does NOT re-flash the loading spinner.
  useEffect(() => {
    setLoading(true);
    setSummary(null);
    setWhatHappened(null);
    setError(null);
    setAutoRecoverResolved(false);
    setAutoRecoverOutcome(null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const startNextDoor = async () => {
    // Synchronous latch: the button is disabled only on `!session`, not while
    // the create POST is in flight, so a second click during the round-trip
    // would create a duplicate "next door" session.
    if (!session || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/sales-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: session.context,
          clientLabel: nextDoorLabel(session.clientLabel),
          territory: session.territory || undefined,
          approach: session.approach || undefined,
          offer: session.offer || undefined,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `Couldn't start the next door (HTTP ${res.status}).`);
      }
      const { session: next } = await res.json();
      router.push(`/dashboard/sales-coach/${next.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      startingRef.current = false;
      setStarting(false);
    }
    // On success we router.push away and unmount, so the latch stays set.
  };

  const ctxLabel = session
    ? session.context === "video"
      ? "Online video"
      : "In-person"
    : "";
  const dur = durationLabel(
    session?.audioDurationSeconds,
    session?.startedAt,
    session?.endedAt
  );
  // Standard sessions are created as "New session" (placeholder) — treat that
  // (or an empty label) as UNNAMED so we prompt the rep to name the pitch
  // prominently, not with a tiny "rename" link (founder 2026-07-26, image 5).
  const unnamed = !session?.clientLabel || session.clientLabel === "New session";

  return (
    // flex-1 + overflow-y-auto: the shell's <main> is overflow-hidden, so this
    // page MUST own its scroll region or content past one screen is clipped and
    // unscrollable (the "can't scroll down" bug). min-h-screen did not — and
    // this matches every sibling Sales Coach page's scroll idiom (A21).
    <div className="flex-1 overflow-y-auto bg-base">
      <div className="mx-auto w-full max-w-md px-4 py-6 space-y-5">
        {/* Header */}
        <div className="space-y-2">
          {/* Back-link (founder 2026-08-12, opt-a). In STANDARD the session detail page redirects ended
              sessions straight back HERE, so a link to [id] just loops — send the rep to the Sessions list
              instead (a real "back", role-aware: the tab shows the rep's history or the manager's team roster),
              mirroring the [id]-page "Back to sessions" fix (19d4f356). In EXPERT [id] doesn't redirect, so
              "Back to session" correctly returns to the full detail they came from. */}
          <Link
            href={isStandard ? "/dashboard/sales-coach/sessions" : `/dashboard/sales-coach/${id}`}
            className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-primary"
          >
            <LinkProgress />
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
            {isStandard ? "Back to sessions" : "Back to session"}
          </Link>
          <div className="text-center pt-1">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-lg font-bold text-primary">
                After Pitch Summary
              </h1>
              <Award className="w-5 h-5 text-brand shrink-0" aria-hidden />
            </div>
            {session && !renaming && (
              <div className="mt-1 space-y-1.5">
                <p className="text-[11px] text-brand">
                  {unnamed ? ctxLabel : session.clientLabel}
                  {/* Only call it a "conversation" when one was actually CAPTURED — real audio (an upload) or a
                      transcript with signal. Otherwise `dur` is just the session's idle wall-clock open-time, and
                      labelling that "Xm Ys conversation" contradicts the "No conversation was captured" body below
                      (§3.4 — don't claim a conversation that wasn't captured). Founder screenshot 2026-08-13. */}
                  {dur && (session.audioDurationSeconds || summary?.hasSignal)
                    ? ` · ${dur} conversation`
                    : unnamed
                      ? ""
                      : ` · ${ctxLabel}`}
                </p>
                {/* Spec 1b + founder image 5: name the pitch here, once the rep
                    knows what the call was. When still UNNAMED, this is a
                    prominent labelled button (not a tiny "rename" link) so the rep
                    knows they need to name it. Once named, it's the quiet rename. */}
                {isStandard && isOwner &&
                  (unnamed ? (
                    <button
                      type="button"
                      onClick={() => {
                        setLabelDraft("");
                        setRenaming(true);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#09090B] bg-gradient-to-br from-ember-300 via-ember-400 to-ember-500 px-3 py-1.5 rounded-lg hover:shadow-[0_0_20px_-6px_rgba(250,204,21,0.6)] transition-shadow"
                    >
                      <FileText className="w-3.5 h-3.5" aria-hidden />
                      Name this pitch
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setLabelDraft(session.clientLabel ?? "");
                        setRenaming(true);
                      }}
                      className="text-[11px] text-muted underline decoration-dotted hover:text-primary"
                    >
                      rename
                    </button>
                  ))}
              </div>
            )}
            {session && renaming && (
              <div className="mt-1 flex items-center justify-center gap-1.5">
                <input
                  autoFocus
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveRename();
                    if (e.key === "Escape") setRenaming(false);
                  }}
                  placeholder="Name this call (e.g. angry customer)"
                  className="text-[11px] bg-surface border border-default rounded-md px-2 py-1 text-primary placeholder:text-muted focus:outline-none focus:border-strong"
                />
                <button
                  type="button"
                  onClick={() => void saveRename()}
                  className="text-[11px] font-semibold text-[#09090B] bg-brand px-2 py-1 rounded-md"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        </div>

        {loading || generating ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
            <p className="text-xs">
              {generating ? "Building your summary…" : "Loading…"}
            </p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-ember-500/40 bg-ember-500/[0.06] p-4 text-center space-y-3">
            <p className="text-xs text-primary">{error}</p>
            <button
              type="button"
              onClick={() => void generate()}
              className="text-xs font-semibold text-[#09090B] bg-gradient-to-br from-ember-300 via-ember-400 to-ember-500 hover:shadow-[0_0_26px_-6px_rgba(250,204,21,0.65)] px-3 py-1.5 rounded-lg transition-colors"
            >
              Try again
            </button>
          </div>
        ) : !summary || !summary.hasSignal ? (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-5 text-center space-y-3">
            {/* Honest root cause, not a vague "not enough" (§3.4). The common
                cause is a call delivered WITHOUT live coaching running — "Start
                session" only opens the session; recording begins when you tap
                "Start live coaching" on the session screen. Name that, and point
                to the fix, so the rep isn't stuck re-trying the same empty step
                (§2 no error loops; AMD-006 L3 — a dead end becomes a next step). */}
            {/* Indication #3 (founder priority 2026-08-12): tell the rep WHY, and distinguish the two states.
                If audio WAS saved (the live path now persists it on Stop), this is a TRANSCRIPTION failure, not a
                lost call — say so, and that the audio is safe + recoverable. Only when there's genuinely no saved
                audio do we point to the "you have to be recording" cause. */}
            {session?.audioAssetUrl ? (
              <>
                <p className="text-xs text-primary font-medium">
                  Live transcription didn&apos;t connect for this call.
                </p>
                <p className="text-[11px] text-muted leading-relaxed">
                  Your audio <span className="text-secondary">was saved</span>, so nothing is lost —
                  the transcription service just didn&apos;t capture the words during the call (usually
                  a temporary connection issue). Recover your full review from the saved recording
                  below, or tap Rebuild.
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-primary font-medium">
                  No conversation was captured for this call yet.
                </p>
                <p className="text-[11px] text-muted leading-relaxed">
                  Live coaching has to be{" "}
                  <span className="text-secondary">recording during the call</span>{" "}
                  to capture it — opening the session isn&apos;t the same as recording
                  it. Recorded the call on your phone instead? Upload it below and the
                  coach will build your review from it. If you did record here and still
                  see this, tap Rebuild.
                </p>
              </>
            )}
            {/* Founder 2026-08-11: "even after the session so they can go back to upload."
                The upload now lives right here on the After-Pitch screen — the ONE place a
                Standard door-to-door rep lands after a call — so a phone recording / voice
                memo turns this dead end into a built review. onLabeled rebuilds the summary
                from the freshly-appended transcript (AMD-006 L3 continuity). Left-aligned
                because the card is a form, not centered prose. */}
            <div className="text-left">
              <SessionRecordingUpload
                sessionId={id}
                onLabeled={() => void generate()}
                hasSavedRecording={!!session?.audioAssetUrl}
                // Auto-recover (#2): if the audio was saved (live capture failed but the recording is safe),
                // re-transcribe it automatically so the rep lands on the one-tap "which voice is you?" instead
                // of having to tap "Re-transcribe" first.
                autoRetranscribe={!!session?.audioAssetUrl}
              />
            </div>
            <button
              type="button"
              onClick={() => void generate()}
              className="text-xs font-semibold text-[#09090B] bg-gradient-to-br from-ember-300 via-ember-400 to-ember-500 hover:shadow-[0_0_26px_-6px_rgba(250,204,21,0.65)] px-3 py-1.5 rounded-lg transition-colors"
            >
              Rebuild summary
            </button>
          </div>
        ) : isStandard ? (
          /* STANDARD (founder 2026-07-15): scores + your-read + cue loop + one
             focus + Start Next Door. The moments timeline, the "What happened"
             replay and the breakdown 3-up (You said / AI suggested / Strategy /
             Correct line) are REMOVED — they are the exact blocks crossed out in
             the spec PDF, and every one of them adds words and scrolling between
             the door just closed and the next one, which is the momentum cost the
             founder is removing. The conversation summary + timeline still live on
             the SESSION page for reliving the call (kept there, per the spec).
             Nothing honest is lost: the scores are unchanged, the read is the same
             engine, the focus is the same reconciled verdict (deriveFocus). */
          <>
            {/* Founder revision 2026-07-28 (PDF p2): post-pitch Standard order is
                scoreboard on top → after-pitch summary → next door focus. The
                "after-pitch summary" IS the "Your read" section (Narrative), which
                is auto-surfaced (defaultOpen) per "also have <Your Read>
                automatically triggered." Next Door Focus (FocusCard) lands last
                ("…then next door focus, thats it"). CueLoop is kept (existing
                component, not asked to be removed) with the review content, above
                the final focus card. */}
            <BlankReadRecovery
              sessionId={id}
              gap={detectCaptureGap(summary)}
              hasSavedRecording={!!session?.audioAssetUrl}
              autoRecovering={autoRecovering}
              autoRecoverResolved={autoRecoverResolved}
              autoRecoverOutcome={autoRecoverOutcome}
              onRecovered={() => void generate()}
            />
            <Scoreboard scores={summary.scores} />
            <Narrative narrative={summary.narrative} defaultOpen />
            <CueLoop entries={summary.cueLoop} />
            <FocusCard focus={summary.focus} />
          </>
        ) : (
          <>
            <BlankReadRecovery
              sessionId={id}
              gap={detectCaptureGap(summary)}
              hasSavedRecording={!!session?.audioAssetUrl}
              autoRecovering={autoRecovering}
              autoRecoverResolved={autoRecoverResolved}
              autoRecoverOutcome={autoRecoverOutcome}
              onRecovered={() => void generate()}
            />
            <Timeline moments={summary.moments} />
            {whatHappened && (
              <LearningHint
                as="block"
                category="Sales Coach · After Pitch"
                title="What happened"
                whatItIs="A neutral, factual replay of the conversation — what was actually said, without judgement. Collapsed by default; tap the row to expand it."
                why="Before you can learn from a call you have to see it as it happened, not as you remember it. Memory edits under pressure; the transcript doesn't. It stays collapsed so the recap never buries the breakdown and scores that tell you what to do next."
                how="Tap to expand the full recap when you want to re-ground in the real call; leave it collapsed to go straight to the breakdown and scores below."
                principle="You can only improve the call you actually see, not the one you wish you'd had."
              >
                <DeckCard className="p-4">
                  <CollapseToggle
                    title="What happened"
                    icon={
                      <FileText className="w-3.5 h-3.5 text-brand" aria-hidden />
                    }
                    open={showWhatHappened}
                    onToggle={() => setShowWhatHappened((v) => !v)}
                  />
                  {showWhatHappened && (
                    <p className="text-xs text-secondary leading-relaxed whitespace-pre-wrap mt-2.5">
                      {whatHappened}
                    </p>
                  )}
                </DeckCard>
              </LearningHint>
            )}
            {/* Mockup's core flow: breakdown → 3-up key moves → correct
                line → score strip. */}
            <BreakdownBlock moments={summary.moments} />
            <KeyMoves
              moments={summary.moments}
              cueLoop={summary.cueLoop}
              focus={summary.focus}
            />
            <CorrectLineCard moments={summary.moments} />
            <Scoreboard scores={summary.scores} />
            {/* Richer detail kept below the fold (§1.5 — don't delete working
                surfaces the mockup happens not to show). Focus lives in the
                3-up above when there's a breakdown; otherwise its own card. */}
            <Narrative narrative={summary.narrative} />
            <CueLoop entries={summary.cueLoop} />
            {!summary.moments.some((m) => m.isBreakdown) && (
              <FocusCard focus={summary.focus} />
            )}
          </>
        )}

        {/* Continuity. The REP gets one-tap Start Next Door (AMD-006 L3). A
            MANAGER is viewing to coach — no next door for them; scores are the
            rep's private self-assessment and aren't shown to managers (A18). */}
        {!loading && (
          <div className="space-y-2 pt-1">
            {/* Call outcome — Standard only, owner only. In Expert this is captured
                on the session page (untouched); in Standard this screen replaces it,
                so the consequence the coach measures against (§3.5) is logged right
                here, one tap, above Next Door. Append-only: re-tapping is a
                correction, never an erase. A LOSS is the most valuable data, so the
                copy never nudges toward the flattering answer (§3.5). */}
            {isStandard && isOwner && session && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 space-y-2">
                <p className="text-[11px] font-semibold text-primary">
                  How did it go?
                  {session.outcome == null && (
                    <span className="ml-1 font-normal text-muted">
                      — logging the real result is what sharpens your coaching.
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {OUTCOME_ORDER.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => void recordOutcome(o)}
                      disabled={savingOutcome !== null}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                        session.outcome === o
                          ? "border-ember-400/50 bg-ember-400/10 text-brand"
                          : "border-default text-secondary hover:text-primary"
                      }`}
                    >
                      {OUTCOME_LABELS[o]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {isOwner ? (
              <LearningHint
                as="block"
                category="Sales Coach · After Pitch"
                title="Start Next Door"
                whatItIs="Opens your next session in one tap, carrying this call's context (territory, approach, offer) forward."
                why="The debrief is only worth doing if it changes the very next call. This closes the loop between reviewing and doing so nothing stalls you on the driveway."
                how="Read your Next Door Focus above, then tap this to walk into the next door with that one fix in mind."
                principle="Learning that doesn't reach the next door is just a nice feeling — the point is the next knock."
              >
                <LoadingButton
                  pending={starting}
                  onClick={() => void startNextDoor()}
                  disabled={!session || starting}
                  icon={<ChevronRight className="w-4 h-4" aria-hidden />}
                  spinnerClassName="w-4 h-4"
                  className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-[#09090B] bg-gradient-to-br from-ember-300 via-ember-400 to-ember-500 hover:shadow-[0_0_26px_-6px_rgba(250,204,21,0.65)] disabled:opacity-50 px-4 py-3 rounded-xl transition-colors"
                >
                  Start Next Door
                </LoadingButton>
              </LearningHint>
            ) : (
              summary?.hasSignal && (
                <p className="text-[10px] text-muted text-center px-4">
                  Manager view — for coaching this rep&apos;s growth. Their
                  self-assessment scores stay private to them.
                </p>
              )
            )}
            {/* This "Replay conversation" / "Back to session" link goes to [id] to re-read the full transcript.
                In STANDARD that loops (the redirect sends ended sessions back to After-Pitch) AND is redundant —
                the transcript is already inline on this page (the "Conversation transcript" recap) — so hide it in
                Standard. In EXPERT [id] doesn't redirect, so it correctly opens the full session. (Founder opt-a
                2026-08-12; the header back-link above is the real "back" for Standard.) */}
            {!isStandard && (
              <LearningHint
                as="block"
                category="Sales Coach · After Pitch"
                title={isOwner ? "Replay conversation" : "Back to session"}
                whatItIs="Returns you to the full session so you can re-read the exchange line by line."
                why="A summary compresses; sometimes the fix is in an exact phrase. Going back to the source keeps your read honest instead of relying on the condensed version."
                how="Use this when a moment in the breakdown or cue loop above needs the surrounding context to make sense."
                principle="When the summary and your memory disagree, the transcript is the tiebreaker."
              >
                <Link
                  href={`/dashboard/sales-coach/${id}`}
                  className="block text-center text-xs text-secondary hover:text-primary py-1"
                >
                  <LinkProgress />
                  {isOwner ? "Replay conversation" : "Back to session"}
                </Link>
              </LearningHint>
            )}
          </div>
        )}

        {/* Footer — mockup's signature line, honest: no fabricated version. */}
        <p className="text-center text-[10px] text-muted pt-2">
          Sales Coach · Personalized coaching
        </p>
      </div>
    </div>
  );
}

/* ─── Shared collapse affordance ─────────────────────────────────────
   Authored ONCE (A13 — this is the 3rd collapsible section; author the
   space by category, not per-incident) and reused by every collapsible
   card so the tap affordance stays identical (A18 label consistency,
   A21 one idiom). Same click behaviour as the original "What happened"
   toggle — mirroring the founder's reference, not redesigning it. */
function CollapseToggle({
  title,
  icon,
  open,
  onToggle,
  prominent = false,
}: {
  title: string;
  icon?: ReactNode;
  open: boolean;
  onToggle: () => void;
  /** Render as a bold, high-visibility amber button (founder 2026-08-04: make
   *  "Your read" a button that's easily seen on the after-pitch screen). */
  prominent?: boolean;
}) {
  if (prominent) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-ember-400/60 bg-ember-400/15 px-4 py-3.5 text-left shadow-[0_0_22px_-6px_rgba(250,204,21,0.55)] transition-colors hover:bg-ember-400/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-300"
      >
        <span className="flex items-center gap-2.5">
          {icon ?? <Lightbulb className="w-5 h-5 text-ember-300" aria-hidden />}
          <span className="text-base font-bold text-primary">{title}</span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-wide text-ember-200">
            {open ? "Hide" : "Tap to open"}
          </span>
          <ChevronDown
            className={`w-5 h-5 text-ember-200 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="w-full flex items-center justify-between gap-2 text-left"
    >
      <span className="flex items-center gap-1.5">
        {icon}
        <span className="text-sm font-semibold text-primary">{title}</span>
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        {!open && <span className="text-[10px] text-muted">Tap to read</span>}
        <ChevronDown
          className={`w-4 h-4 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </span>
    </button>
  );
}

/* ─── Timeline hero ──────────────────────────────────────────────── */
function Timeline({ moments }: { moments: Moment[] }) {
  if (moments.length === 0) return null;
  return (
    <LearningHint
      as="block"
      category="Sales Coach · After Pitch"
      title="Conversation timeline"
      whatItIs="The shape of the whole call at a glance — each dot is a moment (opener, discovery, objection, close). The bright, glowing amber dot is where the call broke down."
      why="Sales calls turn on a few pivotal moments, not every sentence. Seeing the arc lets you find the moment that mattered instead of re-litigating the whole conversation."
      how="Scan left to right for the glowing amber dot — that's the breakdown detailed just below. The timestamps orient you to when each moment happened."
      principle="Every call has a hinge moment; find it and you find where to improve."
    >
      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4">
        {/* pt-3 so the breakdown dot's ring+glow clears the clip — overflow-x
            forces overflow-y:auto, which was cutting the circle at the top. */}
        <div className="flex items-start gap-2 overflow-x-auto pt-3 pb-1">
          {moments.map((m, i) => (
          <div key={i} className="flex-1 min-w-[62px] text-center">
            <div className="relative flex items-center justify-center h-4 mb-2">
              {/* continuous track — a segment left and right of each node so
                  the dots read as one connected timeline (mockup). */}
              {i > 0 && (
                <span className="absolute right-1/2 top-1/2 h-px w-full -translate-y-1/2 bg-white/12" />
              )}
              {i < moments.length - 1 && (
                <span className="absolute left-1/2 top-1/2 h-px w-full -translate-y-1/2 bg-white/12" />
              )}
              {/* breakdown = the brightest node (mockup's highlight) but kept
                  in our ember accent, not the PDF's yellow (docs/BRAND.md). */}
              <span
                className={`relative z-10 rounded-full ${
                  m.isBreakdown
                    ? "w-4 h-4 bg-ember-400 ring-4 ring-ember-400/25 shadow-[0_0_14px_-1px_rgba(250,204,21,0.8)]"
                    : "w-2.5 h-2.5 bg-white/25"
                }`}
              />
            </div>
            {m.timestampLabel && (
              <p
                className={`text-[11px] font-bold ${
                  m.isBreakdown ? "text-brand" : "text-primary"
                }`}
              >
                {m.timestampLabel}
              </p>
            )}
            <p
              className={`text-[10px] leading-tight mt-0.5 ${
                m.isBreakdown ? "text-amber-300 font-semibold" : "text-muted"
              }`}
            >
              {m.label}
            </p>
            {/* Customer-sentiment direction at this moment — §A21 parity with the
                summary-surface timeline (founder 2026-07-07). */}
            {m.sentiment === "warming" && (
              <p className="text-[10px] text-emerald-400 leading-none mt-0.5" title="customer warming">
                ↗
              </p>
            )}
            {m.sentiment === "cooling" && (
              <p className="text-[10px] text-amber-400 leading-none mt-0.5" title="customer cooling">
                ↘
              </p>
            )}
          </div>
          ))}
        </div>
      </section>
    </LearningHint>
  );
}

/* ─── Breakdown block (burnt amber, our identity's "danger") ─────── */
function BreakdownBlock({ moments }: { moments: Moment[] }) {
  const b = moments.find((m) => m.isBreakdown);
  if (!b) return null;
  return (
    <LearningHint
      as="block"
      category="Sales Coach · After Pitch"
      title="Where it broke down"
      whatItIs="The single moment the call turned against you — when it happened and what shifted the customer away."
      why="One clear breakdown you can name and fix beats a vague sense the call 'went badly.' Naming the exact moment is what makes it coachable."
      how="Read what happened here, then the three cards just below break it into what you said, the better move, and the one strategy to carry forward."
      principle="You can't fix a call you can only describe as 'off' — name the moment, then change it."
    >
      <section className="rounded-xl overflow-hidden border border-ember-700/50">
        <div className="bg-ember-800 px-4 py-2.5 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-ember-50 shrink-0" aria-hidden />
          <p className="text-xs font-bold text-ember-50">
            {b.timestampLabel ? `${b.timestampLabel} · ` : ""}
            {b.label}
          </p>
        </div>
        <div className="bg-ember-800/[0.08] p-4">
          <p className="text-xs text-secondary leading-relaxed">
            {b.note ??
              (b.customerLine
                ? `Customer: “${b.customerLine}”`
                : "The call lost momentum here.")}
          </p>
        </div>
      </section>
    </LearningHint>
  );
}

/* ─── Key moves (mockup's 3-up: You said / AI suggested / Strategy) ─
   Every cell is real, single-sourced data — NO fabricated benchmark.
   The mockup's "Outcome: top reps convert X% higher" is replaced by a
   forward-looking Strategy upgrade drawn from the same focus the engine
   already computes (§A21 compose, don't fork; §3.4 no invented stats). */
function KeyMoves({
  moments,
  cueLoop,
  focus,
}: {
  moments: Moment[];
  cueLoop: CueLoopEntry[];
  focus: Summary["focus"];
}) {
  const b = moments.find((m) => m.isBreakdown);
  // Needs the breakdown moment (You said / AI suggested hang off it). With no
  // breakdown, the standalone Focus card carries the strategy instead.
  if (!b) return null;
  const youSaid = b.repLine;
  const suggested = cueLoop[0]?.cueText ?? b.correction?.correctLine ?? null;
  const strategy = focus?.focus ?? "Keep doing what worked — nothing broke.";
  return (
    <div className="grid grid-cols-3 gap-2">
      <LearningHint
        as="block"
        category="Sales Coach · After Pitch"
        title="You said"
        whatItIs="The exact line you used at the moment the call turned — pulled verbatim from the transcript, not paraphrased."
        why="Seeing your own words at the hinge moment is what makes the lesson stick. A paraphrase lets you off the hook; the real line is the thing to change."
        how="Read it next to the AI-suggested move to feel the difference between what you did and what lands better."
        principle="Change starts with seeing exactly what you said, not a kinder version of it."
      >
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 h-full">
          <div className="flex items-center gap-1 mb-1.5">
            <Quote className="w-3 h-3 text-muted" aria-hidden />
            <p className="text-[9px] uppercase tracking-wide text-muted font-bold">
              You said
            </p>
          </div>
          <p className="text-[11px] text-secondary leading-snug">
            {youSaid ? `“${youSaid}”` : "—"}
          </p>
        </div>
      </LearningHint>
      <LearningHint
        as="block"
        category="Sales Coach · After Pitch"
        title="AI suggested"
        whatItIs="The move the coach would have made at that moment — the specific alternative to what you said."
        why="A critique that only says 'that was wrong' teaches nothing. Handing you the concrete better line is what turns the breakdown into a repeatable skill."
        how="Say this version out loud once. The point isn't to memorise it — it's to feel the shape of the better move so it's there next door."
        principle="The fix has to be a line you could actually say, not just a note that you erred."
      >
        <div className="rounded-xl border border-ember-400/30 bg-ember-400/[0.05] p-3 h-full">
          <div className="flex items-center gap-1 mb-1.5">
            <Sparkles className="w-3 h-3 text-brand" aria-hidden />
            <p className="text-[9px] uppercase tracking-wide text-brand font-bold">
              AI suggested
            </p>
          </div>
          <p className="text-[11px] text-secondary leading-snug">
            {suggested ? `“${suggested}”` : "—"}
          </p>
        </div>
      </LearningHint>
      <LearningHint
        as="block"
        category="Sales Coach · After Pitch"
        title="Strategy upgrade"
        whatItIs="One short piece of advice to carry into your very next pitch — forward-looking, not a score on this one."
        why="A debrief only pays off if it changes the next conversation. This is the single strategic adjustment worth taking to the next door, drawn from how this call actually went — never an invented benchmark."
        how="Hold just this one thing in mind at the next door. It's the same focus as the Next Door card below, condensed to a glance."
        principle="The point of reviewing a call is the next call — carry one upgrade, not ten regrets."
      >
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 h-full">
          <div className="flex items-center gap-1 mb-1.5">
            <TrendingUp className="w-3 h-3 text-emerald-400" aria-hidden />
            <p className="text-[9px] uppercase tracking-wide text-emerald-300 font-bold">
              Strategy upgrade
            </p>
          </div>
          <p className="text-[11px] text-secondary leading-snug">{strategy}</p>
        </div>
      </LearningHint>
    </div>
  );
}

/* ─── Correct line (the deliverable rewrite + why it works) ──────── */
function CorrectLineCard({ moments }: { moments: Moment[] }) {
  const b = moments.find((m) => m.isBreakdown);
  if (!b?.correction) return null;
  return (
    <LearningHint
      as="block"
      category="Sales Coach · After Pitch"
      title="Correct line"
      whatItIs="The full version of the line to use instead — the exact words, plus what they do to the conversation."
      why="The three-up above shows the move at a glance; this is the whole line spelled out so you could deliver it verbatim, and the 'why' tells you what it changes so you can adapt it in your own voice."
      how="Read the line, then the why beneath it. Aim to reproduce the effect — moving the customer to think — not to recite the words."
      principle="A correction you understand the effect of is one you can use everywhere, not just this once."
    >
      <section className="rounded-xl overflow-hidden border border-ember-400/40">
        <div className="bg-ember-400/[0.1] px-4 py-2">
          <p className="text-xs font-bold text-brand">Correct line</p>
        </div>
        <div className="bg-ember-400/[0.04] p-4 space-y-1.5">
          <p className="text-xs text-primary leading-relaxed">
            {b.correction.correctLine}
          </p>
          <p className="text-[11px] text-secondary leading-relaxed border-t border-default pt-2">
            {b.correction.whyItWorks}
          </p>
        </div>
      </section>
    </LearningHint>
  );
}

/* ─── BlankReadRecovery (founder 2026-08-13; automatic recovery 2026-08-14) ───────────────────────────
   A one-sided session (one voice missed by live STT/attribution) still has COMPOSITE signal (moments /
   cue-loop), so the whole-summary-empty recovery never renders — the rep is left with a blank "Your read".

   AUTOMATIC first (2026-08-14): for the customer-missing gap the page auto-fires the server /auto-recover,
   which re-diarizes the saved audio cleanly, auto-assigns the agent, and rebuilds the read — no rep action.
   While that's in flight this shows a working state. The MANUAL one-tap card below is the FALLBACK, shown
   only when auto-recover resolved WITHOUT recovering (couldn't separate the voices / already attempted /
   failed), or for the agent-missing direction auto-recover doesn't own.

   HONESTY GATE (§3.4): visibility + the missing-side wording are driven by the capture-gap DIRECTION
   (detectCaptureGap), never a blank narrative alone — a two-sided STARVED read (no capture gap) must never
   see a re-transcribe affordance, because re-transcribing reproduces the same transcript and the copy would
   assert a capture failure that didn't happen. shouldOfferBlankReadRecovery is pure + detection-tested. */
function BlankReadRecovery({
  sessionId,
  gap,
  hasSavedRecording,
  autoRecovering,
  autoRecoverResolved,
  autoRecoverOutcome,
  onRecovered,
}: {
  sessionId: string;
  gap: CaptureGap;
  hasSavedRecording: boolean;
  autoRecovering: boolean;
  autoRecoverResolved: boolean;
  autoRecoverOutcome: string | null;
  onRecovered: () => void;
}) {
  // Automatic recovery in flight — a working state, not the manual tap card.
  if (autoRecovering) {
    return (
      <section className="rounded-2xl border border-ember-400/30 bg-ember-400/[0.05] p-4">
        <p className="text-xs text-primary font-medium">Recovering your read from the recording…</p>
        <p className="text-[11px] text-muted leading-relaxed mt-1">
          One side of the call wasn&apos;t captured live, so we&apos;re re-transcribing the saved audio to rebuild
          the full read. This only takes a moment.
        </p>
      </section>
    );
  }
  // Auto-recover found only ONE voice in the recording — re-transcribing it again would reproduce the same
  // one-sided result, so DON'T offer the re-transcribe card (a false-promise loop). Say honestly what happened
  // (§3.4). This is the terminal the API's distinct "still-one-sided" status exists to enable.
  if (autoRecoverOutcome === "still-one-sided") {
    return (
      <section className="rounded-2xl border border-default bg-surface/60 p-4">
        <p className="text-xs text-primary font-medium">Only one side of this call was recorded.</p>
        <p className="text-[11px] text-muted leading-relaxed mt-1">
          The saved audio only picked up one voice, so there&apos;s no second side to recover — the scores and
          focus below are built from what was captured. For the full written read next time, make sure both
          voices reach the mic.
        </p>
      </section>
    );
  }
  if (!shouldOfferBlankReadRecovery({ gap, hasSavedRecording, autoRecoverResolved })) return null;
  // Name the missing side honestly (never assert the wrong one).
  const missing =
    gap === "agent-missing"
      ? "your side of the call wasn't transcribed live"
      : "the other side of the call wasn't captured live";
  return (
    <section className="rounded-2xl border border-ember-400/30 bg-ember-400/[0.05] p-4 space-y-3">
      <div>
        <p className="text-xs text-primary font-medium">Your written read didn&apos;t generate for this call.</p>
        <p className="text-[11px] text-muted leading-relaxed mt-1">
          The full written read came back blank because {missing} — so the breakdown below is built from only
          one side. Your audio <span className="text-secondary">was saved</span>, so recover the full read from
          the recording:
        </p>
      </div>
      <SessionRecordingUpload
        sessionId={sessionId}
        onLabeled={onRecovered}
        hasSavedRecording={hasSavedRecording}
        autoRetranscribe={hasSavedRecording}
      />
    </section>
  );
}

/* ─── Narrative (reused growth review — tone law: strengths first) ─
   Titled "Your read" in the UI. defaultOpen lets a caller auto-expand it —
   Standard passes it so "Your Read" is auto-surfaced on the post-pitch screen
   (founder revision 2026-07-28: "also have <Your Read> automatically triggered").
   Expert leaves it collapsed (defaultOpen defaults false). */
function Narrative({
  narrative,
  defaultOpen = false,
}: {
  narrative: Summary["narrative"];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // Founder 2026-08-04: show "Your read" on EVERY after-pitch. We no longer hide the section when
  // the narrative is empty — instead it always renders, with an honest short state on a call too
  // thin to review (§3.4: present every time, but never a fabricated read).
  return (
      <section className="rounded-2xl border border-ember-400/25 bg-ember-400/[0.04] shadow-[0_0_34px_-12px_rgba(250,204,21,0.4)] p-4 space-y-3">
        <CollapseToggle
          title="Your read"
          prominent
          open={open}
          onToggle={() => setOpen((v) => !v)}
        />
        {open && (
        <>
        {!narrative.hasSignal && (
          // Short-call feedback (founder priority 2026-08-12: "as long as there's audio conversation there needs
          // to be a system feedback"). This section only renders when the after-pitch HAS signal (scores /
          // moments / cue loop all co-exist with a thin narrative — see afterPitch.ts hasSignal gate), so a thin
          // narrative NEVER means "nothing to learn". Don't dead-end on "too short"; point to the real feedback
          // that IS on this screen. A full authored read still needs a fuller pitch (§3.4 — don't fabricate one).
          <p className="text-xs text-secondary leading-relaxed">
            The full written read for this call isn&apos;t ready yet — but your scores and your{" "}
            <span className="text-primary">Next Door Focus</span> below are built from what actually
            happened, so there&apos;s still something to work on. A very short exchange may not have
            enough to write a full read.
          </p>
        )}
        {narrative.strengths.length > 0 && (
          <LearningHint
            as="block"
            category="Sales Coach · After Pitch"
            title="What you did well"
            whatItIs="The specific things that worked in this call, each tied to an actual moment from the conversation."
            why="Growth advice that only lists faults teaches you to distrust your instincts. Naming what worked tells you what to keep doing under pressure."
            how="Note these as your repeatable strengths — the moves to lean on again at the next door."
            principle="Protect what works before you fix what doesn't."
          >
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden />
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-emerald-300">
                What you did well
              </h3>
            </div>
            <ul className="space-y-1.5">
            {narrative.strengths.map((s, i) => (
              <li key={i} className="text-xs text-secondary leading-relaxed">
                <span className="text-primary font-medium">{s.point}</span>
                {s.example && (
                  <span className="block text-[11px] text-muted mt-0.5 italic">
                    “{s.example}”
                  </span>
                )}
              </li>
            ))}
            </ul>
          </div>
          </LearningHint>
        )}
        {narrative.growthAreas.length > 0 && (
          <LearningHint
            as="block"
            category="Sales Coach · After Pitch"
            title="Opportunities to grow"
            whatItIs="Where the call could improve — each opportunity paired with a concrete next step, not just a criticism."
            why="A gap without a next step is just discouragement. Pairing each one with an action is what turns a weakness into a plan."
            how="Pick the one that shows up most often across your calls and work it first — you don't have to fix all of these at once."
            principle="An opportunity without a next step is a complaint; with one, it's a plan."
          >
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" aria-hidden />
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-amber-300">
                Opportunities to grow
              </h3>
            </div>
            <ul className="space-y-1.5">
            {narrative.growthAreas.map((g, i) => (
              <li key={i} className="text-xs text-secondary leading-relaxed">
                <span className="text-primary font-medium">{g.opportunity}</span>
                <span className="block text-[11px] text-brand mt-0.5">
                  Next step: {g.nextStep}
                </span>
              </li>
            ))}
            </ul>
          </div>
          </LearningHint>
        )}
        {narrative.closing && (
          <p className="text-xs text-secondary italic border-t border-default pt-2.5">
            {narrative.closing}
          </p>
        )}
        </>
        )}
      </section>
  );
}

/* ─── Private scoreboard (self-assessment, evidenced — A11/A18) ──── */
function Scoreboard({ scores }: { scores: ScoreCategory[] }) {
  const [reviewOpen, setReviewOpen] = useState(false);
  if (scores.length === 0) return null;
  return (
      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <LearningHint
            as="inline-block"
            category="Sales Coach · After Pitch"
            title="Private to you"
            whatItIs="A privacy marker: these scores are visible only to you, never to your manager or teammates."
            why="Self-assessment only stays honest when it's unobserved. If a manager could see these, you'd start scoring for them instead of for the truth — and the mirror would break."
            how="Score yourself candidly here. What your coach sees is your growth narrative, not these numbers."
            principle="The moment a self-score has an audience, it stops measuring you and starts performing."
          >
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              Your scores
              <span className="text-[10px] text-muted font-normal">Private to you</span>
            </span>
          </LearningHint>
        </div>
        <LearningHint
          as="block"
          category="Sales Coach · After Pitch"
          title="Score strip"
          whatItIs="The dimensions of the call scored at a glance — each cell is one aspect of how the conversation went."
          why="A single overall number hides where you actually stand. Breaking it into dimensions tells you which specific skill to work, not just 'do better.'"
          how="Scan for your lowest cell, then tap Score Assessment Review below to read exactly what pulled it down."
          principle="One overall score tells you how you feel; the dimensions tell you what to change."
        >
        <div className="grid grid-cols-4 gap-1.5">
          {scores.map((c) => (
          <div
            key={c.key}
            className="rounded-lg border border-default bg-surface/40 p-2 text-center flex flex-col"
          >
            {/* Fixed 2-line label box so a wrapping label (e.g. "Talk /
                Listen") doesn't push its number lower than the rest — every
                number lands on the same baseline. */}
            <p className="text-[9px] uppercase tracking-wide text-muted font-bold leading-tight min-h-[1.5rem] flex items-center justify-center">
              {c.label}
            </p>
            <p className="text-sm font-bold text-primary mt-1">{c.display}</p>
          </div>
          ))}
        </div>
        </LearningHint>
        {/* Every number carries its evidence — no naked verdicts (A11).
            Collapsed behind "Score Assessment Review" just under the ratings
            (founder 2026-07-03), same tap-to-expand logic as "What happened"
            via the shared CollapseToggle (A13/A21). */}
        <LearningHint
          as="block"
          category="Sales Coach · After Pitch"
          title="Score Assessment Review"
          whatItIs="The evidence behind every number — the rationale, and where possible the exact line from the call that earned it. Collapsed by default; tap to expand."
          why="A naked score is a verdict you can't learn from or trust. Tying each number to real evidence is what keeps this honest instead of arbitrary. It sits collapsed so the strip stays scannable and you open the detail only when you want it."
          how="Tap Score Assessment Review, then read the rationale and citation for any score that surprised you — that's the part you can actually act on."
          principle="A score without its reason is an opinion; a score with its evidence is a lesson."
        >
        <div>
          <CollapseToggle
            title="Score Assessment Review"
            open={reviewOpen}
            onToggle={() => setReviewOpen((v) => !v)}
          />
          {reviewOpen && (
          <ul className="space-y-1.5 pt-1 mt-1">
            {scores.map((c) => (
            <li key={c.key} className="text-[11px] leading-relaxed">
              <span className="text-secondary font-medium">{c.label}</span>
              <span className="text-muted"> — {c.rationale}</span>
              {c.citation && (
                <span className="block text-[10px] text-muted italic mt-0.5">
                  “{c.citation}”
                </span>
              )}
            </li>
            ))}
          </ul>
          )}
        </div>
        </LearningHint>
        <LearningHint
          as="block"
          category="Sales Coach · After Pitch"
          title="Not a ranking"
          whatItIs="The framing that governs this whole scoreboard: it measures this call against your own growth, and only you see it."
          why="The instant scores become a ranking, they stop measuring improvement and start measuring status — and honest self-assessment dies. This line is the guardrail that keeps the scoreboard a growth tool."
          how="Read your scores as 'better or worse than my last call,' never 'better or worse than my teammate.'"
          principle="Compare yourself to your last door, not to the person at the next one."
        >
          <p className="text-[10px] text-muted pt-1 border-t border-default">
            A mirror of this one call against your own growth — not a ranking. Only
            you see these.
          </p>
        </LearningHint>
      </section>
  );
}

/* ─── Cue loop (what the coach cued → did you use it) ────────────── */
function CueLoop({ entries }: { entries: CueLoopEntry[] }) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;
  const badge = (e: CueLoopEntry) => {
    if (!e.determination)
      return { text: "—", cls: "text-muted border-default" };
    if (e.determination === "followed")
      return { text: "Used", cls: "text-emerald-300 border-emerald-500/30" };
    if (e.determination === "partial")
      return { text: "Partly", cls: "text-amber-300 border-amber-500/30" };
    return { text: "Not used", cls: "text-muted border-default" };
  };
  return (
    <LearningHint
      as="block"
      category="Sales Coach · After Pitch"
      title="What the coach cued"
      whatItIs="The live prompts the coach gave you mid-call, and whether you used each one — Used, Partly, or Not used. Collapsed by default; tap the header to expand."
      why="A cue you ignored and a cue you used teach different lessons. Closing the loop between advice and action is how you find out which coaching actually reaches you in the moment."
      how="Tap to expand, then look at the 'Not used' rows without guilt — they show where in-the-moment help isn't landing yet, which is the most useful thing to practise."
      principle="Guidance only counts when it changes what you do while the door is still open."
    >
      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4 space-y-3">
        <CollapseToggle
          title="What the coach cued"
          icon={<Radio className="w-3.5 h-3.5 text-brand" aria-hidden />}
          open={open}
          onToggle={() => setOpen((v) => !v)}
        />
        {open && (
        <ul className="space-y-2">
          {entries.map((e, i) => {
          const b = badge(e);
          return (
            <li
              key={i}
              className="rounded-lg border border-default bg-surface/30 p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-secondary leading-relaxed flex-1">
                  {e.timestampLabel && (
                    <span className="text-[10px] text-muted mr-1">
                      {e.timestampLabel}
                    </span>
                  )}
                  “{e.cueText}”
                </p>
                <span
                  className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${b.cls}`}
                >
                  {b.text}
                </span>
              </div>
              {e.determination && (
                <p className="text-[10px] text-muted mt-1">
                  {e.source === "rep_marked"
                    ? "You marked this."
                    : "Inferred from what you said next."}
                  {e.evidence ? ` — “${e.evidence}”` : ""}
                </p>
              )}
            </li>
          );
        })}
        </ul>
        )}
      </section>
    </LearningHint>
  );
}

/* ─── Next Door Focus (the ONE thing) + primary CTA sits below ──── */
function FocusCard({ focus }: { focus: Summary["focus"] }) {
  if (!focus) {
    return (
      <LearningHint
        as="block"
        category="Sales Coach · After Pitch"
        title="Next Door Focus"
        whatItIs="The one thing to carry into your next call. This time, nothing stood out — so the guidance is to keep doing what worked."
        why="Manufacturing a 'fix' when the call went well would train you to distrust good instincts. An honest coach says 'keep going' when that's the truth."
        how="Walk into the next door repeating what worked, not hunting for a problem that isn't there."
        principle="Not every call needs a fix — inventing one is its own mistake."
      >
        <section className="rounded-xl border border-ember-400/40 bg-ember-400/[0.06] p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="w-4 h-4 text-brand" aria-hidden />
            <h2 className="text-sm font-bold text-primary">Next Door Focus</h2>
          </div>
          <p className="text-xs text-secondary leading-relaxed">
            No single fix stood out this time — keep doing what worked.
          </p>
        </section>
      </LearningHint>
    );
  }
  return (
    <LearningHint
      as="block"
      category="Sales Coach · After Pitch"
      title="Next Door Focus"
      whatItIs="The single most important thing to fix on your very next call — one focus, with a concrete next step."
      why="A debrief that hands you ten things to fix changes nothing. Narrowing to one keeps the next door achievable, and one real change per call compounds fast."
      how="Hold just this one thing in mind at the next door. Ignore the rest for now — you'll surface the next focus after that call."
      principle="One fix you actually apply beats ten you only nodded at."
    >
      <section className="rounded-xl border border-ember-400/50 bg-ember-400/[0.08] p-4 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Target className="w-4 h-4 text-brand" aria-hidden />
        <h2 className="text-sm font-bold text-primary">Next Door Focus</h2>
      </div>
      <p className="text-sm text-primary font-semibold leading-snug">
        {focus.focus}
      </p>
      <p className="text-xs text-secondary leading-relaxed">
        <span className="inline-flex items-center gap-1 text-brand">
          <Repeat className="w-3 h-3" aria-hidden /> Next step:
        </span>{" "}
        {focus.why}
      </p>
      </section>
    </LearningHint>
  );
}
