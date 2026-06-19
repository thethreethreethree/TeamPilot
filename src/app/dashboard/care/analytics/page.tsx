"use client";

import { useEffect, useState } from "react";
import { BarChart3, Clock, Loader2, TrendingUp, Users } from "lucide-react";

type AnalyticsSnapshot = {
  windowDays: number;
  totalConversations: number;
  resolvedConversations: number;
  avgFirstResponseMinutes: number | null;
  medianFirstResponseMinutes: number | null;
  firstResponseDistribution: { bucket: string; count: number }[];
  resolutionRate: number | null;
  byStatus: Record<string, number>;
};

export default function CareAnalyticsPage() {
  const [data, setData] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch("/api/care/agent/analytics");
        if (cancelled) return;
        if (res.ok) {
          const d = await res.json();
          setData(d);
        } else {
          setLoadError(
            res.status === 403
              ? "You're not authorized to view analytics."
              : `Could not load analytics (status ${res.status}).`
          );
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error
              ? `Could not load analytics — ${e.message}`
              : "Could not load analytics (network error)."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <>
      <header className="px-4 md:px-8 py-4 border-b border-default bg-base/60">
        <h1 className="text-lg font-semibold text-primary">Analytics</h1>
        <p className="text-[11px] text-muted">
          Honest measurement · distributions, not averages · §3.5
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-5xl mx-auto w-full space-y-5">
        {loadError && !loading && (
          <div className="glass-card p-4 border border-red-500/30 bg-red-500/[0.04] flex items-center gap-3">
            <p className="flex-1 text-xs text-red-300">{loadError}</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="text-xs font-semibold text-ember-300 hover:text-primary border border-ember-400/40 hover:border-ember-400 px-2.5 py-1 rounded-md transition-colors"
            >
              Retry
            </button>
          </div>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        )}

        {!loading && data && (
          <>
            {/* Honest preamble */}
            <div className="bg-ember-400/5 border border-ember-400/30 rounded-lg p-3">
              <p className="text-xs text-secondary leading-relaxed">
                Last {data.windowDays} days · n = {data.totalConversations}.
                These numbers are raw counts and distributions —
                we don&apos;t round, smooth, or surface vanity
                averages. When N is small, draw small conclusions.
              </p>
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <StatCard
                icon={Users}
                label="Conversations"
                value={data.totalConversations}
                sub={`${data.resolvedConversations} resolved`}
              />
              <StatCard
                icon={Clock}
                label="Median first response"
                value={
                  data.medianFirstResponseMinutes != null
                    ? `${data.medianFirstResponseMinutes} min`
                    : "—"
                }
                sub={
                  data.avgFirstResponseMinutes != null
                    ? `mean ${data.avgFirstResponseMinutes} min`
                    : ""
                }
              />
              <StatCard
                icon={TrendingUp}
                label="Resolution rate"
                value={
                  data.resolutionRate != null
                    ? `${Math.round(data.resolutionRate * 100)}%`
                    : "—"
                }
                sub="resolved / total"
              />
            </div>

            {/* Distribution */}
            <div className="bg-white/[0.02] border border-default rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  First-response time — distribution
                </h2>
              </div>
              <p className="text-[11px] text-muted mb-4 leading-relaxed">
                Not the average. The shape. A 30-min average can hide
                a long tail or a fast majority — both matter for
                customer experience.
              </p>
              {data.firstResponseDistribution.length === 0 ? (
                <p className="text-xs text-muted">
                  Not enough first-responses recorded yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.firstResponseDistribution.map((b) => {
                    const max = Math.max(
                      ...data.firstResponseDistribution.map((x) => x.count)
                    );
                    const pct = max > 0 ? (b.count / max) * 100 : 0;
                    return (
                      <div
                        key={b.bucket}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="w-24 text-muted shrink-0 font-mono text-[10px]">
                          {b.bucket}
                        </span>
                        <div className="flex-1 h-3 bg-surface rounded-sm overflow-hidden">
                          <div
                            className="h-full bg-ember-400 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-primary font-mono">
                          {b.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Status mix */}
            <div className="bg-white/[0.02] border border-default rounded-xl p-5">
              <h2 className="text-sm font-semibold text-primary mb-3">
                Status mix right now
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {Object.entries(data.byStatus).map(([k, v]) => (
                  <div
                    key={k}
                    className="border border-default rounded-md p-2.5 text-center"
                  >
                    <p className="text-lg font-bold text-primary">{v}</p>
                    <p className="text-[10px] text-muted uppercase tracking-widest font-bold">
                      {k.replace(/_/g, " ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="bg-white/[0.02] border border-default rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-brand" aria-hidden />
        <span className="text-[10px] uppercase tracking-widest font-bold text-muted">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-primary">{value}</p>
      {sub && <p className="text-[11px] text-muted mt-1">{sub}</p>}
    </div>
  );
}
