"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Inbox,
  Loader2,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { careStatusDisplay } from "@/lib/care/statusLabels";
import { priorityDisplay } from "@/lib/care/tagColors";
import { EnableNotificationsBanner } from "@/components/pwa/EnableNotificationsBanner";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * /dashboard/care — ELOSTATE RTM Home.
 *
 * Constitutional reframe of the Zendesk "Real-time monitoring"
 * surface. Phase 2 commit 3 of the post-CAT-001 rebuild.
 *
 * Zendesk's RTM is managerial surveillance — queues / tickets /
 * agent status at a glance, designed for the operations lead to
 * spot bottlenecks ("are agents working hard enough?").
 *
 * The ELOSTATE version of the same physical surface is HONEST
 * LEARNING VISIBILITY (per §A8 + §3.6). The lead question is
 * inverted: not "are agents working?" but "what did the System
 * catch this week that it would have missed last week?" The
 * surface IS the §3.6 make-learning-visible discipline made
 * concrete.
 *
 * Constitutional sources composed here:
 *   - §A6 Pillar 2 — current load surface
 *   - §A7 — every metric carries a next step
 *   - §A8 — growth participant voice in every label
 *   - §A10 — agent self-link goes to /growth (their own data);
 *     leader self-link goes to /leadership (team aggregate).
 *     No path on this home surfaces individual data to a leader.
 *   - §A11 — counts, not verdicts
 *   - §A17 — what the team did well surfaces first
 *   - §A18 — no stack-rank, no leaderboard
 *   - §3.6 — make learning visible. This surface IS the surface
 *     where compounding institutional knowledge is shown.
 *
 * Live refresh: 20s polling matches the Zendesk RTM cadence per
 * the reference doc. True realtime via Supabase channels lands
 * later — polling is the honest tradeoff in the interim.
 */

type SnapshotConversation = {
  id: string;
  status: string;
  priority: string;
  subject: string | null;
  lastMessageAt: string | null;
  firstMessageAt: string | null;
  firstResponseAt: string | null;
  slaFirstResponseMinutes: number;
  assignedAgentId: string | null;
  customer: { name: string | null; email: string | null } | null;
};

type GrowthCommon = {
  windowDays: number;
  resolutions: number;
  durabilityHeld: number;
  durabilityReopened: number;
  durabilityInconclusive: number;
  presence: {
    conversationsClaimed: number;
    repliesSent: number;
    awaitingResponse: number;
  };
  coachAggregate: {
    repliesGraded: number;
    acknowledgedCount: number;
    answeredCount: number;
    nextStepCount: number;
    risks: {
      unsupportedAbsolutes: number;
      fabricatedSpecifics: number;
      emptyFiller: number;
    };
  };
};

type Pattern = {
  category: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  sampleConversationIds: string[];
};

type Identity = { role: string | null };

const POLL_MS = 20_000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function CareHomePage() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [growth, setGrowth] = useState<GrowthCommon | null>(null);
  const [patterns, setPatterns] = useState<Pattern[] | null>(null);
  const [convs, setConvs] = useState<SnapshotConversation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef(false);

  const isLeader =
    identity?.role === "CEO" ||
    identity?.role === "COO" ||
    identity?.role === "admin";

  const loadAll = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const [meRes, growthRes, patternsRes, inboxRes] = await Promise.all([
        fetch("/api/me/identity").catch(() => null),
        // Try leader endpoint first (returns 403 for non-leaders;
        // we then fall back to the agent self-endpoint).
        fetch("/api/care/leadership/team").then((r) =>
          r.ok ? r : fetch("/api/care/agent/growth")
        ),
        fetch("/api/care/agent/patterns?windowDays=7").catch(() => null),
        fetch("/api/care/agent/inbox?enriched=1").catch(() => null),
      ]);

      if (meRes && meRes.ok) {
        const me = await meRes.json();
        setIdentity({ role: me.role ?? null });
      }
      if (growthRes && growthRes.ok) {
        const data = await growthRes.json();
        setGrowth(data.snapshot ?? null);
      }
      if (patternsRes && patternsRes.ok) {
        const data = await patternsRes.json();
        setPatterns(data.patterns ?? []);
      }
      if (inboxRes && inboxRes.ok) {
        const data = await inboxRes.json();
        setConvs(data.conversations ?? []);
      } else if (inboxRes && inboxRes.status === 403) {
        setError("Care is agent-only.");
      }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      pollingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void loadAll();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [loadAll]);

  // §3.6 — compound the catches this week. A pattern this week is
  // a signal the System surfaced via §3.2 Understanding Gate. The
  // count is what makes the learning visible.
  const patternsThisWeek = patterns?.length ?? 0;
  const totalDurabilityChecked = growth
    ? growth.durabilityHeld +
      growth.durabilityReopened +
      growth.durabilityInconclusive
    : 0;
  const resolutionsThisWeek = (() => {
    if (!growth) return 0;
    // We don't have a per-week resolution count separately, but
    // the snapshot's resolutions is a 30-day total. The §3.6
    // surface is honest about that — we show "last 30 days" not
    // "this week" for resolutions. patterns/durability checks
    // are 7-day windows from the patterns endpoint, so they're
    // genuinely "this week."
    return growth.resolutions;
  })();

  const needsResponse =
    convs?.filter((c) => c.status === "open").length ?? 0;
  const inConv =
    convs?.filter((c) => c.status === "in_conversation").length ?? 0;
  const awaiting =
    convs?.filter((c) => c.status === "awaiting_customer").length ?? 0;

  const urgent =
    convs?.filter(
      (c) =>
        c.priority === "urgent" &&
        (c.status === "open" || c.status === "in_conversation")
    ) ?? [];

  return (
    <>
      <header className="px-4 md:px-8 py-4 border-b border-default bg-base/60 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold text-primary">
            What the System noticed this week
          </h1>
          <p className="text-[11px] text-muted">
            Honest learning visibility · auto-refresh every 20 seconds · §3.6
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted font-mono">
          Live
        </span>
      </header>
      <div className="flex-1 overflow-y-auto bg-white/[0.01]">
        <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto space-y-6">
          {/* Audit F1 (2026-06-27): C.A.R.E-side push opt-in. Pure-care
              agents had no way to enable notifications — the only opt-in
              lived on the Team Chat page. Subscriptions now route to the
              app-wide root SW so the push actually displays here. */}
          <EnableNotificationsBanner
            prompt="Want to know the moment a customer replies? Enable notifications so you're pinged on this device even when the dashboard is closed."
            dismissKey="care-notifications-banner-dismissed"
            ariaLabel="C.A.R.E notifications opt-in"
          />
          {loading && !growth && (
            <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              Loading…
            </div>
          )}
          {error && (
            <div className="glass-card p-4 border border-red-500/30 bg-red-500/5">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* §3.6 + §A8 reframe banner — what makes this surface
              constitutionally different from Zendesk's RTM. The
              copy itself is the reframe. */}
          {growth && (
            <div className="bg-ember-400/5 border border-ember-400/30 rounded-lg p-3 flex items-start gap-2">
              <ShieldCheck
                className="w-4 h-4 text-brand shrink-0 mt-0.5"
                aria-hidden
              />
              <p className="text-xs text-secondary leading-relaxed">
                This isn&apos;t a dashboard of who&apos;s working hard.
                It&apos;s a surface for what the System noticed and
                what landed durably this week. Per §3.6 the value
                curve only exists if you can see it.
              </p>
            </div>
          )}

          {/* §3.6 catches — patterns, durability, learning visible. */}
          {growth && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-3">
                What compounded this week
              </h2>
              <LearningHint
                as="block"
                category="C.A.R.E · Home"
                title="What compounded this week"
                whatItIs="The System's catches this week — patterns it surfaced, resolutions that held, ones that reopened, and resolutions captured."
                why="This is the make-learning-visible surface (§3.6): proof the System knows more than it did last week. A value curve nobody can see reads, commercially, as a flat line."
                how="Read it as a trend against last week, not a scorecard. Rising 'patterns surfaced' and 'held' is the System earning its keep; 'reopened' is a signal worth opening."
                principle="Learning the user can't perceive is indistinguishable from stagnation."
              >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <CatchCell
                  icon={Sparkles}
                  label="Patterns the System surfaced"
                  count={patternsThisWeek}
                  subtitle="Crossed §3.2 threshold"
                  href="/dashboard/care/patterns"
                  tone="brand"
                />
                <CatchCell
                  icon={CheckCircle2}
                  label="Resolutions that held"
                  count={growth.durabilityHeld}
                  subtitle={
                    totalDurabilityChecked > 0
                      ? `of ${totalDurabilityChecked} checked`
                      : "Not enough checked yet"
                  }
                  tone="emerald"
                />
                <CatchCell
                  icon={RotateCcw}
                  label="Reopened"
                  count={growth.durabilityReopened}
                  subtitle="Signal worth investigating"
                  tone="amber"
                />
                <CatchCell
                  icon={BookOpen}
                  label="Resolutions captured"
                  count={resolutionsThisWeek}
                  subtitle="Last 30 days · §1.6"
                  href={
                    isLeader
                      ? "/dashboard/care/leadership"
                      : "/dashboard/care/growth"
                  }
                  tone="muted"
                />
              </div>
              </LearningHint>
            </section>
          )}

          {/* §A11 — Coach v6 aggregate, role-appropriate framing. */}
          {growth && growth.coachAggregate.repliesGraded > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-3">
                {isLeader
                  ? "How the team's replies have read"
                  : "How your replies have read"}
              </h2>
              <LearningHint
                as="block"
                category="C.A.R.E · Home"
                title="How replies have read"
                whatItIs="Counts of how the Coach read your (or the team's) recent replies — how many acknowledged the customer, answered the question, and offered a next step."
                why="These are the mechanics of a reply that lands. Per §A11 they're counts, not verdicts — the System mirrors what it saw; you decide what it means. Anchored to graded replies, not opinion."
                how="Watch the ratios trend up over time against your own past. A low 'next step' count is the most common, most fixable gap."
                principle="The System counts and mirrors; the human renders the verdict."
              >
              <div className="bg-white/[0.02] border border-default rounded-xl p-4">
                <p className="text-[11px] text-secondary leading-relaxed mb-3">
                  Counts across {growth.coachAggregate.repliesGraded} graded{" "}
                  {growth.coachAggregate.repliesGraded === 1
                    ? "reply"
                    : "replies"}{" "}
                  this window. Per §A11 these are facts; the verdict is
                  yours.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <PresenceCell
                    label="Acknowledged"
                    count={growth.coachAggregate.acknowledgedCount}
                    total={growth.coachAggregate.repliesGraded}
                  />
                  <PresenceCell
                    label="Answered"
                    count={growth.coachAggregate.answeredCount}
                    total={growth.coachAggregate.repliesGraded}
                  />
                  <PresenceCell
                    label="Next step"
                    count={growth.coachAggregate.nextStepCount}
                    total={growth.coachAggregate.repliesGraded}
                  />
                </div>
                <Link
                  href={isLeader ? "/dashboard/care/leadership" : "/dashboard/care/growth"}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:text-ember-400 mt-3"
                >
                  Full breakdown
                  <ArrowRight className="w-3 h-3" aria-hidden />
                </Link>
              </div>
              </LearningHint>
            </section>
          )}

          {/* §A6 Pillar 2 — current load. */}
          {convs && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-3">
                Current load
              </h2>
              <LearningHint
                as="block"
                category="C.A.R.E · Home"
                title="Current load"
                whatItIs="How many conversations need a first response, are mid-conversation, or are waiting on the customer right now."
                why="Load is Pillar-2 accountability made supportive, not surveillance (§A6/§A18): it shows what the queue needs, not who's slacking. 'Needs first response' is the number that decides whether a customer feels heard fast."
                how="Work 'needs first response' down first — it's the promise-of-speed number. Tap any cell to open that slice of the inbox."
                principle="Show the queue what it needs; never rank the people in it."
              >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <LoadCell
                  icon={Inbox}
                  label="Needs first response"
                  count={needsResponse}
                  href="/dashboard/care/conversations?view=all_open"
                  tone="amber"
                />
                <LoadCell
                  icon={MessageCircle}
                  label="In conversation"
                  count={inConv}
                  href="/dashboard/care/conversations?view=all_open"
                  tone="brand"
                />
                <LoadCell
                  icon={Sparkles}
                  label="Awaiting customer"
                  count={awaiting}
                  href="/dashboard/care/conversations?view=all_open"
                  tone="muted"
                />
              </div>
              </LearningHint>
            </section>
          )}

          {/* Patterns this week — surfaced if any. The System's
              learnings made concrete per §3.6. */}
          {patterns && patterns.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-3">
                Patterns surfaced this week
              </h2>
              <div className="bg-white/[0.02] border border-default rounded-xl divide-y divide-default overflow-hidden">
                {patterns.slice(0, 5).map((p) => (
                  <Link
                    key={p.category}
                    href={`/dashboard/care/patterns?category=${encodeURIComponent(p.category)}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">
                        {p.category}
                      </p>
                      <p className="text-[10px] text-muted">
                        {p.count} similar conversations · first seen{" "}
                        {timeAgo(p.firstSeen)}
                      </p>
                    </div>
                    <ArrowRight
                      className="w-3.5 h-3.5 text-muted shrink-0"
                      aria-hidden
                    />
                  </Link>
                ))}
                {patterns.length > 5 && (
                  <Link
                    href="/dashboard/care/patterns"
                    className="flex items-center justify-center px-4 py-2 text-[11px] font-semibold text-brand hover:text-ember-400 hover:bg-white/[0.03] transition-colors"
                  >
                    See all {patterns.length} patterns
                    <ArrowRight className="w-3 h-3 ml-1" aria-hidden />
                  </Link>
                )}
              </div>
            </section>
          )}

          {/* Urgent now — surfaced only if there's urgent work. */}
          {urgent.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-3">
                Urgent right now
              </h2>
              <div className="bg-white/[0.02] border border-red-500/30 rounded-xl divide-y divide-red-500/20 overflow-hidden">
                {urgent.slice(0, 5).map((c) => {
                  const status = careStatusDisplay(c.status);
                  const pri = priorityDisplay(c.priority);
                  return (
                    <Link
                      key={c.id}
                      href={`/dashboard/care/conversations/${c.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary truncate">
                          {c.subject ?? "Untitled conversation"}
                        </p>
                        <p className="text-[10px] text-muted">
                          {c.customer?.name ??
                            c.customer?.email ??
                            "Anonymous"}{" "}
                          · {status.label} · {pri.label}
                        </p>
                      </div>
                      <ArrowRight
                        className="w-3.5 h-3.5 text-muted shrink-0"
                        aria-hidden
                      />
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* §A7 next-step affordance — where to go next. */}
          {growth && convs && (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Link
                href={isLeader ? "/dashboard/care/leadership" : "/dashboard/care/growth"}
                className="bg-white/[0.02] border border-default hover:border-strong rounded-xl p-4 transition-colors group"
              >
                <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1">
                  {isLeader ? "Team work" : "Your work"}
                </p>
                <p className="text-sm text-primary group-hover:text-ember-400 flex items-center gap-1">
                  {isLeader ? "Open the team view" : "Open your growth view"}
                  <ArrowRight className="w-3 h-3" aria-hidden />
                </p>
              </Link>
              <Link
                href="/dashboard/care/conversations?view=all_open"
                className="bg-white/[0.02] border border-default hover:border-strong rounded-xl p-4 transition-colors group"
              >
                <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1">
                  Conversations
                </p>
                <p className="text-sm text-primary group-hover:text-ember-400 flex items-center gap-1">
                  Open the inbox
                  <ArrowRight className="w-3 h-3" aria-hidden />
                </p>
              </Link>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function CatchCell({
  icon: Icon,
  label,
  count,
  subtitle,
  href,
  tone,
}: {
  icon: typeof Sparkles;
  label: string;
  count: number;
  subtitle: string;
  href?: string;
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
  const body = (
    <div className={`rounded-xl border p-4 ${toneCls} h-full transition-colors`}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5" aria-hidden />
        <p className="text-[10px] uppercase tracking-widest font-bold">
          {label}
        </p>
      </div>
      <p className="text-2xl font-bold text-primary mb-0.5">{count}</p>
      <p className="text-[10px] text-muted">{subtitle}</p>
    </div>
  );
  if (!href) return body;
  return (
    <Link href={href} className="block hover:opacity-90 transition-opacity">
      {body}
    </Link>
  );
}

function PresenceCell({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
      <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-300 mb-1">
        {label}
      </p>
      <p className="text-lg font-bold text-primary">
        {count}{" "}
        <span className="text-xs font-mono text-muted">of {total}</span>
      </p>
    </div>
  );
}

function LoadCell({
  icon: Icon,
  label,
  count,
  href,
  tone,
}: {
  icon: typeof Inbox;
  label: string;
  count: number;
  href: string;
  tone: "amber" | "brand" | "muted";
}) {
  const toneCls =
    tone === "amber"
      ? "border-amber-500/30 bg-amber-500/5 text-amber-300"
      : tone === "brand"
        ? "border-ember-400/30 bg-ember-400/5 text-brand"
        : "border-default bg-surface/40 text-secondary";
  return (
    <Link
      href={href}
      className={`rounded-xl border p-4 ${toneCls} flex items-center justify-between hover:opacity-90 transition-opacity`}
    >
      <div>
        <p className="text-[10px] uppercase tracking-widest font-bold mb-1">
          {label}
        </p>
        <p className="text-2xl font-bold text-primary">{count}</p>
      </div>
      <Icon className="w-5 h-5" aria-hidden />
    </Link>
  );
}

function timeAgo(iso: string): string {
  // Pure render-time formatter; uses Date constructor which is
  // standard JS (not the §A4-flagged Date.now-in-workflows). The
  // server's clock is the source of truth via the iso string.
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours >= 1) return `${hours}h ago`;
  const minutes = Math.floor(ms / (60 * 1000));
  if (minutes >= 1) return `${minutes}m ago`;
  return "just now";
}

// WEEK_MS is kept for future windowed-aggregation logic when we
// have a per-week resolution count separately from the 30-day
// snapshot. The §A4 uncertainty is whether a 7d/30d split is the
// right shape — deferred to the §4 readout.
void WEEK_MS;
