"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Mic,
  Video,
  DoorOpen,
  TrendingDown,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  Lightbulb,
  MessageSquare,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";

/**
 * /dashboard/sales-coach — Sales Coach product home.
 *
 * Modeled on the C.A.R.E home (§3.6 make-learning-visible), re-centered
 * on sales coaching: this surface shows what the coach helped with this
 * week and whether the agent is growing — measured against their OWN
 * past, never ranked against others (§A18 digital-gym). Every number is
 * real (§3.4); the empty state is the honest truth, not a placeholder.
 */

type Session = {
  id: string;
  context: "in_person" | "video";
  clientLabel: string | null;
  status: "active" | "ended" | "reviewed";
  startedAt: string;
};
type ProgressPoint = { sessionId: string; startedAt: string; cueCount: number };
type Stats = {
  sessionsTotal: number;
  sessionsThisWeek: number;
  activeCount: number;
  awaitingReview: number;
  reviewedCount: number;
  cuesTotal: number;
  reviewsGenerated: number;
  recentGrowth: string[];
};

export default function SalesCoachHome() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [series, setSeries] = useState<ProgressPoint[]>([]);
  const [context, setContext] = useState<"in_person" | "video">("video");
  const [clientLabel, setClientLabel] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [sRes, dRes] = await Promise.all([
        fetch("/api/coach/sales-session").catch(() => null),
        fetch("/api/coach/sales-session/dashboard").catch(() => null),
      ]);
      if (sRes && sRes.ok) setSessions((await sRes.json()).sessions ?? []);
      else setSessions([]);
      if (dRes && dRes.ok) {
        const d = await dRes.json();
        setStats(d.stats ?? null);
        setSeries(d.series ?? []);
      }
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/sales-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          clientLabel: clientLabel.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `Couldn't start (HTTP ${res.status})`);
      }
      const { session } = await res.json();
      router.push(`/dashboard/sales-coach/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  };

  // Cue-reliance trend — honest about sparsity (§3.4): a trend needs ≥3
  // ended sessions; below that we say so rather than imply progress.
  const trend = (() => {
    if (series.length < 3) return null;
    const first = series[0];
    const last = series[series.length - 1];
    if (!first || !last) return null;
    return { first: first.cueCount, last: last.cueCount, down: last.cueCount < first.cueCount };
  })();

  return (
    <>
      <TopBar title="Sales Coach" subtitle="Your coaching, made visible" />
      <div className="flex-1 overflow-y-auto bg-white/[0.01]">
        <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto w-full space-y-6">
          {/* §3.6 + §A18 reframe — this is a digital gym, not a scorecard. */}
          <div className="bg-ember-400/5 border border-ember-400/30 rounded-lg p-3 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
            <p className="text-xs text-secondary leading-relaxed">
              This isn&apos;t a scorecard or a ranking. It&apos;s your selling,
              made visible — what the coach helped with and whether you&apos;re
              needing fewer cues over time, measured against your{" "}
              <span className="text-primary">own</span> past. Per §3.6, a value
              curve only counts if you can see it.
            </p>
          </div>

          {/* Start a session */}
          <section className="rounded-xl border border-default bg-white/[0.01] p-4">
            <h2 className="text-sm font-semibold text-primary mb-3">
              Start a coaching session
            </h2>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setContext("video")}
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors ${
                    context === "video"
                      ? "border-ember-400/50 bg-ember-400/10 text-brand"
                      : "border-default text-secondary hover:text-primary"
                  }`}
                >
                  <Video className="w-3.5 h-3.5" aria-hidden />
                  Online video
                </button>
                <button
                  type="button"
                  onClick={() => setContext("in_person")}
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors ${
                    context === "in_person"
                      ? "border-ember-400/50 bg-ember-400/10 text-brand"
                      : "border-default text-secondary hover:text-primary"
                  }`}
                >
                  <DoorOpen className="w-3.5 h-3.5" aria-hidden />
                  In-person
                </button>
              </div>
              <input
                type="text"
                value={clientLabel}
                onChange={(e) => setClientLabel(e.target.value)}
                placeholder="Client / campaign (optional)"
                className="flex-1 min-w-[12rem] text-xs bg-base border border-default rounded-lg px-3 py-2 text-primary placeholder:text-muted focus:outline-none focus:border-strong"
              />
              <button
                type="button"
                onClick={() => void start()}
                disabled={starting}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-60 px-3 py-2 rounded-lg transition-colors"
              >
                {starting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                ) : (
                  <Mic className="w-3.5 h-3.5" aria-hidden />
                )}
                Start session
              </button>
            </div>
            {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
          </section>

          {/* What compounded this week */}
          <section>
            <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-3">
              What your coach helped with
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <StatCell
                icon={GraduationCap}
                label="Sessions this week"
                value={stats?.sessionsThisWeek ?? 0}
                subtitle={`${stats?.sessionsTotal ?? 0} total`}
                tone="brand"
              />
              <StatCell
                icon={Sparkles}
                label="Growth reviews"
                value={stats?.reviewsGenerated ?? 0}
                subtitle="Generated from your calls"
                tone="emerald"
              />
              <StatCell
                icon={MessageSquare}
                label="Live cues delivered"
                value={stats?.cuesTotal ?? 0}
                subtitle="Across all sessions"
                tone="muted"
              />
              <StatCell
                icon={Lightbulb}
                label="Growth opportunities"
                value={stats?.recentGrowth.length ?? 0}
                subtitle="Surfaced to practice"
                tone="amber"
              />
            </div>
          </section>

          {/* Cue reliance — the training wheels (§3.5) */}
          <section className="rounded-xl border border-default bg-white/[0.01] p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingDown className="w-3.5 h-3.5 text-brand" aria-hidden />
              <h2 className="text-sm font-semibold text-primary">
                Your reliance on live cues
              </h2>
            </div>
            {trend ? (
              <p className="text-xs text-secondary leading-relaxed">
                Across your sessions, live cues went from{" "}
                <span className="text-primary font-semibold">{trend.first}</span>{" "}
                to{" "}
                <span className="text-primary font-semibold">{trend.last}</span>{" "}
                per session.{" "}
                {trend.down
                  ? "You're needing fewer cues over time — the training wheels are coming off."
                  : "Keep going — the goal is fewer cues over time as the moves become yours."}
              </p>
            ) : (
              <p className="text-xs text-muted leading-relaxed">
                Not enough completed sessions yet to show a trend. After a few,
                you&apos;ll see whether you&apos;re needing fewer live cues over
                time — against your own past, never anyone else&apos;s.
              </p>
            )}
          </section>

          {/* Growth opportunities to practice (§3.6 — visible, specific) */}
          {stats && stats.recentGrowth.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-3">
                Growth opportunities to practice
              </h2>
              <div className="rounded-xl border border-default bg-white/[0.02] divide-y divide-default overflow-hidden">
                {stats.recentGrowth.map((g, i) => (
                  <div key={i} className="flex items-start gap-2.5 px-4 py-3">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden />
                    <p className="text-xs text-secondary leading-relaxed">{g}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Current load */}
          {stats && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-3">
                Where your sessions stand
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <StatCell icon={Mic} label="In progress" value={stats.activeCount} subtitle="Live now" tone="brand" />
                <StatCell icon={ArrowRight} label="Awaiting review" value={stats.awaitingReview} subtitle="Ended, not yet reviewed" tone="amber" />
                <StatCell icon={CheckCircle2} label="Reviewed" value={stats.reviewedCount} subtitle="Growth review done" tone="emerald" />
              </div>
            </section>
          )}

          {/* Sessions */}
          <section>
            <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-3">
              Your sessions
            </h2>
            {sessions === null ? (
              <div className="flex items-center gap-2 text-xs text-muted py-8 justify-center">
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                Loading…
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-muted py-6 text-center">
                No sessions yet. Start one above.
              </p>
            ) : (
              <div className="rounded-xl border border-default bg-white/[0.01] divide-y divide-default overflow-hidden">
                {sessions.map((s) => (
                  <Link
                    key={s.id}
                    href={`/dashboard/sales-coach/${s.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {s.context === "video" ? (
                        <Video className="w-4 h-4 text-muted shrink-0" aria-hidden />
                      ) : (
                        <DoorOpen className="w-4 h-4 text-muted shrink-0" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-primary truncate">
                          {s.clientLabel ?? "Untitled session"}
                        </p>
                        <p className="text-[10px] text-muted">
                          {s.status} · {new Date(s.startedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function StatCell({
  icon: Icon,
  label,
  value,
  subtitle,
  tone,
}: {
  icon: typeof GraduationCap;
  label: string;
  value: number;
  subtitle: string;
  tone: "brand" | "emerald" | "amber" | "muted";
}) {
  const toneCls =
    tone === "brand"
      ? "border-ember-400/30 bg-ember-400/5 text-brand"
      : tone === "emerald"
        ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
        : tone === "amber"
          ? "border-amber-500/30 bg-amber-500/5 text-amber-300"
          : "border-default bg-surface/40 text-secondary";
  return (
    <div className={`rounded-xl border p-4 ${toneCls} h-full`}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5" aria-hidden />
        <p className="text-[10px] uppercase tracking-widest font-bold">{label}</p>
      </div>
      <p className="text-2xl font-bold text-primary mb-0.5">{value}</p>
      <p className="text-[10px] text-muted">{subtitle}</p>
    </div>
  );
}
