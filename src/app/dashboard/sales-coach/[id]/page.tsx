"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  CheckCircle2,
  Lightbulb,
  Square,
  FileText,
  HelpCircle,
  Target,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { SessionCoachTools } from "@/components/sales-coach/SessionCoachTools";
import {
  PivotAndScores,
  type PivotMoment,
  type SalesMoment,
  type SalesIntel,
} from "@/components/sales-coach/PivotAndScores";
import { LoadingButton } from "@/components/sales-coach/ui/LoadingButton";
import { LinkProgress } from "@/components/sales-coach/ui/NavigationProgress";
import { SessionRecordingUpload } from "@/components/sales-coach/SessionRecordingUpload";
import { LiveCoachingPanel } from "@/components/sales-coach/LiveCoachingPanel";
import { LearningHint } from "@/components/learning/LearningHint";
import { useExperienceMode } from "@/components/experience/ExperienceModeProvider";
import {
  OUTCOME_LABELS,
  OUTCOME_ORDER,
  type SalesOutcome,
} from "@/lib/coach/v5/outcomeLabels";

/**
 * /dashboard/sales-coach/[id] — session review surface.
 *
 * Shows the diarized transcript + the post-call growth review (tone law:
 * strengths first, then growth-as-opportunity) + the four C.A.R.E
 * features (summarize / spawn task / ask coach / decision dialogue),
 * each reusing the existing engine (§A21).
 */

type Segment = {
  id: string;
  speaker: "agent" | "customer" | "unknown";
  text: string;
  seq: number;
};
type Session = {
  id: string;
  context: "in_person" | "video";
  clientLabel: string | null;
  status: "active" | "ended" | "reviewed";
  startedAt: string;
  // Phase 2 capture.
  territory: string | null;
  approach: string | null;
  offer: string | null;
  outcome: SalesOutcome | null;
  dealValue: number | null;
  // Present when a recording was saved (getSession returns it). Used to offer the
  // re-transcribe-from-storage recovery when the transcript is empty.
  audioAssetUrl: string | null;
};

type Strength = { point: string; example: string };
type Growth = { opportunity: string; nextStep: string };
type Review = {
  hasSignal: boolean;
  strengths: Strength[];
  growthAreas: Growth[];
  closing?: string;
};

export default function SessionDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  // Experience dial. Standard = the founder's simplified flow (spec 2026-07-15):
  // when the recording ends, the After-Pitch Summary IS the post-call screen — it
  // "comes up" with a single Start Next Door, nothing else. Expert keeps today's
  // full post-call surface (Prep / Generate review / outcome / why / transcript…),
  // untouched.
  const { isStandard } = useExperienceMode();
  const [session, setSession] = useState<Session | null>(null);
  const [transcript, setTranscript] = useState<Segment[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [pivot, setPivot] = useState<PivotMoment | null>(null);
  const [moments, setMoments] = useState<SalesMoment[]>([]);
  const [intel, setIntel] = useState<SalesIntel | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Phase 4 (founder 2026-08-01): finishing a session REQUIRES naming it before the After-Pitch opens.
  // The gate is shown on any finish path (recording complete OR manual End session); it can't be skipped.
  const [namingOpen, setNamingOpen] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [namingError, setNamingError] = useState<string | null>(null);
  const [namingBusy, setNamingBusy] = useState(false);

  // Guard against a stale-response race on rapid session navigation (A→B): a slow
  // load for A must not overwrite B's session/review. Stamp + verify still-current.
  const loadReqIdRef = useRef("");
  const load = useCallback(async () => {
    loadReqIdRef.current = id;
    try {
      const [sRes, rRes, sumRes, wRes] = await Promise.all([
        fetch(`/api/coach/sales-session/${id}`).catch(() => null),
        fetch(`/api/coach/sales-session/review?sessionId=${id}`).catch(() => null),
        fetch(`/api/coach/sales-session/${id}/summarize`).catch(() => null),
        fetch(`/api/coach/sales-session/${id}/why`).catch(() => null),
      ]);
      if (loadReqIdRef.current !== id) return; // superseded by a newer session
      if (sRes && sRes.ok) {
        const d = await sRes.json();
        setSession(d.session);
        setTranscript(d.transcript ?? []);
      } else {
        setError("Couldn't load the session.");
      }
      if (rRes && rRes.ok) setReview((await rRes.json()).review);
      if (sumRes && sumRes.ok) {
        const sj = await sumRes.json();
        setSummary(sj.summary ?? null);
        setPivot((sj.pivot as PivotMoment | null) ?? null);
        setMoments(Array.isArray(sj.moments) ? (sj.moments as SalesMoment[]) : []);
        setIntel((sj.intel as SalesIntel | null) ?? null);
      }
      if (wRes && wRes.ok) {
        const w = await wRes.json();
        setRepHypothesis(w.repHypothesis ?? null);
        setSystemWhy(w.systemWhy ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset the local composer/draft state on session switch. TODAY each session is its own route
  // mount (nav never goes session→session while this page stays mounted), so this can't bite — but
  // `whyDraft` POSTs an APPEND-ONLY §3.1 event (submitWhy → /why). If a session→session control is
  // ever added (a next/prev arrow, a "next session" link) while the page is mounted, an unreset
  // whyDraft would submit rep A's hypothesis as an IMMUTABLE event on session B — unrecoverable.
  // This is the C.A.R.E draft-bleed class (2026-07-24); the structural floor makes it impossible up
  // front rather than waiting for the nav change to surface it. `load` (keyed on [id]) re-fetches the
  // server-derived state; this only clears local typed/derived buffers, mirroring a fresh mount.
  useEffect(() => {
    setWhyDraft("");
    setPrep(null);
    setPrepQuestion("");
    setPrepAnswer(null);
    setError(null);
    // Phase 4 (2026-08-01) — the required naming buffer is per-session too: close the modal + clear the typed
    // name on a session switch, so a half-typed name for session A can't ride a future session→session nav into
    // B's naming PATCH (same append-only-write-to-wrong-item risk as whyDraft above). Latent today (route
    // remount), floored here so it stays impossible if a session→session control is ever added.
    setNamingOpen(false);
    setSessionName("");
    setNamingError(null);
    // Reset the in-flight flag too: if a session→session control ever switches away mid-save, an unreset
    // namingBusy would ride into the next session and render Save permanently "Saving…"/disabled — and the
    // modal has no escape hatch, so that's a hard trap. A freshly-mounted session is never mid-save, so
    // clearing it here is always correct. (Found by the 2026-08-01 adversarial naming-gate audit.)
    setNamingBusy(false);
  }, [id]);

  // Standard (the rep's simplified flow): once a session is no longer active, the
  // After-Pitch Summary IS the post-call screen — for ANY view of an ended/reviewed
  // session, not only at the moment of ending. The dense summary / timeline / pivot
  // page is the Expert / manager surface. Founder 2026-07-29: on the user's side the
  // post-session pivot should land on the After-Pitch Summary, not the manager
  // dashboard. router.replace so Back doesn't bounce the rep back into the page we
  // just sent them out of. Expert (manager) stays on the full session page.
  useEffect(() => {
    if (isStandard && session && session.status !== "active") {
      router.replace(`/dashboard/sales-coach/${id}/after-pitch`);
    }
  }, [isStandard, session, id, router]);

  // useRef latch (same append-only double-write class as submitWhy): the button-triggered generateReview
  // guarded only with `generating` (useState), so a fast double-click can POST twice before the re-render —
  // and /review inserts an append-only event per run. Synchronous latch before the first await, released in
  // finally (a deliberate re-run after completion is still allowed).
  const reviewSubmitRef = useRef(false);
  const generateReview = async () => {
    if (reviewSubmitRef.current) return;
    reviewSubmitRef.current = true;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/sales-session/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
      });
      if (!res.ok) throw new Error(`Review failed (HTTP ${res.status})`);
      setReview((await res.json()).review);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
      reviewSubmitRef.current = false;
    }
  };

  // Phase 4 (founder 2026-08-01): finishing a session opens a REQUIRED naming gate — the rep must name the
  // session before it ends and the After-Pitch opens. Every finish path routes through here (the manual
  // "End session" button AND recording-complete), so no session reaches After-Pitch unnamed. Pre-fills any
  // existing name so a re-finish just confirms it.
  const openNaming = () => {
    setSessionName(session?.clientLabel ?? "");
    setNamingError(null);
    setNamingOpen(true);
  };

  // Submit the required name → end the session WITH the name in ONE PATCH → land on After-Pitch. The name is
  // mandatory (the modal has no skip/close and Save is disabled until it's non-empty). Ending + naming
  // together is safe + idempotent: the 0070 trigger stamps ended_at once on the active→ended transition and
  // never re-stamps, so a re-finish keeps the real end time; clientLabel becomes the session's name wherever
  // it's listed. On error we keep the modal open with the message rather than trapping the rep half-ended.
  const submitNameAndFinish = async () => {
    const name = sessionName.trim();
    if (name.length < 1) {
      setNamingError("Give this session a name to continue.");
      return;
    }
    // Re-entrancy guard: don't fire a second PATCH if one is already in flight. In practice LoadingButton
    // disables on re-render, but every other Sales Coach mutation guards explicitly rather than trusting
    // render timing — match that so a fast double-submit can't slip a duplicate end-and-name through.
    if (namingBusy) return;
    setNamingBusy(true);
    setNamingError(null);
    try {
      const res = await fetch(`/api/coach/sales-session/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ended", clientLabel: name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setNamingError(data?.error ?? "Couldn't save the name — try again.");
        return;
      }
      setNamingOpen(false);
      // After-Pitch generates from the labeled transcript; the session is now ended + named.
      router.push(`/dashboard/sales-coach/${id}/after-pitch`);
    } catch {
      setNamingError("Couldn't reach the server — try again.");
    } finally {
      setNamingBusy(false);
    }
  };

  // Step 3 — pre-knock prep. A short briefing from the session's captured
  // offer/approach + the corpus. On-demand, not stored (momentary prep).
  const [prep, setPrep] = useState<{
    hasContent: boolean;
    opening: string;
    likelyObjections: { objection: string; reframe: string }[];
    keyValue: string;
    failed: boolean;
  } | null>(null);
  const [prepping, setPrepping] = useState(false);
  const getPrep = async () => {
    setPrepping(true);
    setError(null);
    try {
      const res = await fetch(`/api/coach/sales-session/${id}/prep`, {
        method: "POST",
      });
      if (res.ok) setPrep((await res.json()).prep);
      else setError(`Couldn't build the prep (HTTP ${res.status}).`);
    } catch {
      setError("Couldn't build the prep.");
    } finally {
      setPrepping(false);
    }
  };

  // Prep Time (build 2) — the rep asks the coach a free-form question before
  // the call (advice, or "what am I selling?"), answered from the product +
  // methodology corpus. §3.3 — on-demand, the rep asked.
  const [prepQuestion, setPrepQuestion] = useState("");
  const [prepAnswer, setPrepAnswer] = useState<{
    answer: string;
    hasAnswer: boolean;
    failed: boolean;
  } | null>(null);
  const [prepQABusy, setPrepQABusy] = useState(false);
  const askCoach = async () => {
    const q = prepQuestion.trim();
    if (q.length < 2) return;
    setPrepQABusy(true);
    setPrepAnswer(null);
    try {
      const res = await fetch(`/api/coach/sales-session/${id}/prep-qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (res.ok) setPrepAnswer((await res.json()).result);
      else setPrepAnswer({ answer: "", hasAnswer: false, failed: true });
    } catch {
      setPrepAnswer({ answer: "", hasAnswer: false, failed: true });
    } finally {
      setPrepQABusy(false);
    }
  };

  // Phase 2 — record the OUTCOME (the downstream consequence, §3.5). Append-
  // only server-side; re-recording is a correction, not a rewrite of history.
  const [savingOutcome, setSavingOutcome] = useState<SalesOutcome | null>(null);
  const [dealDraft, setDealDraft] = useState("");
  const [savingDeal, setSavingDeal] = useState(false);
  // useRef latch (same append-only double-write class as submitWhy/generateReview): /outcome →
  // setSessionOutcome APPENDS an immutable `coach.session_outcome_recorded` §3.1 event per call. setSavingOutcome
  // is useState (disables the button only on the next render), so a fast double-click fires two POSTs → two
  // identical outcome events, skewing any downstream-consequence metric that counts them. recordOutcome is the chokepoint (the
  // outcome buttons AND saveDealValue route through it), so the latch here guards all of them by construction.
  // Released in finally, so a deliberate later re-record (a real correction) still works.
  const outcomeSubmitRef = useRef(false);
  const recordOutcome = async (outcome: SalesOutcome, dealValue?: number | null) => {
    if (outcomeSubmitRef.current) return;
    outcomeSubmitRef.current = true;
    setSavingOutcome(outcome);
    setError(null);
    try {
      const res = await fetch(`/api/coach/sales-session/${id}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome,
          ...(dealValue !== undefined ? { dealValue } : {}),
        }),
      });
      if (res.ok) setSession((await res.json()).session);
      else setError(`Couldn't record the outcome (HTTP ${res.status}).`);
    } catch {
      setError("Couldn't record the outcome.");
    } finally {
      setSavingOutcome(null);
      outcomeSubmitRef.current = false;
    }
  };
  // Deal value — only meaningful on a 'sold' outcome (Layer-1 KPI, 0205).
  const saveDealValue = async () => {
    const trimmed = dealDraft.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      setError("Enter a deal value of 0 or more (numbers only).");
      return;
    }
    setSavingDeal(true);
    await recordOutcome("sold", parsed);
    setSavingDeal(false);
  };

  // Phase 3 — the WHY. §3.3 rep-first: the rep's hypothesis is REQUIRED
  // before the System's read is generated. Both are append-only events.
  const [whyDraft, setWhyDraft] = useState("");
  const [repHypothesis, setRepHypothesis] = useState<string | null>(null);
  const [systemWhy, setSystemWhy] = useState<{
    hasSignal: boolean;
    primaryDriver: string;
    evidence: string[];
    repInputReflection: string;
    alternativeRead: string | null;
    failed: boolean;
  } | null>(null);
  const [whyBusy, setWhyBusy] = useState(false);
  // Accepts an explicit hypothesis so a retry / post-reload regeneration can
  // reuse the already-recorded read (F3) without the draft box being present.
  // useRef latch (NOT just whyBusy/useState + a disabled button): setWhyBusy(true) doesn't take effect
  // synchronously, so a fast double-click — or the programmatic hypothesisArg retry racing a click — can call
  // submitWhy twice before the re-render disables the button. The /why route inserts the rep hypothesis
  // UNCONDITIONALLY (append-only, "always"), so a double-fire writes DUPLICATE immutable events. The ref is
  // checked+set synchronously before the first await; released in finally, so a deliberate re-submit (a new
  // hypothesis, after the first completes) is still allowed. (append-only double-write class.)
  const whySubmitRef = useRef(false);
  const submitWhy = async (hypothesisArg?: string) => {
    const h = (hypothesisArg ?? whyDraft).trim();
    if (h.length < 3) return;
    if (whySubmitRef.current) return;
    whySubmitRef.current = true;
    setWhyBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/coach/sales-session/${id}/why`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hypothesis: h }),
      });
      if (res.ok) {
        const d = await res.json();
        setRepHypothesis(d.repHypothesis);
        setSystemWhy(d.systemWhy);
      } else {
        const b = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(b?.error ?? `Couldn't generate the why (HTTP ${res.status}).`);
      }
    } catch {
      setError("Couldn't generate the why.");
    } finally {
      setWhyBusy(false);
      whySubmitRef.current = false;
    }
  };

  return (
    <>
      <TopBar
        title={session?.clientLabel ?? "Session"}
        subtitle={
          session
            ? `${session.context === "video" ? "Online video" : "In-person"} · ${session.status}`
            : "Live Sales Coach"
        }
      />
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-md mx-auto w-full space-y-5 bg-base">
        <Link
          href="/dashboard/sales-coach"
          className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-primary"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
          Back to sessions
        </Link>

        {/* Auto-generated factual conversation summary (distinct from the
            Dissect evaluation, §A11 — facts, not a verdict). The card renders
            when ANY artifact has signal — summary, timeline, or pivot — each is
            generated independently and best-effort, so a failed summary must NOT
            hide the timeline (the hero) or pivot (audit finding 1, §A14/§1.5). */}
        {(summary || moments.length > 0 || pivot || intel) && (
          <LearningHint
            as="block"
            category="Sales Coach · Review"
            title="Conversation summary"
            whatItIs="A plain factual recap of what was actually said in the call — the facts of the conversation, not a verdict on how you did."
            why="Before you can judge a call you have to remember it accurately. The summary keeps the facts and the evaluation separate on purpose: this section is the neutral record so the growth review's judgement can't quietly rewrite what happened."
            how="Read it to reload the call in your head before you record an outcome or read the growth review. If it doesn't match your memory, trust the transcript below and re-check."
            principle="Keep the facts of a call separate from the verdict on it — an honest record is what a fair review stands on.">
            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <FileText className="w-3.5 h-3.5 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  Conversation summary
                </h2>
              </div>
              {summary && (
                <p className="text-xs text-secondary leading-relaxed whitespace-pre-wrap">
                  {summary}
                </p>
              )}
              {/* Founder 2026-07-07: the Pivot Moment + private scores at the END
                  of the conversation summary — same shared component as the
                  Summarize panel (§A13/§A21). The pivot is manager-visible; the
                  scores are owner-only (the component's /summary-scores fetch
                  returns 403 to a manager and renders nothing, §A18). */}
              <PivotAndScores
                key={id}
                sessionId={id}
                pivot={pivot}
                moments={moments}
                intel={intel}
              />
            </section>
          </LearningHint>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : (
          <>
            {error && <p className="text-xs text-amber-300">{error}</p>}

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Step 3 — pre-knock prep. Expert only: spec p4 removes "Prep me"
                  from Standard's live screen (it is content before the call the
                  founder judged as clutter for door-to-door reps). */}
              {!isStandard && (
              <LearningHint
                as="inline-block"
                category="Sales Coach · Session"
                title="Prep me"
                whatItIs="Generates a short pre-call briefing — an opening line, the objections you're likely to hit with reframes, and the one value point to land — built from this session's captured offer/approach and your past calls."
                why="Reps who knock cold repeat the same fumbles; reps who spend thirty seconds orienting first sound like they belong there. The prep exists to get your head in the call before you're in it — not to hand you a script to read."
                how="Tap it before you knock. Read it, internalize the direction, then close the phone and run the call in your own words. Re-prep if the offer or approach changes."
                principle="A direction to prepare you is worth more than a script to recite — the call is still yours to run.">
                <LoadingButton
                  pending={prepping}
                  onClick={() => void getPrep()}
                  icon={<Lightbulb className="w-3.5 h-3.5" aria-hidden />}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-default text-secondary hover:text-primary disabled:opacity-60"
                >
                  {prep ? "Re-prep" : "Prep me"}
                </LoadingButton>
              </LearningHint>
              )}
              {session?.status === "active" && (
                <LearningHint
                  as="inline-block"
                  category="Sales Coach · Session"
                  title="End session"
                  whatItIs="Marks this live session as ended. It stops the session being 'active' and unlocks the post-call steps — recording the outcome, the why, and the growth review."
                  why="A call that never gets closed out sits half-finished: no outcome logged, no review pulled, no lesson extracted. Ending the session is the gate that turns a live call into something you can learn from."
                  how="Tap it when the conversation is genuinely over. It never interrupts you mid-call — the post-call tools only appear after you've ended, so you're never blocked while the door is still open."
                  principle="Closing the session is what converts a call you had into a call you can improve on.">
                  <button
                    type="button"
                    onClick={openNaming}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-default text-secondary hover:text-primary disabled:opacity-60"
                  >
                    <Square className="w-3 h-3" aria-hidden />
                    End session
                  </button>
                </LearningHint>
              )}
              {/* Generate growth review — Expert only (spec p4). In Standard the
                  review is produced as part of the After-Pitch that comes up when
                  the recording ends, so a separate button is redundant clutter. */}
              {!isStandard && (
              <LearningHint
                as="inline-block"
                category="Sales Coach · Review"
                title="Generate growth review"
                whatItIs="Runs the post-call review engine over this session's transcript and returns an honest read: what you did well first, then the specific opportunities to grow with a concrete next step for each."
                why="The review is where learning actually happens — the honest read of what worked and the one thing to fix next. A session without a review is time logged but the lesson never pulled. It needs a transcript, so it stays disabled until there's one."
                how="Run it after each call. If your reviews lag far behind your sessions, the transcripts exist but no one is extracting the growth. Regenerate if the transcript changed."
                principle="A call you don't review is a call you can only repeat, not improve.">
                <LoadingButton
                  pending={generating}
                  onClick={() => void generateReview()}
                  disabled={transcript.length === 0}
                  icon={<Sparkles className="w-3.5 h-3.5" aria-hidden />}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {review ? "Regenerate growth review" : "Generate growth review"}
                </LoadingButton>
              </LearningHint>
              )}
              {/* After Pitch Summary — the rep's private "between doors" debrief
                  (timeline + private scores + one focus + Start Next Door). L3
                  composition: reachable from the session the moment there's a
                  transcript to summarize. */}
              {transcript.length > 0 && (
                <LearningHint
                  as="inline-block"
                  category="Sales Coach · Review"
                  title="After Pitch Summary"
                  whatItIs="Opens your private between-doors debrief for this call: a timeline of the conversation, private self-scores, one focus to carry forward, and a Start Next Door hand-off."
                  why="Door-to-door improvement is won in the ten seconds between doors, not in a report you read that night. This is the fast private reset that keeps you moving while the last call is still fresh — one focus, not ten."
                  how="Open it right after a door, set your one focus, then hit Start Next Door. Keep it private and honest — the scores are for you, not a manager."
                  principle="Reps improve door by door — a tight debrief between them compounds faster than a long one at the end of the day.">
                  <Link
                    href={`/dashboard/sales-coach/${id}/after-pitch`}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-ember-400/40 text-brand hover:bg-ember-400/10 transition-colors"
                  >
                    <LinkProgress />
                    <Target className="w-3.5 h-3.5" aria-hidden />
                    After Pitch Summary
                  </Link>
                </LearningHint>
              )}
            </div>

            {/* Step 3 — pre-knock prep card. §3.3: prepares the rep (opening +
                likely objections + key value), does not script them. Expert only —
                its trigger (Prep me) is gated above; explicit guard for clarity. */}
            {!isStandard && prep &&
              (prep.hasContent ? (
                <LearningHint
                  as="block"
                  category="Sales Coach · Session"
                  title="Before you knock"
                  whatItIs="Your pre-call briefing: an opening to lead with, the objections you're likely to face with a reframe for each, and the one value point to make sure you land."
                  why="Walking in cold is how good reps still lose easy calls — not from bad delivery, from not deciding beforehand how they'd open or answer the obvious pushback. This gives you a direction to prepare against so the call isn't the first time you think about it."
                  how="Read the three parts, then close it and run the call in your own voice. Treat 'If they say…' as sparring practice, not a script — you'll rarely hear the objection worded exactly this way."
                  principle="Prepare a direction, don't memorize a script — the reframe that works is the one that sounds like you.">
                  <section className="rounded-2xl border border-ember-400/25 bg-ember-400/[0.04] shadow-[0_0_34px_-12px_rgba(250,204,21,0.4)] p-4 space-y-3">
                  <div className="flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-brand" aria-hidden />
                    <h2 className="text-sm font-semibold text-primary">
                      Before you knock
                    </h2>
                  </div>
                  {prep.opening && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1">
                        Open with
                      </p>
                      <p className="text-xs text-secondary leading-relaxed">
                        {prep.opening}
                      </p>
                    </div>
                  )}
                  {prep.likelyObjections.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1">
                        If they say…
                      </p>
                      <ul className="space-y-1.5">
                        {prep.likelyObjections.map((o, i) => (
                          <li key={i} className="text-xs text-secondary leading-relaxed">
                            <span className="text-primary">“{o.objection}”</span> — {o.reframe}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {prep.keyValue && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1">
                        Land this
                      </p>
                      <p className="text-xs text-secondary leading-relaxed">
                        {prep.keyValue}
                      </p>
                    </div>
                  )}
                  <p className="text-[10px] text-muted pt-1 border-t border-default">
                    A direction to prepare you — not a script. The call is yours.
                  </p>
                  </section>
                </LearningHint>
              ) : prep.failed ? (
                <p className="text-xs text-amber-300">
                  Couldn&apos;t build the prep right now — try again in a moment.
                </p>
              ) : (
                <p className="text-xs text-muted">
                  Not enough to prep from yet — add an offer when you start the
                  session for a sharper briefing.
                </p>
              ))}

            {/* Prep Time (build 2) — ask the coach before the call. §3.3 —
                on-demand help; the rep asked. Grounded in the product details
                (Settings) + methodology; §3.4 — no invented product facts. */}
            {session && (
              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-brand" aria-hidden />
                  <h2 className="text-sm font-semibold text-primary">
                    Ask the coach
                  </h2>
                </div>
                {/* Spec p4.2: Standard reframes the prompt from "ask for advice or
                    the details of what you're selling" to the rep's own words —
                    "What are you struggling on?" — which invites the real blocker
                    instead of a product-info query. Expert keeps its original copy. */}
                <p className="text-xs text-secondary leading-relaxed">
                  {isStandard
                    ? "What are you struggling on?"
                    : "Ask for advice or the details of what you’re selling."}
                </p>
                <div className="flex items-center gap-2">
                  <LearningHint
                    as="block"
                    category="Sales Coach · Session"
                    title="Your question"
                    whatItIs="The input where you type what you want to ask the coach. Enter submits it; the answer appears below."
                    why="A vague question gets a vague answer. Naming the exact thing you're stuck on — this offer, this objection — is what makes the grounded answer useful instead of generic."
                    how="Be specific: 'how do I reframe it costs too much for a homeowner?' beats 'sales tips'. Press Enter to send."
                    principle="The sharper the question, the more usable the answer.">
                    <input
                      type="text"
                      value={prepQuestion}
                      onChange={(e) => setPrepQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void askCoach();
                      }}
                      placeholder="e.g. What am I selling? How do I handle a price objection?"
                      className="flex-1 min-w-0 text-xs bg-base border border-default rounded-lg px-3 py-2 text-primary placeholder:text-muted focus:outline-none focus:border-strong"
                    />
                  </LearningHint>
                  <LearningHint
                    as="inline-block"
                    category="Sales Coach · Session"
                    title="Ask"
                    whatItIs="Sends your question to the coach and returns an answer drawn from your product details and the methodology."
                    why="Stays disabled until you've typed something real, so you can't fire off an empty question. The answer is advice grounded in facts, not a script to read — you still decide what to do with it."
                    how="Tap it once your question is written. If nothing useful comes back, rephrase more specifically and ask again."
                    principle="Grounded advice you can accept or reject keeps the call yours — the coach guides, you decide.">
                    <LoadingButton
                      pending={prepQABusy}
                      onClick={() => void askCoach()}
                      disabled={prepQuestion.trim().length < 2}
                      icon={<HelpCircle className="w-3.5 h-3.5" aria-hidden />}
                      className="inline-flex items-center gap-1.5 shrink-0 text-xs font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-50 px-3 py-2 rounded-lg transition-colors"
                    >
                      Ask
                    </LoadingButton>
                  </LearningHint>
                </div>
                {prepAnswer &&
                  (prepAnswer.failed ? (
                    <p className="text-[11px] text-amber-300 pt-1 border-t border-default">
                      Couldn&apos;t answer right now — try again in a moment.
                    </p>
                  ) : prepAnswer.hasAnswer ? (
                    <p className="text-xs text-secondary leading-relaxed whitespace-pre-wrap pt-2 border-t border-default">
                      {prepAnswer.answer}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted pt-1 border-t border-default">
                      No answer came back — try rephrasing.
                    </p>
                  ))}
              </section>
            )}

            {/* Phase 2 — outcome + captured details. §1.5.1 L3: once the call
                has ended, recording what happened is the natural next step
                (shown only post-call, never blocking Stop). §3.5: the outcome
                is the consequence the coach measures against — not agreement.
                Expert only: in Standard the outcome is captured on the After-Pitch
                that comes up on end (§3.5 preserved there, not dropped). */}
            {!isStandard && session && session.status !== "active" && (
              <LearningHint
                as="block"
                category="Sales Coach · Outcome"
                title="Call outcome"
                whatItIs="Where you record what actually happened on the call — booked, follow-up, not interested, and so on. Recording is append-only: re-selecting logs a correction, it never erases the earlier read."
                why="This is the single most important thing you can log. The coach measures itself against real results, not against whether its advice sounded good — and it can only do that if you tell it what happened. An unlogged outcome is a call the system can't learn from."
                how="Tap the result the moment the call is over, while it's honest and fresh. Don't skip the ones that stung — the losses are exactly the data that makes the coaching sharper. It only appears after the session ends, so it never blocks you mid-call."
                principle="Log the consequence, not the compliment — what actually works only shows up when you record what actually happened.">
              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4 space-y-3">
                <h2 className="text-sm font-semibold text-primary">Call outcome</h2>
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
                {/* Deal value — only on a 'sold' outcome (Layer-1 KPI, 0205). Optional. */}
                {session.outcome === "sold" && (
                  <div className="flex items-end gap-2 pt-1">
                    <div className="flex-1 min-w-0 max-w-[12rem]">
                      <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
                        Deal value (optional)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={dealDraft}
                        onChange={(e) => setDealDraft(e.target.value)}
                        placeholder={session.dealValue != null ? String(session.dealValue) : "e.g. 2500"}
                        className="w-full bg-base border border-default rounded-md px-2.5 py-1.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void saveDealValue()}
                      disabled={savingDeal}
                      className="text-xs font-semibold text-brand border border-ember-400/40 hover:border-ember-400/70 bg-ember-400/5 px-3 py-1.5 rounded-md disabled:opacity-50"
                    >
                      {savingDeal ? "Saving…" : "Save value"}
                    </button>
                    {session.dealValue != null && (
                      <span className="text-[11px] text-emerald-300 mb-1.5">
                        Recorded: {session.dealValue.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
                {session.outcome === null && (
                  <p className="text-[11px] text-muted">
                    Not recorded yet — logging the result is what lets your coach
                    measure what actually works, not just what sounded good.
                  </p>
                )}
                {(session.territory || session.approach || session.offer) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted pt-2 border-t border-default">
                    {session.territory && (
                      <span>
                        Where: <span className="text-secondary">{session.territory}</span>
                      </span>
                    )}
                    {session.approach && (
                      <span>
                        How: <span className="text-secondary">{session.approach}</span>
                      </span>
                    )}
                    {session.offer && (
                      <span>
                        What: <span className="text-secondary">{session.offer}</span>
                      </span>
                    )}
                  </div>
                )}
              </section>
              </LearningHint>
            )}

            {/* Expert only — the rep-first WHY dialogue is depth the Standard flow
                trades away for momentum (the After-Pitch read carries the lesson). */}
            {/* Phase 3 — the WHY. §3.3: the rep goes FIRST; the coach's read
                is gated behind the rep's and builds on it. Gated on a recorded
                outcome (§3.2/§3.5 — no consequence, no why). */}
            {!isStandard && session && session.outcome && (
              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4 space-y-3">
                <div className="flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-brand" aria-hidden />
                  <h2 className="text-sm font-semibold text-primary">
                    Why this outcome?
                  </h2>
                </div>

                {repHypothesis ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1">
                      Your read
                    </p>
                    <p className="text-xs text-secondary leading-relaxed">
                      {repHypothesis}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-secondary leading-relaxed">
                      Before the coach weighs in — what do{" "}
                      <span className="text-primary">you</span> think drove this
                      outcome?
                    </p>
                    <textarea
                      value={whyDraft}
                      onChange={(e) => setWhyDraft(e.target.value)}
                      placeholder="Your honest read — even a hunch."
                      rows={2}
                      className="w-full text-xs bg-base border border-default rounded-lg px-3 py-2 text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-none"
                    />
                    <LoadingButton
                      pending={whyBusy}
                      onClick={() => void submitWhy()}
                      disabled={whyDraft.trim().length < 3}
                      icon={<HelpCircle className="w-3.5 h-3.5" aria-hidden />}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Get the coach&apos;s read
                    </LoadingButton>
                  </div>
                )}

                {systemWhy &&
                  (systemWhy.hasSignal ? (
                    <div className="pt-2 border-t border-default space-y-2">
                      <p className="text-[10px] uppercase tracking-widest text-brand font-bold">
                        The coach&apos;s read — a hypothesis
                      </p>
                      <p className="text-xs text-primary leading-relaxed">
                        {systemWhy.primaryDriver}
                      </p>
                      {systemWhy.repInputReflection && (
                        <p className="text-[11px] text-secondary italic leading-relaxed">
                          {systemWhy.repInputReflection}
                        </p>
                      )}
                      {systemWhy.evidence.length > 0 && (
                        <ul className="space-y-1">
                          {systemWhy.evidence.map((e, i) => (
                            <li key={i} className="text-[11px] text-muted leading-relaxed">
                              — {e}
                            </li>
                          ))}
                        </ul>
                      )}
                      {systemWhy.alternativeRead && (
                        <p className="text-[11px] text-secondary leading-relaxed">
                          Or possibly: {systemWhy.alternativeRead}
                        </p>
                      )}
                      <p className="text-[10px] text-muted pt-1">
                        A hypothesis from one call — not a verdict. What actually
                        holds shows up across your sessions over time.
                      </p>
                    </div>
                  ) : systemWhy.failed ? (
                    <div className="pt-2 border-t border-default space-y-2">
                      <p className="text-[11px] text-amber-300">
                        Couldn&apos;t generate the coach&apos;s read right now.
                      </p>
                      <LoadingButton
                        pending={whyBusy}
                        onClick={() => void submitWhy(repHypothesis ?? undefined)}
                        icon={<HelpCircle className="w-3.5 h-3.5" aria-hidden />}
                        className="inline-flex items-center gap-1.5 text-xs border border-default text-secondary hover:text-primary disabled:opacity-50 px-3 py-1.5 rounded-lg"
                      >
                        Try again
                      </LoadingButton>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted pt-2 border-t border-default">
                      Not enough in the transcript to read a cause honestly —
                      your own read above is the record.
                    </p>
                  ))}

                {/* Regenerate: a recorded read but no coach read yet (e.g. a
                    reload after a failed/thin generation that wasn't stored). */}
                {repHypothesis && !systemWhy && (
                  <div className="pt-2 border-t border-default">
                    <LoadingButton
                      pending={whyBusy}
                      onClick={() => void submitWhy(repHypothesis)}
                      icon={<HelpCircle className="w-3.5 h-3.5" aria-hidden />}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-50 px-3 py-1.5 rounded-lg"
                    >
                      Get the coach&apos;s read
                    </LoadingButton>
                  </div>
                )}
              </section>
            )}

            {/* Review (strengths first — the tone law). Expert only: in Standard the
                same read is delivered on the After-Pitch ("what you did well" /
                "opportunities to grow"), so a second copy here is redundant. */}
            {!isStandard && review?.hasSignal && (
              <section className="rounded-2xl border border-ember-400/25 bg-ember-400/[0.04] shadow-[0_0_34px_-12px_rgba(250,204,21,0.4)] p-4 space-y-4">
                <h2 className="text-sm font-semibold text-primary">
                  Your growth review
                </h2>
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden />
                    <h3 className="text-xs uppercase tracking-widest font-bold text-emerald-300">
                      What you did well
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {review.strengths.map((s, i) => (
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
                {review.growthAreas.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-400" aria-hidden />
                      <h3 className="text-xs uppercase tracking-widest font-bold text-amber-300">
                        Opportunities to grow
                      </h3>
                    </div>
                    <ul className="space-y-2">
                      {review.growthAreas.map((g, i) => (
                        <li key={i} className="text-xs text-secondary leading-relaxed">
                          <span className="text-primary font-medium">
                            {g.opportunity}
                          </span>
                          <span className="block text-[11px] text-brand mt-0.5">
                            Next step: {g.nextStep}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {review.closing && (
                  <p className="text-xs text-secondary italic border-t border-default pt-3">
                    {review.closing}
                  </p>
                )}
              </section>
            )}
            {review && !review.hasSignal && (
              <p className="text-xs text-muted">
                Not enough of the conversation yet to write an honest review.
              </p>
            )}

            {/* S1b — live coaching during the call. context drives attribution:
                video is mic-only (agent), in-person splits both voices. */}
            <LiveCoachingPanel
              key={id}
              sessionId={id}
              context={session?.context}
              // Founder 2026-07-31 (urgent): the moment the live recording's transcript is saved, the
              // After-Pitch must show up. Founder 2026-08-01 (Phase 4): finishing REQUIRES naming — so this
              // opens the required naming gate; submitting it ends the session (populating duration + KPI)
              // AND names it, then lands on After-Pitch. Live-coaching twin of the upload path's onLabeled.
              onRecordingSaved={openNaming}
              // Gate the "not recording" banner to active sessions so it can't
              // misfire on an already-ended one (founder 2026-07-26 fix).
              active={session?.status === "active"}
            />

            {/* S1a — upload a recording / phone voice memo → diarize → one-tap label. Founder 2026-08-11:
                available in BOTH modes now ("upload on every session, and even after") — this REVERSES the
                earlier Standard p4/p5 removal ("door-to-door people won't use this"). The door-to-door rep
                who recorded the call on their phone (iPhone Voice Memos / Android) can bring it in right here.
                Founder 2026-07-31/08-01: on label-complete we open the required naming gate → ends the session
                (duration + KPI populate) + names it → lands on After-Pitch. */}
            <SessionRecordingUpload
              sessionId={id}
              onLabeled={openNaming}
              // Recovery: the recording saved but the transcript never landed (STT
              // outage). Offer re-transcribe-from-storage only when a transcript
              // does NOT already exist — re-labeling would append a duplicate.
              hasSavedRecording={
                !!session?.audioAssetUrl && transcript.length === 0
              }
            />

            {/* Coach tools + the raw transcript wall stay Expert only (spec p7: a Standard
                door-to-door rep relives the call from the After-Pitch summary + timeline, not the
                raw transcript). The upload above is the one thing lifted out to both modes. */}
            {!isStandard && (
              <>
            {/* Coach tools on this session: Summarize, Ask coach, Dissect.
                Spawn task + Decision dialogue removed here (founder 2026-07-03).
                key={id} forces a fresh mount when the rep switches sessions — otherwise React preserves the
                component's per-session state (summary/moments/error) across the params-only [id] change, and
                the sessionId-effect refetches WITHOUT resetting it → the previous session's summary shows
                during the refetch (and persists if it fails). Context-switch state-bleed guard. */}
            <SessionCoachTools key={id} sessionId={id} />

            {/* Transcript */}
            <section>
              <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-3">
                Transcript
              </h2>
              {transcript.length === 0 ? (
                <p className="text-xs text-muted py-4">
                  No transcript yet. Once live capture is set up (or a transcript
                  is fed to this session), it appears here.
                </p>
              ) : (
                <div className="space-y-2">
                  {transcript.map((seg) => (
                    <div
                      key={seg.id}
                      className={`text-xs leading-relaxed rounded-lg px-3 py-2 border ${
                        seg.speaker === "agent"
                          ? "border-ember-400/20 bg-ember-400/[0.03]"
                          : seg.speaker === "customer"
                            ? "border-default bg-white/[0.02]"
                            : "border-default bg-transparent"
                      }`}
                    >
                      <span className="text-[10px] uppercase tracking-widest font-bold text-muted">
                        {seg.speaker}
                      </span>
                      <p className="text-secondary mt-0.5">{seg.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
              </>
            )}
          </>
        )}
      </div>

      {/* Phase 4 (founder 2026-08-01): REQUIRED session-naming gate. Shown on any finish (manual End or
          recording-complete). No X, no backdrop-close, Save disabled until non-empty — the rep MUST name the
          session before it ends and the After-Pitch opens, so every session is findable in Sessions and its
          duration/KPI are attributable to a named call. */}
      {namingOpen && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-base border border-default rounded-xl shadow-2xl w-full max-w-md p-5">
            <h2 className="text-sm font-semibold text-primary">Name this session</h2>
            <p className="text-[11px] text-muted mt-1 leading-relaxed">
              Give this call a name before your After-Pitch review — so you can find it again in Sessions
              (the customer, the door, or the deal).
            </p>
            <input
              type="text"
              autoFocus
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && sessionName.trim() && !namingBusy) void submitNameAndFinish();
              }}
              maxLength={120}
              placeholder="e.g. 123 Oak St — solar quote"
              className="w-full mt-3 bg-surface border border-default rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong"
            />
            {namingError && (
              <p role="alert" className="text-xs text-amber-300 mt-2">
                {namingError}
              </p>
            )}
            <div className="flex justify-end mt-4">
              <LoadingButton
                pending={namingBusy}
                disabled={!sessionName.trim()}
                pendingLabel="Saving…"
                onClick={() => void submitNameAndFinish()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-40 px-4 py-2 rounded-lg transition-colors"
              >
                Save &amp; continue
              </LoadingButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
