"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { SessionCoachTools } from "@/components/sales-coach/SessionCoachTools";
import { SessionRecordingUpload } from "@/components/sales-coach/SessionRecordingUpload";
import { LiveCoachingPanel } from "@/components/sales-coach/LiveCoachingPanel";
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
  const [session, setSession] = useState<Session | null>(null);
  const [transcript, setTranscript] = useState<Segment[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [sRes, rRes, sumRes, wRes] = await Promise.all([
        fetch(`/api/coach/sales-session/${id}`).catch(() => null),
        fetch(`/api/coach/sales-session/review?sessionId=${id}`).catch(() => null),
        fetch(`/api/coach/sales-session/${id}/summarize`).catch(() => null),
        fetch(`/api/coach/sales-session/${id}/why`).catch(() => null),
      ]);
      if (sRes && sRes.ok) {
        const d = await sRes.json();
        setSession(d.session);
        setTranscript(d.transcript ?? []);
      } else {
        setError("Couldn't load the session.");
      }
      if (rRes && rRes.ok) setReview((await rRes.json()).review);
      if (sumRes && sumRes.ok) setSummary((await sumRes.json()).summary ?? null);
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

  const generateReview = async () => {
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
    }
  };

  const endSession = async () => {
    setEnding(true);
    try {
      const res = await fetch(`/api/coach/sales-session/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ended" }),
      });
      if (res.ok) setSession((await res.json()).session);
    } finally {
      setEnding(false);
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
  const recordOutcome = async (outcome: SalesOutcome) => {
    setSavingOutcome(outcome);
    setError(null);
    try {
      const res = await fetch(`/api/coach/sales-session/${id}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      if (res.ok) setSession((await res.json()).session);
      else setError(`Couldn't record the outcome (HTTP ${res.status}).`);
    } catch {
      setError("Couldn't record the outcome.");
    } finally {
      setSavingOutcome(null);
    }
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
  const submitWhy = async (hypothesisArg?: string) => {
    const h = (hypothesisArg ?? whyDraft).trim();
    if (h.length < 3) return;
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
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-3xl mx-auto w-full space-y-6">
        <Link
          href="/dashboard/sales-coach"
          className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-primary"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
          Back to sessions
        </Link>

        {/* Auto-generated factual conversation summary (distinct from the
            Dissect evaluation, §A11 — facts, not a verdict). */}
        {summary && (
          <section className="rounded-xl border border-default bg-white/[0.01] p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <FileText className="w-3.5 h-3.5 text-brand" aria-hidden />
              <h2 className="text-sm font-semibold text-primary">
                Conversation summary
              </h2>
            </div>
            <p className="text-xs text-secondary leading-relaxed whitespace-pre-wrap">
              {summary}
            </p>
          </section>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : (
          <>
            {error && <p className="text-xs text-red-300">{error}</p>}

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Step 3 — pre-knock prep: prepare BEFORE the conversation. */}
              <button
                type="button"
                onClick={() => void getPrep()}
                disabled={prepping}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-default text-secondary hover:text-primary disabled:opacity-60"
              >
                {prepping ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                ) : (
                  <Lightbulb className="w-3.5 h-3.5" aria-hidden />
                )}
                {prep ? "Re-prep" : "Prep me before you knock"}
              </button>
              {session?.status === "active" && (
                <button
                  type="button"
                  onClick={() => void endSession()}
                  disabled={ending}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-default text-secondary hover:text-primary disabled:opacity-60"
                >
                  <Square className="w-3 h-3" aria-hidden />
                  End session
                </button>
              )}
              <button
                type="button"
                onClick={() => void generateReview()}
                disabled={generating || transcript.length === 0}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                {generating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" aria-hidden />
                )}
                {review ? "Regenerate growth review" : "Generate growth review"}
              </button>
            </div>

            {/* Step 3 — pre-knock prep card. §3.3: prepares the rep (opening +
                likely objections + key value), does not script them. */}
            {prep &&
              (prep.hasContent ? (
                <section className="rounded-xl border border-ember-400/30 bg-ember-400/[0.04] p-4 space-y-3">
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
              <section className="rounded-xl border border-default bg-white/[0.01] p-4 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-brand" aria-hidden />
                  <h2 className="text-sm font-semibold text-primary">
                    Ask the coach
                  </h2>
                </div>
                <p className="text-xs text-secondary leading-relaxed">
                  Before you go — ask for advice or the details of what
                  you&apos;re selling.
                </p>
                <div className="flex items-center gap-2">
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
                  <button
                    type="button"
                    onClick={() => void askCoach()}
                    disabled={prepQABusy || prepQuestion.trim().length < 2}
                    className="inline-flex items-center gap-1.5 shrink-0 text-xs font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-50 px-3 py-2 rounded-lg transition-colors"
                  >
                    {prepQABusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                    ) : (
                      <HelpCircle className="w-3.5 h-3.5" aria-hidden />
                    )}
                    Ask
                  </button>
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
                is the consequence the coach measures against — not agreement. */}
            {session && session.status !== "active" && (
              <section className="rounded-xl border border-default bg-white/[0.01] p-4 space-y-3">
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
            )}

            {/* Phase 3 — the WHY. §3.3: the rep goes FIRST; the coach's read
                is gated behind the rep's and builds on it. Gated on a recorded
                outcome (§3.2/§3.5 — no consequence, no why). */}
            {session && session.outcome && (
              <section className="rounded-xl border border-default bg-white/[0.01] p-4 space-y-3">
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
                    <button
                      type="button"
                      onClick={() => void submitWhy()}
                      disabled={whyBusy || whyDraft.trim().length < 3}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {whyBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                      ) : (
                        <HelpCircle className="w-3.5 h-3.5" aria-hidden />
                      )}
                      Get the coach&apos;s read
                    </button>
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
                      <button
                        type="button"
                        onClick={() => void submitWhy(repHypothesis ?? undefined)}
                        disabled={whyBusy}
                        className="inline-flex items-center gap-1.5 text-xs border border-default text-secondary hover:text-primary disabled:opacity-50 px-3 py-1.5 rounded-lg"
                      >
                        {whyBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                        ) : (
                          <HelpCircle className="w-3.5 h-3.5" aria-hidden />
                        )}
                        Try again
                      </button>
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
                    <button
                      type="button"
                      onClick={() => void submitWhy(repHypothesis)}
                      disabled={whyBusy}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-50 px-3 py-1.5 rounded-lg"
                    >
                      {whyBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                      ) : (
                        <HelpCircle className="w-3.5 h-3.5" aria-hidden />
                      )}
                      Get the coach&apos;s read
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* Review (strengths first — the tone law) */}
            {review?.hasSignal && (
              <section className="rounded-xl border border-ember-400/30 bg-ember-400/[0.04] p-4 space-y-4">
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

            {/* S1b — live coaching during the call */}
            <LiveCoachingPanel sessionId={id} onRecordingSaved={() => void load()} />

            {/* S1a — upload a recording → diarize → one-tap label */}
            <SessionRecordingUpload sessionId={id} onLabeled={() => void load()} />

            {/* The four C.A.R.E features on this session */}
            <SessionCoachTools
              sessionId={id}
              segments={transcript.map((s) => ({
                speaker: s.speaker,
                text: s.text,
              }))}
            />

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
      </div>
    </>
  );
}
