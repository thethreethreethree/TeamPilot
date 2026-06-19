"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Hourglass,
  Loader2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";

/**
 * /dashboard/my-growth — §3.6 make-learning-visible surface.
 *
 * Cross-conversation memory has been working invisibly since the
 * cross-conversation-memory commit — every analyze fires a chain
 * event, the Coach reads its own pattern history when forming the
 * next response. §3.6 says: continuous adaptation the user cannot
 * perceive is indistinguishable from stagnation. This page is the
 * perception surface.
 *
 * Constitutional grounding by asset:
 *   §3.6: make learning visible (the page exists at all).
 *   §A10: the user sees what the System sees about them — same data
 *         the Coach prompt uses (loadCoachMemory) is rendered here.
 *         No shadow read.
 *   §A11: counts and questions, never verdicts. "You've heard about
 *         X three times" is a fact; the user decides if that's a
 *         pattern.
 *   §A7:  every datum surfaces with an offered next step. The
 *         "What you can do with this" footer per principle ties the
 *         observation to an action.
 *   §A18: section labels invite reflection, not rating. "What I've
 *         been noticing" not "Your performance score."
 */

type MemoryPattern = {
  principle: string;
  book?: string;
  citedCount: number;
  lastCitedAt: string;
};

type Snapshot = {
  totalAnalyses: number;
  patterns: MemoryPattern[];
  recentGradeMix: {
    productive: number;
    neutral: number;
    needsGuidance: number;
  };
  totalGraded: number;
};

export default function MyGrowthPage() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/me/coach-memory");
        if (!res.ok) throw new Error("Couldn't load");
        const data = (await res.json()) as { snapshot: Snapshot };
        setSnap(data.snapshot);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-base">
      <TopBar
        title="My growth"
        subtitle="What the System has been noticing about your communication · last 30 days"
      />

      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
        {/* §A10 transparency preamble. The user needs to know: the
            data on this page is exactly what the Coach reads when
            forming its next response. No backstage read. */}
        <div className="glass-card p-4 border border-ember-400/30 bg-ember-400/5">
          <div className="flex items-start gap-2">
            <ShieldCheck
              className="w-4 h-4 text-brand shrink-0 mt-0.5"
              aria-hidden
            />
            <div>
              <p className="text-xs font-semibold text-primary">
                You see what the System sees about you.
              </p>
              <p className="text-[11px] text-secondary leading-relaxed mt-1">
                Everything on this page is the same data the Coach uses
                internally when reading your next draft. There&apos;s
                no separate read happening backstage. If a number here
                feels off, that&apos;s a signal — tell us, and we&apos;ll
                figure out together what the System is actually
                tracking.
              </p>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted py-10">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading what we&apos;ve noticed…
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}

        {snap && (
          <>
            {/* Sparse-data state — A11 silence when N is too small */}
            {snap.totalAnalyses < 3 && snap.totalGraded < 5 ? (
              <div className="glass-card p-6 text-center">
                <Hourglass
                  className="w-6 h-6 text-arc-300 mx-auto mb-3"
                  aria-hidden
                />
                <p className="text-sm text-primary font-medium mb-1">
                  We don&apos;t have enough yet.
                </p>
                <p className="text-xs text-secondary max-w-md mx-auto leading-relaxed">
                  The System needs at least a few drafts coached and a
                  handful of sent messages graded before we can show
                  you patterns. Right now we have{" "}
                  <span className="font-mono text-primary">
                    {snap.totalAnalyses}
                  </span>{" "}
                  Coach analyses and{" "}
                  <span className="font-mono text-primary">
                    {snap.totalGraded}
                  </span>{" "}
                  graded messages on the chain for you.
                </p>
                <p className="text-[11px] text-muted mt-3">
                  Per §A3 — sparse data should stay silent rather than
                  hallucinate patterns. The page populates as the
                  chain accumulates.
                </p>
              </div>
            ) : (
              <>
                {/* Recurring patterns — A11 mirror frame. The phrasing
                    is "I've noticed" not "you have a problem." */}
                <Section
                  icon={Sparkles}
                  title="What I&rsquo;ve been noticing"
                  subtitle="Principles the Coach has cited to you, in order of frequency. The count is a fact — whether it&rsquo;s a pattern worth pausing on is your call."
                >
                  {snap.patterns.length === 0 ? (
                    <p className="text-xs text-muted">
                      No recurring principles yet — every Coach citation
                      so far has been one-off. Either your patterns
                      are diverse (good signal) or the Coach hasn&apos;t
                      had enough to read (more drafts → more data).
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {snap.patterns.map((p) => {
                        const ago = daysAgo(p.lastCitedAt);
                        return (
                          <li
                            key={p.principle}
                            className="border-l-2 border-ember-400/40 pl-3"
                          >
                            <p className="text-sm font-semibold text-primary">
                              {p.principle}
                            </p>
                            {p.book && (
                              <p className="text-[11px] text-muted italic">
                                {p.book}
                              </p>
                            )}
                            <p className="text-xs text-secondary mt-1">
                              Cited{" "}
                              <span className="font-semibold text-brand">
                                {p.citedCount}×
                              </span>{" "}
                              · last surfaced{" "}
                              {ago === 0
                                ? "today"
                                : ago === 1
                                  ? "yesterday"
                                  : `${ago} days ago`}
                            </p>
                            {/* §A7 — every datum comes with an offered
                                next step. The phrasing is invitation,
                                not assignment. */}
                            <p className="text-[11px] text-secondary mt-1.5 italic">
                              Worth a look:{" "}
                              {p.citedCount >= 4
                                ? "this one&apos;s been recurring. Open the next conversation with a moment to notice if it lands the same way again."
                                : p.citedCount >= 2
                                  ? "showing up more than once. Pattern starting, or fair callbacks?"
                                  : "first observation — too early to call it anything."}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Section>

                {/* Grade mix — communication baseline. The labels are
                    A18-shaped. "Productive" not "good"; "Needs
                    guidance" not "bad." */}
                {snap.totalGraded > 0 && (
                  <Section
                    icon={BookOpen}
                    title="How your messages have been landing"
                    subtitle="The Coach grades sent messages on whether the framing tends to produce clarity, neutrality, or pushback. This is downstream consequence — not a rating on you."
                  >
                    <div className="grid grid-cols-3 gap-3">
                      <GradeStat
                        label="Productive"
                        count={snap.recentGradeMix.productive}
                        total={snap.totalGraded}
                        tone="emerald"
                      />
                      <GradeStat
                        label="Neutral"
                        count={snap.recentGradeMix.neutral}
                        total={snap.totalGraded}
                        tone="muted"
                      />
                      <GradeStat
                        label="Needs guidance"
                        count={snap.recentGradeMix.needsGuidance}
                        total={snap.totalGraded}
                        tone="amber"
                      />
                    </div>
                    <p className="text-[11px] text-muted mt-3">
                      n = {snap.totalGraded} graded messages over the
                      last 30 days. The withheld grade (when the grader
                      was unavailable) is excluded — that&apos;s a
                      system-state, not a signal about you.
                    </p>
                  </Section>
                )}
              </>
            )}

            {/* Honesty caveat — surfaces the structural N threshold so
                the user knows the page deliberately stays quiet when
                evidence is thin. */}
            <div className="glass-card p-3 border border-gold-400/30 bg-gold-400/5 flex items-start gap-2">
              <TriangleAlert
                className="w-3.5 h-3.5 text-accent-text shrink-0 mt-0.5"
                aria-hidden
              />
              <p className="text-[11px] text-secondary leading-relaxed">
                The System refuses to surface patterns it doesn&apos;t
                have enough evidence for. If this page is sparse,
                that&apos;s the discipline working — not a feature
                gap. The §A3 anti-game default: small N stays silent.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-brand" aria-hidden />
        <h2
          className="text-sm font-semibold text-primary"
          dangerouslySetInnerHTML={{ __html: title }}
        />
      </div>
      {subtitle && (
        <p className="text-[11px] text-muted leading-relaxed mb-4">
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}

function GradeStat({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: "emerald" | "muted" | "amber";
}) {
  const hasData = total > 0;
  const pct = hasData ? Math.round((count / total) * 100) : 0;
  const toneClass =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
      : tone === "amber"
        ? "border-accent-text/30 bg-accent-text/5 text-accent-text"
        : "border-default bg-surface/40 text-secondary";
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-widest font-bold">
        {label}
      </p>
      {/* hasData guard — when total is 0 the percentage is
          meaningless. Show an em-dash instead of '0%' so the user
          doesn't read a sparse-data state as a real grade of zero
          (caught in audit 2026-06-19). */}
      <p className="mt-1 text-lg font-bold text-primary">
        {hasData ? `${pct}%` : "—"}
      </p>
      <p className="text-[10px] text-muted font-mono">
        {hasData ? `${count} of ${total}` : "no data yet"}
      </p>
    </div>
  );
}

function daysAgo(iso: string): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  const diffMs = Date.now() - then;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}
