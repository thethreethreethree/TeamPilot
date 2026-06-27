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
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";

/**
 * /dashboard/sales-coach — Live Sales Coach home (agent surface).
 *
 * Start a session, see your past sessions, and see the cue-reliance
 * signal (§3.6 make-learning-visible): are you needing fewer live cues
 * over time? Measured against your OWN past, never a ranking (§A18).
 *
 * The live audio capture itself is subsystem 1 (vendor-gated, not built
 * yet) — starting a session here creates the record the transcript +
 * cues + review attach to; the audio pipeline will plug into it.
 */

type Session = {
  id: string;
  context: "in_person" | "video";
  clientLabel: string | null;
  status: "active" | "ended" | "reviewed";
  startedAt: string;
};

type ProgressPoint = { sessionId: string; startedAt: string; cueCount: number };

export default function SalesCoachHome() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [series, setSeries] = useState<ProgressPoint[]>([]);
  const [context, setContext] = useState<"in_person" | "video">("video");
  const [clientLabel, setClientLabel] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [sRes, pRes] = await Promise.all([
        fetch("/api/coach/sales-session").catch(() => null),
        fetch("/api/coach/sales-session/progress").catch(() => null),
      ]);
      if (sRes && sRes.ok) setSessions((await sRes.json()).sessions ?? []);
      else setSessions([]);
      if (pRes && pRes.ok) setSeries((await pRes.json()).series ?? []);
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
    const firstPoint = series[0];
    const lastPoint = series[series.length - 1];
    if (!firstPoint || !lastPoint) return null;
    return {
      first: firstPoint.cueCount,
      last: lastPoint.cueCount,
      down: lastPoint.cueCount < firstPoint.cueCount,
    };
  })();

  return (
    <>
      <TopBar title="Live Sales Coach" subtitle="Your sessions & growth" />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-4xl mx-auto w-full space-y-6">
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
          <p className="text-[11px] text-muted mt-2">
            Live audio capture is being set up separately — starting a session
            creates the record your transcript, cues, and growth review attach
            to.
          </p>
        </section>

        {/* Progress — cue reliance over time (§3.6) */}
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
              Not enough completed sessions yet to show a trend. After a few
              sessions, you&apos;ll see whether you&apos;re needing fewer live
              cues over time — measured against your own past, never anyone
              else&apos;s.
            </p>
          )}
        </section>

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
    </>
  );
}
