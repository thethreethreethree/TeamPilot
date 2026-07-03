"use client";

import { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
import { DeckCard } from "@/components/sales-coach/ui/deck";
import { LearningHint } from "@/components/learning/LearningHint";

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

type MomentKind =
  | "opener"
  | "discovery"
  | "objection"
  | "breakdown"
  | "close"
  | "other";
type Correction = { correctLine: string; whyItWorks: string };
type Moment = {
  atSeq: number;
  timestampLabel: string | null;
  kind: MomentKind;
  label: string;
  customerLine: string | null;
  repLine: string | null;
  note: string | null;
  isBreakdown: boolean;
  correction: Correction | null;
};
type ScoreCategory = {
  key: string;
  label: string;
  score: number;
  display: string;
  rationale: string;
  citation: string | null;
  computed: boolean;
};
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
  territory: string | null;
  approach: string | null;
  offer: string | null;
  startedAt?: string;
  endedAt?: string | null;
};

/** Conversation length for the header ("2m 43s"). Null until the call has
 *  ended (start + end both known) — no fabricated duration (§3.4). */
function durationLabel(start?: string, end?: string | null): string | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const total = Math.round(ms / 1000);
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
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/coach/sales-session/${id}/after-pitch`, {
        method: "POST",
      });
      if (res.status === 403) {
        setError("This summary is private to the rep who ran the call.");
        return;
      }
      if (!res.ok) {
        setError(`Couldn't build the summary (HTTP ${res.status}).`);
        return;
      }
      const d = await res.json();
      setSummary(d.summary);
      setIsOwner(d.isOwner ?? true);
    } catch {
      setError("Couldn't build the summary.");
    } finally {
      setGenerating(false);
    }
  }, [id]);

  const load = useCallback(async () => {
    try {
      const [sRes, apRes, sumRes] = await Promise.all([
        fetch(`/api/coach/sales-session/${id}`).catch(() => null),
        fetch(`/api/coach/sales-session/${id}/after-pitch`).catch(() => null),
        fetch(`/api/coach/sales-session/${id}/summarize`).catch(() => null),
      ]);
      if (sRes && sRes.ok) setSession((await sRes.json()).session);
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
      // (assembler returns hasSignal:false).
      if (!existing) void generate();
    } catch {
      setLoading(false);
    }
  }, [id, generate]);

  useEffect(() => {
    void load();
  }, [load]);

  const startNextDoor = async () => {
    if (!session) return;
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
      setStarting(false);
    }
  };

  const ctxLabel = session
    ? session.context === "video"
      ? "Online video"
      : "In-person"
    : "";
  const dur = durationLabel(session?.startedAt, session?.endedAt);

  return (
    <div className="min-h-screen bg-base">
      <div className="mx-auto w-full max-w-md px-4 py-6 space-y-5">
        {/* Header */}
        <div className="space-y-2">
          <Link
            href={`/dashboard/sales-coach/${id}`}
            className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-primary"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
            Back to session
          </Link>
          <div className="text-center pt-1">
            <h1 className="text-lg font-bold text-primary">After Pitch Summary</h1>
            <p className="text-[11px] text-muted mt-0.5">
              Your breakdown + one thing for the next door
            </p>
            {session && (
              <p className="text-[11px] text-brand mt-1">
                {session.clientLabel ?? "Session"} · {ctxLabel}
                {dur ? ` · ${dur}` : ""}
              </p>
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
            <p className="text-xs text-amber-200">{error}</p>
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
            <p className="text-xs text-muted">
              Not enough of the conversation yet to write an honest summary.
              Capture or upload the call, then check back.
            </p>
            <button
              type="button"
              onClick={() => void generate()}
              className="text-xs font-semibold text-[#09090B] bg-gradient-to-br from-ember-300 via-ember-400 to-ember-500 hover:shadow-[0_0_26px_-6px_rgba(250,204,21,0.65)] px-3 py-1.5 rounded-lg transition-colors"
            >
              Rebuild summary
            </button>
          </div>
        ) : (
          <>
            <Timeline moments={summary.moments} />
            {whatHappened && (
              <LearningHint
                as="block"
                category="Sales Coach · After Pitch"
                title="What happened"
                whatItIs="A neutral, factual replay of the conversation — what was actually said, without judgement."
                why="Before you can learn from a call you have to see it as it happened, not as you remember it. Memory edits under pressure; the transcript doesn't."
                how="Read this first to re-ground yourself in the real call, then let the breakdown and scores below tell you what to do about it."
                principle="You can only improve the call you actually see, not the one you wish you'd had."
              >
                <DeckCard className="p-4">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <FileText className="w-3.5 h-3.5 text-brand" aria-hidden />
                    <h2 className="text-sm font-semibold text-primary">
                      What happened
                    </h2>
                  </div>
                  <p className="text-xs text-secondary leading-relaxed whitespace-pre-wrap">
                    {whatHappened}
                  </p>
                </DeckCard>
              </LearningHint>
            )}
            <BreakdownBlock moments={summary.moments} />
            <Narrative narrative={summary.narrative} />
            <Scoreboard scores={summary.scores} />
            <CueLoop entries={summary.cueLoop} />
            <FocusCard focus={summary.focus} />
          </>
        )}

        {/* Continuity. The REP gets one-tap Start Next Door (AMD-006 L3). A
            MANAGER is viewing to coach — no next door for them; scores are the
            rep's private self-assessment and aren't shown to managers (A18). */}
        {!loading && (
          <div className="space-y-2 pt-1">
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
                <button
                  type="button"
                  onClick={() => void startNextDoor()}
                  disabled={starting || !session}
                  className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-[#09090B] bg-gradient-to-br from-ember-300 via-ember-400 to-ember-500 hover:shadow-[0_0_26px_-6px_rgba(250,204,21,0.65)] disabled:opacity-50 px-4 py-3 rounded-xl transition-colors"
                >
                  {starting ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  ) : (
                    <ChevronRight className="w-4 h-4" aria-hidden />
                  )}
                  Start Next Door
                </button>
              </LearningHint>
            ) : (
              summary?.hasSignal && (
                <p className="text-[10px] text-muted text-center px-4">
                  Manager view — for coaching this rep&apos;s growth. Their
                  self-assessment scores stay private to them.
                </p>
              )
            )}
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
                {isOwner ? "Replay conversation" : "Back to session"}
              </Link>
            </LearningHint>
          </div>
        )}
      </div>
    </div>
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
      whatItIs="The shape of the whole call at a glance — each dot is a moment (opener, discovery, objection, close). The burnt-amber dot with a ring is where the call broke down."
      why="Sales calls turn on a few pivotal moments, not every sentence. Seeing the arc lets you find the moment that mattered instead of re-litigating the whole conversation."
      how="Scan left to right for the ringed amber dot — that's the breakdown detailed just below. The timestamps orient you to when each moment happened."
      principle="Every call has a hinge moment; find it and you find where to improve."
    >
      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4">
        <div className="flex items-start gap-3 overflow-x-auto pb-1">
          {moments.map((m, i) => (
          <div key={i} className="flex-1 min-w-[64px] text-center">
            <div className="relative flex items-center justify-center h-3 mb-2">
              {/* connector */}
              {i > 0 && (
                <span className="absolute right-1/2 top-1/2 h-px w-full -translate-y-1/2 bg-default" />
              )}
              <span
                className={`relative z-10 w-3 h-3 rounded-full ${
                  m.isBreakdown
                    ? "bg-ember-800 ring-2 ring-ember-500/50"
                    : "bg-ember-400"
                }`}
              />
            </div>
            {m.timestampLabel && (
              <p className="text-[11px] font-bold text-primary">
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
      whatItIs="The single moment the call turned against you — the customer line, your response, and why it lost momentum."
      why="One clear breakdown you can name and fix beats a vague sense the call 'went badly.' Naming the exact moment is what makes it coachable."
      how="Read what the customer said and what you said, then compare against the correction card below to see the version that lands better."
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
      <div className="bg-ember-800/[0.08] p-4 space-y-3">
        {b.note && <p className="text-xs text-secondary leading-relaxed">{b.note}</p>}
        {(b.customerLine || b.repLine) && (
          <div className="space-y-1 text-[11px]">
            {b.customerLine && (
              <p className="text-muted">
                Customer: <span className="text-secondary italic">“{b.customerLine}”</span>
              </p>
            )}
            {b.repLine && (
              <p className="text-muted">
                You: <span className="text-secondary italic">“{b.repLine}”</span>
              </p>
            )}
          </div>
        )}
        {b.correction && (
            <div className="rounded-lg border border-ember-400/40 bg-ember-400/[0.06] p-3 space-y-1.5">
              <p className="text-[10px] uppercase tracking-widest text-brand font-bold">
                What lands better
              </p>
              <p className="text-xs text-primary leading-relaxed">
                “{b.correction.correctLine}”
              </p>
              <p className="text-[11px] text-secondary leading-relaxed">
                {b.correction.whyItWorks}
              </p>
            </div>
        )}
        </div>
      </section>
    </LearningHint>
  );
}

/* ─── Narrative (reused growth review — tone law: strengths first) ─ */
function Narrative({ narrative }: { narrative: Summary["narrative"] }) {
  if (!narrative.hasSignal) return null;
  return (
      <section className="rounded-2xl border border-ember-400/25 bg-ember-400/[0.04] shadow-[0_0_34px_-12px_rgba(250,204,21,0.4)] p-4 space-y-3">
        <h2 className="text-sm font-semibold text-primary">Your read</h2>
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
      </section>
  );
}

/* ─── Private scoreboard (self-assessment, evidenced — A11/A18) ──── */
function Scoreboard({ scores }: { scores: ScoreCategory[] }) {
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
          whatItIs="The five dimensions of the call scored at a glance — each cell is one aspect of how the conversation went."
          why="A single overall number hides where you actually stand. Breaking it into dimensions tells you which specific skill to work, not just 'do better.'"
          how="Scan for your lowest cell, then read its rationale below to see exactly what pulled it down."
          principle="One overall score tells you how you feel; the dimensions tell you what to change."
        >
        <div className="grid grid-cols-5 gap-1.5">
          {scores.map((c) => (
          <div
            key={c.key}
            className="rounded-lg border border-default bg-surface/40 p-2 text-center"
          >
            <p className="text-[9px] uppercase tracking-wide text-muted font-bold leading-tight">
              {c.label}
            </p>
            <p className="text-sm font-bold text-primary mt-1">{c.display}</p>
          </div>
          ))}
        </div>
        </LearningHint>
        {/* Every number carries its evidence — no naked verdicts (A11). */}
        <LearningHint
          as="block"
          category="Sales Coach · After Pitch"
          title="Why each score"
          whatItIs="The evidence behind every number — the rationale, and where possible the exact line from the call that earned it."
          why="A naked score is a verdict you can't learn from or trust. Tying each number to real evidence is what keeps this honest instead of arbitrary."
          how="When a score surprises you, read its rationale and citation here — that's the part you can actually act on."
          principle="A score without its reason is an opinion; a score with its evidence is a lesson."
        >
        <ul className="space-y-1.5 pt-1">
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
      whatItIs="The live prompts the coach gave you mid-call, and whether you used each one — Used, Partly, or Not used."
      why="A cue you ignored and a cue you used teach different lessons. Closing the loop between advice and action is how you find out which coaching actually reaches you in the moment."
      how="Look at the 'Not used' rows without guilt — they show where in-the-moment help isn't landing yet, which is the most useful thing to practise."
      principle="Guidance only counts when it changes what you do while the door is still open."
    >
      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4 space-y-3">
        <div className="flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-brand" aria-hidden />
          <h2 className="text-sm font-semibold text-primary">What the coach cued</h2>
        </div>
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
