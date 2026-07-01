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
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { SessionCoachTools } from "@/components/sales-coach/SessionCoachTools";
import { SessionRecordingUpload } from "@/components/sales-coach/SessionRecordingUpload";
import { LiveCoachingPanel } from "@/components/sales-coach/LiveCoachingPanel";

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
type SalesOutcome =
  | "sold"
  | "follow_up"
  | "no_sale"
  | "no_contact"
  | "undecided";
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

// Human labels — kept in sync with SALES_OUTCOMES (salesCoach.ts).
const OUTCOME_LABELS: Record<SalesOutcome, string> = {
  sold: "Sold",
  follow_up: "Follow-up",
  no_sale: "No sale",
  no_contact: "No contact",
  undecided: "Undecided",
};
const OUTCOME_ORDER: SalesOutcome[] = [
  "sold",
  "follow_up",
  "no_sale",
  "no_contact",
  "undecided",
];
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
      const [sRes, rRes, sumRes] = await Promise.all([
        fetch(`/api/coach/sales-session/${id}`).catch(() => null),
        fetch(`/api/coach/sales-session/review?sessionId=${id}`).catch(() => null),
        fetch(`/api/coach/sales-session/${id}/summarize`).catch(() => null),
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
