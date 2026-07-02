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
} from "lucide-react";

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
};

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
      setSummary((await res.json()).summary);
    } catch {
      setError("Couldn't build the summary.");
    } finally {
      setGenerating(false);
    }
  }, [id]);

  const load = useCallback(async () => {
    try {
      const [sRes, apRes] = await Promise.all([
        fetch(`/api/coach/sales-session/${id}`).catch(() => null),
        fetch(`/api/coach/sales-session/${id}/after-pitch`).catch(() => null),
      ]);
      if (sRes && sRes.ok) setSession((await sRes.json()).session);
      let existing: Summary | null = null;
      if (apRes && apRes.ok) existing = (await apRes.json()).summary;
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
              className="text-xs font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              Try again
            </button>
          </div>
        ) : !summary || !summary.hasSignal ? (
          <div className="rounded-xl border border-default bg-white/[0.01] p-5 text-center space-y-3">
            <p className="text-xs text-muted">
              Not enough of the conversation yet to write an honest summary.
              Capture or upload the call, then check back.
            </p>
            <button
              type="button"
              onClick={() => void generate()}
              className="text-xs font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              Rebuild summary
            </button>
          </div>
        ) : (
          <>
            <Timeline moments={summary.moments} />
            <BreakdownBlock moments={summary.moments} />
            <Narrative narrative={summary.narrative} />
            <Scoreboard scores={summary.scores} />
            <CueLoop entries={summary.cueLoop} />
            <FocusCard focus={summary.focus} />
          </>
        )}

        {/* Continuity — always present so the rep can keep moving (AMD-006 L3) */}
        {!loading && (
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => void startNextDoor()}
              disabled={starting || !session}
              className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-50 px-4 py-3 rounded-xl transition-colors"
            >
              {starting ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              ) : (
                <ChevronRight className="w-4 h-4" aria-hidden />
              )}
              Start Next Door
            </button>
            <Link
              href={`/dashboard/sales-coach/${id}`}
              className="block text-center text-xs text-secondary hover:text-primary py-1"
            >
              Replay conversation
            </Link>
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
    <section className="rounded-xl border border-default bg-white/[0.01] p-4">
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
  );
}

/* ─── Breakdown block (burnt amber, our identity's "danger") ─────── */
function BreakdownBlock({ moments }: { moments: Moment[] }) {
  const b = moments.find((m) => m.isBreakdown);
  if (!b) return null;
  return (
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
  );
}

/* ─── Narrative (reused growth review — tone law: strengths first) ─ */
function Narrative({ narrative }: { narrative: Summary["narrative"] }) {
  if (!narrative.hasSignal) return null;
  return (
    <section className="rounded-xl border border-ember-400/30 bg-ember-400/[0.04] p-4 space-y-3">
      <h2 className="text-sm font-semibold text-primary">Your read</h2>
      {narrative.strengths.length > 0 && (
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
      )}
      {narrative.growthAreas.length > 0 && (
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
    <section className="rounded-xl border border-default bg-white/[0.01] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-primary">Your scores</h2>
        <span className="text-[10px] text-muted">Private to you</span>
      </div>
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
      {/* Every number carries its evidence — no naked verdicts (A11). */}
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
      <p className="text-[10px] text-muted pt-1 border-t border-default">
        A mirror of this one call against your own growth — not a ranking. Only
        you see these.
      </p>
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
    <section className="rounded-xl border border-default bg-white/[0.01] p-4 space-y-3">
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
  );
}

/* ─── Next Door Focus (the ONE thing) + primary CTA sits below ──── */
function FocusCard({ focus }: { focus: Summary["focus"] }) {
  if (!focus) {
    return (
      <section className="rounded-xl border border-ember-400/40 bg-ember-400/[0.06] p-4">
        <div className="flex items-center gap-1.5 mb-1">
          <Target className="w-4 h-4 text-brand" aria-hidden />
          <h2 className="text-sm font-bold text-primary">Next Door Focus</h2>
        </div>
        <p className="text-xs text-secondary leading-relaxed">
          No single fix stood out this time — keep doing what worked.
        </p>
      </section>
    );
  }
  return (
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
  );
}
