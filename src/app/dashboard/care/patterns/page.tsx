"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  Sparkles,
  TrendingUp,
} from "lucide-react";

/**
 * /dashboard/care/patterns
 *
 * §3.2 Understanding Gate applied to support. Categories that show
 * up enough times within the window surface as Patterns. The team
 * can then choose to escalate one as a Problem in the §3.1 chain —
 * the support volume becomes the company's earliest warning system
 * about product / process / messaging gaps.
 */

type Pattern = {
  category: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  sampleConversationIds: string[];
};

export default function CarePatternsPage() {
  const [patterns, setPatterns] = useState<Pattern[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/care/agent/patterns");
        if (res.ok) {
          const d = await res.json();
          setPatterns(d.patterns ?? []);
        } else if (res.status === 403) {
          setError("Care is agent-only.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <header className="px-8 py-4 border-b border-default bg-base/60">
        <h1 className="text-lg font-semibold text-primary">Patterns</h1>
        <p className="text-[11px] text-muted">
          Recurring issues the System has noticed · §3.2 Understanding
          Gate · 3+ matches in 30 days surface here
        </p>
      </header>
      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl w-full mx-auto space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Looking for patterns…
          </div>
        )}
        {error && (
          <div className="bg-red-500/5 border border-red-500/30 rounded-lg p-4">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {!loading && !error && patterns && (
          <>
            {/* Honest preamble */}
            <div className="bg-arc-400/5 border border-arc-400/30 rounded-lg p-3 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-arc-300 shrink-0 mt-0.5" aria-hidden />
              <p className="text-xs text-secondary leading-relaxed">
                §A11 — patterns are counts and questions, not verdicts. A
                category showing up 5 times doesn&apos;t mean &quot;5
                customers are wrong&quot;; it means the System has
                evidence worth investigating. The team chooses what to
                do with the signal.
              </p>
            </div>

            {patterns.length === 0 ? (
              <div className="text-center py-16">
                <TrendingUp
                  className="w-8 h-8 text-muted mx-auto mb-2"
                  aria-hidden
                />
                <p className="text-sm text-primary mb-1">No patterns yet.</p>
                <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
                  As your team resolves conversations and captures
                  categories, recurring themes will surface here when
                  they cross 3 instances in 30 days. Until then, no
                  faux-pattern noise.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {patterns.map((p) => (
                  <PatternRow key={p.category} pattern={p} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function PatternRow({ pattern }: { pattern: Pattern }) {
  const severity =
    pattern.count >= 12 ? "high" : pattern.count >= 6 ? "medium" : "low";
  const toneCls =
    severity === "high"
      ? "border-red-500/40 bg-red-500/5"
      : severity === "medium"
        ? "border-amber-500/40 bg-amber-500/5"
        : "border-default bg-white/[0.02]";
  return (
    <div className={`rounded-xl border p-4 ${toneCls}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {severity === "high" ? (
              <AlertTriangle className="w-3.5 h-3.5 text-red-300" aria-hidden />
            ) : severity === "medium" ? (
              <TrendingUp className="w-3.5 h-3.5 text-amber-300" aria-hidden />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-arc-300" aria-hidden />
            )}
            <p className="text-sm font-semibold text-primary truncate">
              {pattern.category}
            </p>
          </div>
          <p className="text-[11px] text-muted">
            <span className="font-mono font-semibold text-primary">
              {pattern.count}
            </span>{" "}
            instances · first seen {pattern.firstSeen.slice(0, 10)} · last seen{" "}
            {pattern.lastSeen.slice(0, 10)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border ${
              severity === "high"
                ? "border-red-500/50 bg-red-500/15 text-red-300"
                : severity === "medium"
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                  : "border-default bg-surface text-secondary"
            }`}
          >
            {severity}
          </span>
        </div>
      </div>
      {pattern.sampleConversationIds.length > 0 && (
        <div className="mt-2 pt-2 border-t border-default/60">
          <p className="text-[10px] uppercase tracking-widest text-muted mb-1">
            Sample conversations
          </p>
          <div className="flex flex-wrap gap-1.5">
            {pattern.sampleConversationIds.map((id) => (
              <Link
                key={id}
                href={`/dashboard/care/conversations/${id}`}
                className="text-[10px] font-mono text-brand hover:text-primary border border-default hover:border-strong px-1.5 py-0.5 rounded"
              >
                {id.slice(0, 8)} <ArrowRight className="w-2 h-2 inline" aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
