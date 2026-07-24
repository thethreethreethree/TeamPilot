"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LearningHint } from "@/components/learning/LearningHint";
import {
  ArrowRight,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

/**
 * /dashboard/care/patterns
 *
 * Phase 3 commit 2 of the post-CAT-001 rebuild. Pattern signals
 * reframe — Zendesk's "Trending topics" + "AI-powered insights"
 * surface, rebuilt through ELOSTATE DNA.
 *
 * Constitutional sources composed:
 *   - §A11 — patterns are COUNTS the System surfaces; the user
 *     renders the verdict on whether the pattern is fair. No
 *     "high/medium/low severity" verdicts.
 *   - §A17 — positive surfaces first. Issue patterns (what
 *     customers keep asking) leads because that's where the
 *     team's institutional knowledge compounds (§1.1). Reply-
 *     shape risks come second, framed for upstream coaching.
 *   - §A18 — labels invite investigation. The team-level
 *     reply-shape section explicitly frames as "coach the cause,
 *     not the symptom."
 *   - §A7 — every pattern carries a next-step affordance: drill
 *     into the supporting §3.1 events to verify the pattern.
 *   - §A14 — drill-through to supporting conversations is a
 *     verified render branch. Each conversation ID renders as a
 *     link; clicking opens the conversation detail. Both states
 *     (collapsed pattern row, expanded with sample IDs) verified.
 *   - §3.2 Understanding Gate — patterns surface only after
 *     crossing the minimum count threshold. The thresholds (3
 *     for issues, 5 for risks) are enforced server-side.
 *
 * The Zendesk parallels and the reframes
 * ──────────────────────────────────────
 *   Zendesk "Trending topics" (intent / count / 7d % change)
 *   ↓ reframed as
 *   ELOSTATE "What customers keep asking about" — counts +
 *     supporting events, no implicit comparison verdict.
 *
 *   Zendesk "AI-powered insights" anomaly detection
 *     (e.g. "FRT spiked +1980%")
 *   ↓ reframed as
 *   ELOSTATE "Where the team's replies could use a second look"
 *     — team-level Coach risk counts. Per §A18 NO per-agent
 *     breakdown. The framing invites coaching the upstream cause
 *     (product context gaps), not the downstream symptom (a
 *     specific agent).
 */

type IssuePattern = {
  category: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  sampleConversationIds: string[];
};

type ReplyShapePattern = {
  riskCategory:
    | "unsupported_absolutes"
    | "fabricated_specifics"
    | "empty_filler";
  totalInstances: number;
  repliesScanned: number;
  windowDays: number;
  firstSeen: string;
  lastSeen: string;
  sampleConversationIds: string[];
};

const RISK_LABELS: Record<ReplyShapePattern["riskCategory"], string> = {
  unsupported_absolutes: "Unsupported absolutes",
  fabricated_specifics: "Fabricated specifics",
  empty_filler: "Empty filler",
};

const RISK_HINTS: Record<ReplyShapePattern["riskCategory"], string> = {
  unsupported_absolutes:
    "Claims like 'always' or 'guaranteed' that the product context doesn't explicitly support. Often points to gaps in the product context the team is grounded in, not to careless agents.",
  fabricated_specifics:
    "Prices, features, or policies asserted that aren't in the product context. Worth checking whether the product context needs the grounding the team is reaching for.",
  empty_filler:
    "Corporate-shaped throat-clearing ('we appreciate your patience'). Surfaces when the team's voice guidelines invite the filler, often by accident in canned replies.",
};

export default function CarePatternsPage() {
  const [issuePatterns, setIssuePatterns] = useState<IssuePattern[] | null>(
    null
  );
  const [replyShapePatterns, setReplyShapePatterns] = useState<
    ReplyShapePattern[] | null
  >(null);
  const [windowDays, setWindowDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/care/agent/patterns");
        if (cancelled) return;
        if (res.ok) {
          const d = await res.json();
          setIssuePatterns(d.issuePatterns ?? d.patterns ?? []);
          setReplyShapePatterns(d.replyShapePatterns ?? []);
          setWindowDays(d.windowDays ?? 30);
        } else if (res.status === 403) {
          setError("Care is agent-only.");
        } else {
          setError(`Could not load patterns (status ${res.status}).`);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? `Could not load patterns — ${e.message}`
              : "Could not load patterns (network error)."
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

  const nothingSurfaced =
    !loading &&
    !error &&
    (issuePatterns?.length ?? 0) === 0 &&
    (replyShapePatterns?.length ?? 0) === 0;

  return (
    <>
      <header className="px-4 md:px-8 py-4 border-b border-default bg-base/60">
        <h1 className="text-lg font-semibold text-primary">Patterns</h1>
        <p className="text-[11px] text-muted">
          What the System noticed across the last {windowDays} days · §3.2
          Understanding Gate · counts, never verdicts
        </p>
      </header>
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-4xl w-full mx-auto space-y-6">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Looking for patterns…
          </div>
        )}
        {error && (
          <div className="bg-red-500/5 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
            <p className="flex-1 text-sm text-red-300">{error}</p>
            {error !== "Care is agent-only." && (
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="text-xs font-semibold text-ember-300 hover:text-primary border border-ember-400/40 hover:border-ember-400 px-2.5 py-1 rounded-md transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* §A11 + §A18 preamble — same line on every visit. */}
            <div className="bg-ember-400/5 border border-ember-400/30 rounded-lg p-3 flex items-start gap-2">
              <ShieldCheck
                className="w-4 h-4 text-brand shrink-0 mt-0.5"
                aria-hidden
              />
              <p className="text-xs text-secondary leading-relaxed">
                Patterns are counts and questions, not verdicts. A
                category showing up 5 times doesn&apos;t mean &quot;5
                customers are wrong&quot; — it means the System has
                evidence worth investigating. The team chooses what to
                do with each signal (§A11). Reply-shape patterns
                surface team-wide only — no per-agent breakdown by
                design (§A18).
              </p>
            </div>

            {nothingSurfaced && (
              <div className="text-center py-16 px-6">
                <TrendingUp
                  className="w-8 h-8 text-muted mx-auto mb-2"
                  aria-hidden
                />
                <p className="text-sm text-primary mb-1">No patterns yet.</p>
                <p className="text-xs text-muted max-w-md mx-auto leading-relaxed mb-4">
                  As the team resolves conversations and Coach grades
                  replies, recurring themes will surface here when they
                  cross the §3.2 Understanding Gate threshold (3
                  matching resolutions for issues, 5 risk instances
                  for reply shapes). Until then, no faux-pattern noise.
                </p>
                <p className="text-[11px] text-muted max-w-md mx-auto leading-relaxed">
                  In a fresh tenant this is typically the state for the
                  first 2–4 weeks of support activity. Check back when
                  you have ~15+ resolutions captured.
                </p>
              </div>
            )}

            {/* §A17 — what customers keep asking surfaces FIRST.
                This is the institutional-knowledge surface; the
                team's resolutions are compounding (§1.1). */}
            {issuePatterns && issuePatterns.length > 0 && (
              <LearningHint
                as="block"
                category="Patterns · §A17"
                title="What customers keep asking about"
                whatItIs="Issue categories where the team has captured 3+ resolutions in the window — meaning customers have asked about this thing enough times to cross the §3.2 Understanding Gate threshold. Each row shows the category, count, and links to the underlying resolutions."
                why="Recurring customer questions are early signals of product/process/messaging gaps. A team that gets 5 'where do I find X?' tickets isn't dealing with bad customers; it's dealing with a product where X is mislocated. This panel makes the recurrence visible so the leadership can fix the cause, not just close more tickets."
                how="Read top-down — the most frequent categories are at the top. Click into a row to see the resolutions and look for the COMMON SHAPE across them. The fix is usually upstream (product label, docs, onboarding flow), not downstream (better support replies)."
                principle="Frequency reveals cause. The team that fixes upstream produces less downstream work."
              >
                <section>
                  <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-3">
                    What customers keep asking about
                  </h2>
                  <p className="text-[11px] text-secondary leading-relaxed mb-3">
                    Categories with 3+ resolutions in the window. The
                    earliest warning system for product / process /
                    messaging gaps.
                  </p>
                  <div className="space-y-2">
                    {issuePatterns.map((p) => (
                      <IssuePatternRow key={p.category} pattern={p} />
                    ))}
                  </div>
                </section>
              </LearningHint>
            )}

            {/* §A18 framing — team-level only, coach the cause. */}
            {replyShapePatterns && replyShapePatterns.length > 0 && (
              <LearningHint
                as="block"
                category="Patterns · §A18"
                title="Where the team's replies could use a second look"
                whatItIs="Coach v6 risk-pattern counts across the entire team (NEVER per-agent — that's §A18). Each row is a named risk (NVC-evaluation, voss-bare-assertion, stone-identity-collision, etc.) with its 7-day count and direction."
                why="Per §A18 the readout is structurally team-level. The constitution prevents per-agent breakdown of communication patterns because that would create a stack-rank surface — and stack-ranks corrode the team faster than they improve any individual. Team-level visibility coaches the CAUSE without singling out the agent. Often these patterns point to gaps in product context (the cause) rather than to careless agents (the symptom)."
                how="Read the patterns + counts. Ask: what about our product, our docs, our customer-facing language could be producing this pattern? Fix the cause once and the pattern usually drops across every agent. Resist the urge to coach individuals from this surface."
                principle="Coach the cause, not the symptom. The team-level view is the structural defense against the stack-rank failure mode."
              >
                <section>
                  <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-3">
                    Where the team&apos;s replies could use a second look
                  </h2>
                  <p className="text-[11px] text-secondary leading-relaxed mb-3">
                    Coach v6 risk counts across the team this window.
                    Often these patterns point to gaps in product context
                    (the cause) rather than to careless agents (the
                    symptom). Coach the cause.
                  </p>
                <div className="space-y-2">
                  {replyShapePatterns.map((p) => (
                    <ReplyShapePatternRow
                      key={p.riskCategory}
                      pattern={p}
                    />
                  ))}
                </div>
                </section>
              </LearningHint>
            )}
          </>
        )}
      </div>
    </>
  );
}

/**
 * §A11 — render the issue pattern as a count + supporting events.
 * No severity verdict. §A7 next-step is the drill into supporting
 * conversations (verify the pattern is real).
 * §A14 — two render states: collapsed (just count), with sample
 * IDs (drill-through links). Both verified.
 */
function IssuePatternRow({ pattern }: { pattern: IssuePattern }) {
  return (
    <div className="rounded-xl border border-default bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-brand" aria-hidden />
            <p className="text-sm font-semibold text-primary truncate">
              {pattern.category}
            </p>
          </div>
          <p className="text-[11px] text-muted">
            <span className="font-mono font-semibold text-primary">
              {pattern.count}
            </span>{" "}
            {pattern.count === 1 ? "resolution" : "resolutions"} · first seen{" "}
            {pattern.firstSeen.slice(0, 10)} · last seen{" "}
            {pattern.lastSeen.slice(0, 10)}
          </p>
        </div>
      </div>
      {pattern.sampleConversationIds.length > 0 && (
        <div className="mt-3 pt-3 border-t border-default/60">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] uppercase tracking-widest text-muted font-bold">
              §A7 — open one to verify the pattern is real
            </p>
            <p className="text-[10px] text-muted font-mono">
              {pattern.sampleConversationIds.length} sample
              {pattern.sampleConversationIds.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {pattern.sampleConversationIds.map((id) => (
              <Link
                key={id}
                href={`/dashboard/care/conversations/${id}`}
                className="inline-flex items-center gap-0.5 text-[10px] font-mono text-brand hover:text-primary border border-default hover:border-strong px-1.5 py-0.5 rounded"
              >
                {id.slice(0, 8)}
                <ArrowRight className="w-2 h-2" aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * §A18 — render the reply-shape pattern with framing that invites
 * coaching the upstream cause, never penalizing the agent. The
 * hint line explicitly names where the pattern usually points.
 */
function ReplyShapePatternRow({ pattern }: { pattern: ReplyShapePattern }) {
  const label = RISK_LABELS[pattern.riskCategory];
  const hint = RISK_HINTS[pattern.riskCategory];
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <MessageCircle className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" aria-hidden />
            <p className="text-sm font-semibold text-primary">{label}</p>
          </div>
          <p className="text-[11px] text-muted">
            <span className="font-mono font-semibold text-amber-700 dark:text-amber-300">
              {pattern.totalInstances}
            </span>{" "}
            instances across {pattern.repliesScanned}{" "}
            {pattern.repliesScanned === 1 ? "graded reply" : "graded replies"} ·
            first seen {pattern.firstSeen.slice(0, 10)} · last seen{" "}
            {pattern.lastSeen.slice(0, 10)}
          </p>
        </div>
      </div>
      <p className="text-[11px] text-secondary leading-relaxed italic mb-3">
        {hint}
      </p>
      {pattern.sampleConversationIds.length > 0 && (
        <div className="pt-2 border-t border-amber-500/20">
          <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1.5">
            §A7 — open a sample to coach the upstream cause
          </p>
          <div className="flex flex-wrap gap-1.5">
            {pattern.sampleConversationIds.map((id) => (
              <Link
                key={id}
                href={`/dashboard/care/conversations/${id}`}
                className="inline-flex items-center gap-0.5 text-[10px] font-mono text-amber-700 dark:text-amber-300 hover:text-primary border border-amber-500/30 hover:border-amber-500/60 px-1.5 py-0.5 rounded"
              >
                {id.slice(0, 8)}
                <ArrowRight className="w-2 h-2" aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

