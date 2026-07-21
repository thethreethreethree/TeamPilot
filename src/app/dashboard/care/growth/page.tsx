"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Inbox,
  Loader2,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { LearningHint } from "@/components/learning/LearningHint";
import { gradeCareAggregate, type CareGrade } from "@/lib/care/careQualityGrade";

/**
 * Agent self-view — what your work has looked like over 30 days.
 *
 * Constitutional sources (ThinkerThinker.md):
 *   - §A6 — Pillar 2 transparent accountability. The agent reads
 *     their own load + work pattern here. Leader-aggregate view
 *     (separate route) reads the same shape across the team but
 *     CANNOT see individual-detail.
 *   - §A7 — every metric ships with an AI-offered next step.
 *   - §A8 — growth participant voice in every label and section.
 *   - §A10 — the agent sees what the leader sees about them,
 *     exactly. This page renders the same fields the leader
 *     surface (Phase 2 commit 2) aggregates across the team.
 *   - §A11 — counts, not verdicts. The agent renders the verdict
 *     on whether the pattern is fair.
 *   - §A17 — three contracts. Positive counts surface FIRST
 *     (experiential), then risks, then guidance affordances.
 *   - §A18 — labels invite reflection, never penalize.
 *   - §3.6 make-learning-visible — this surface IS the discipline.
 *
 * Display order is constitutionally load-bearing per A17:
 *   1. §A10 preamble (you see what's seen)
 *   2. What landed — durability held (positive A17 surfacing first)
 *   3. Your reply patterns — Coach v6 counts (positive presences first)
 *   4. Your load — A6 Pillar 2 with A7 next-step links
 *   5. Where Co-Pilot fit in (A16)
 *   6. Resolutions captured (§1.6 close-the-loop)
 */

type GrowthSnapshot = {
  agentId: string;
  windowDays: number;
  resolutions: number;
  durabilityHeld: number;
  durabilityReopened: number;
  durabilityInconclusive: number;
  copilotMinor: number;
  copilotModerate: number;
  copilotMajor: number;
  copilotRewrite: number;
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
  // §A10 parity — the same coaching grade + 4-week trajectory the leader sees about this agent.
  trajectory: Array<number | null>;
};

export default function CareGrowthPage() {
  const [snap, setSnap] = useState<GrowthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/care/agent/growth");
        if (cancelled) return;
        if (res.status === 403) {
          setError("Care growth is for agents.");
          return;
        }
        if (!res.ok) {
          setError(`Could not load growth (status ${res.status}).`);
          return;
        }
        const data = await res.json();
        if (!cancelled) setSnap(data.snapshot ?? null);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? `Could not load growth — ${e.message}`
              : "Could not load growth (network error)."
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

  const totalEdits = snap
    ? snap.copilotMinor +
      snap.copilotModerate +
      snap.copilotMajor +
      snap.copilotRewrite
    : 0;
  const totalDurability = snap
    ? snap.durabilityHeld + snap.durabilityReopened + snap.durabilityInconclusive
    : 0;
  const totalRisks = snap
    ? snap.coachAggregate.risks.unsupportedAbsolutes +
      snap.coachAggregate.risks.fabricatedSpecifics +
      snap.coachAggregate.risks.emptyFiller
    : 0;

  return (
    <>
      <header className="px-4 md:px-8 py-4 border-b border-default bg-base/60">
        <h1 className="text-lg font-semibold text-primary">Your work</h1>
        <p className="text-[11px] text-muted">
          What the System noticed about your work · last 30 days · you see
          your own data, nobody else sees it at this individual detail
        </p>
      </header>
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-4xl w-full mx-auto space-y-5">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        )}
        {error && (
          <div className="bg-red-500/5 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
            <p className="flex-1 text-sm text-red-300">{error}</p>
            {error !== "Care growth is for agents." && (
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

        {snap && (
          <>
            {/* §A10 preamble — same line on every visit. Updated 2026-07-22: the leader's Coach
                Assessment now shows a per-agent coaching grade + trajectory, so this view shows you the
                SAME grade + trajectory about yourself. No asymmetric read. */}
            <div className="bg-ember-400/5 border border-ember-400/30 rounded-lg p-3 flex items-start gap-2">
              <ShieldCheck
                className="w-4 h-4 text-brand shrink-0 mt-0.5"
                aria-hidden
              />
              <p className="text-xs text-secondary leading-relaxed">
                You see what the System sees about your work — including the
                same coaching grade and 4-week trajectory your leader sees
                about you. Nothing is read about you that you can&apos;t read
                yourself. The discipline is structural (§A10).
              </p>
            </div>

            {/* §A10 parity — the coaching grade + trajectory the leader sees about you. */}
            <CoachingGradeCard snap={snap} />

            {/* §A17 experiential FIRST — what landed durably. */}
            <LearningHint
              as="block"
              category="C.A.R.E · Your work"
              title="What landed durably"
              whatItIs="The 7-day durability check on your resolutions: how many held, how many reopened, and how many were inconclusive."
              why="'Held' is the count that matters most — work that compounded into the team's playbook instead of bouncing back. Per §A11 it's a count, not a grade."
              how="Watch 'held' rise over time against your own past. A 'reopened' is a signal to investigate the root cause, not a mark against you — sometimes the cause was elsewhere."
              principle="Durable resolution, not fast closure, is the thing worth counting."
            >
            <div className="bg-white/[0.02] border border-default rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  What landed durably
                </h2>
              </div>
              <p className="text-[11px] text-secondary leading-relaxed mb-4">
                7-day check after each resolution: did the customer come
                back with the same issue? &quot;Held&quot; is the count
                that matters most — the work that compounded into the
                team&apos;s playbook.
              </p>
              {totalDurability === 0 ? (
                <SparseNotice text="No durability checks yet. Each resolution you capture gets a 7-day check — the first results will land here a week after your first resolution." />
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <DurabilityCell
                    label="Held"
                    icon={CheckCircle2}
                    count={snap.durabilityHeld}
                    total={totalDurability}
                    tone="emerald"
                  />
                  <DurabilityCell
                    label="Reopened"
                    icon={RotateCcw}
                    count={snap.durabilityReopened}
                    total={totalDurability}
                    tone="amber"
                  />
                  <DurabilityCell
                    label="Inconclusive"
                    icon={TriangleAlert}
                    count={snap.durabilityInconclusive}
                    total={totalDurability}
                    tone="muted"
                  />
                </div>
              )}
              <p className="text-[10px] text-muted italic mt-3">
                &quot;Reopened&quot; is a signal worth investigating, not
                a grade on you — sometimes the root cause was elsewhere
                and you closed it correctly given what you knew.
              </p>
            </div>
            </LearningHint>

            {/* §A11 Coach v6 aggregates — positive counts first per A17. */}
            <LearningHint
              as="block"
              category="C.A.R.E · Your work"
              title="Your reply patterns"
              whatItIs="Counts of what the Coach found present in your recently graded replies — acknowledged, answered, offered a next step — plus risks worth a second look."
              why="These are the mechanics of a reply that lands. Per §A11 they're facts the System mirrors; you render the verdict on whether the pattern is fair. There's no team average to compare against."
              how="A low 'next step' count is the most common and most fixable gap. Treat the risks as invitations to look again, not accusations."
              principle="The System counts and mirrors; the human renders the verdict."
            >
            <div className="bg-white/[0.02] border border-default rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  Your reply patterns
                </h2>
              </div>
              <p className="text-[11px] text-secondary leading-relaxed mb-4">
                Counts of what was present in your last{" "}
                {snap.coachAggregate.repliesGraded} graded{" "}
                {snap.coachAggregate.repliesGraded === 1 ? "reply" : "replies"}.
                Per §A11 the System counts; you render the verdict on
                whether the pattern is fair. There&apos;s no team
                average to compare against here — your pattern, your
                read.
              </p>
              {snap.coachAggregate.repliesGraded === 0 ? (
                <SparseNotice text="No replies graded under Coach v6 in this window. Replies get graded as you send them — the first batch will appear here within an hour of your first Coach-active reply." />
              ) : (
                <>
                  <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-2">
                    What you brought
                  </p>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <PresenceCell
                      label="Acknowledged"
                      count={snap.coachAggregate.acknowledgedCount}
                      total={snap.coachAggregate.repliesGraded}
                    />
                    <PresenceCell
                      label="Answered"
                      count={snap.coachAggregate.answeredCount}
                      total={snap.coachAggregate.repliesGraded}
                    />
                    <PresenceCell
                      label="Next step"
                      count={snap.coachAggregate.nextStepCount}
                      total={snap.coachAggregate.repliesGraded}
                    />
                  </div>
                  {totalRisks > 0 && (
                    <>
                      <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-2">
                        Worth a second look
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        <RiskCell
                          label="Unsupported absolutes"
                          count={snap.coachAggregate.risks.unsupportedAbsolutes}
                        />
                        <RiskCell
                          label="Fabricated specifics"
                          count={snap.coachAggregate.risks.fabricatedSpecifics}
                        />
                        <RiskCell
                          label="Empty filler"
                          count={snap.coachAggregate.risks.emptyFiller}
                        />
                      </div>
                      <p className="text-[10px] text-muted italic mt-3">
                        These are facts, not verdicts. Some absolutes
                        and specifics are fair when the product context
                        backs them; the Coach flags them to invite the
                        second look.
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
            </LearningHint>

            {/* §A6 Pillar 2 — your current load with A7 next-step. */}
            <LearningHint
              as="block"
              category="C.A.R.E · Your work"
              title="Your current load"
              whatItIs="What you're carrying right now — waiting on you, conversations claimed, and replies sent over the window."
              why="Per §A6 Pillar 2 you see your own load first; no leader gets your individual presence data without this self-view existing. It's accountability made supportive, not surveillance."
              how="'Waiting on you' is the promise-of-speed number — work it down first. Tap the affordance to open exactly those conversations."
              principle="You see what's seen about you, first — no asymmetric visibility on people."
            >
            <div className="bg-white/[0.02] border border-default rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Inbox className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  Your current load
                </h2>
              </div>
              <p className="text-[11px] text-secondary leading-relaxed mb-4">
                What you&apos;re carrying right now and what you covered
                over the window. Per §A6 Pillar 2 you see this yourself
                first; no leader gets your individual presence data
                without your self-view existing.
              </p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <PresenceCell
                  label="Waiting on you"
                  count={snap.presence.awaitingResponse}
                  total={null}
                  tone="amber"
                />
                <PresenceCell
                  label="Conversations claimed"
                  count={snap.presence.conversationsClaimed}
                  total={null}
                />
                <PresenceCell
                  label="Replies sent"
                  count={snap.presence.repliesSent}
                  total={null}
                />
              </div>
              {/* §A7 next-step affordance — only when there's
                  something to act on. Invitation, not nudge. */}
              {snap.presence.awaitingResponse > 0 && (
                <Link
                  href="/dashboard/care/conversations?view=mine"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:text-ember-400 border border-ember-400/40 hover:border-ember-400/70 bg-ember-400/5 hover:bg-ember-400/10 px-2.5 py-1 rounded transition-colors"
                >
                  <MessageSquare className="w-3 h-3" aria-hidden />
                  Open the {snap.presence.awaitingResponse}{" "}
                  {snap.presence.awaitingResponse === 1
                    ? "conversation"
                    : "conversations"}{" "}
                  waiting on you
                </Link>
              )}
            </div>
            </LearningHint>

            {/* §A16 — Co-Pilot edit pattern. */}
            <LearningHint
              as="block"
              category="C.A.R.E · Your work"
              title="Where Co-Pilot fit in"
              whatItIs="How much you reshaped Co-Pilot drafts before sending — minor, moderate, major, or full rewrite."
              why="Both a light edit and a rewrite are useful: the diffs teach Co-Pilot your voice for the next reply. It's a record of collaboration, not a compliance score."
              how="There's no 'right' distribution to hit. Read it as how the tool is fitting your style, and expect minor edits to grow as it learns you."
              principle="The tool adapts to your voice; you never bend to the tool."
            >
            <div className="bg-white/[0.02] border border-default rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  Where Co-Pilot fit in
                </h2>
              </div>
              <p className="text-[11px] text-secondary leading-relaxed mb-4">
                When you used Co-Pilot, how much did you reshape before
                sending? &quot;Minor&quot; means the draft was close to
                what you sent; &quot;Rewrite&quot; means you reached
                for a different angle. Both are useful — the diffs
                teach Co-Pilot your voice for the next reply.
              </p>
              {totalEdits === 0 ? (
                <SparseNotice text="No Co-Pilot uses yet in the window." />
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  <EditCell
                    label="Minor"
                    count={snap.copilotMinor}
                    total={totalEdits}
                  />
                  <EditCell
                    label="Moderate"
                    count={snap.copilotModerate}
                    total={totalEdits}
                  />
                  <EditCell
                    label="Major"
                    count={snap.copilotMajor}
                    total={totalEdits}
                  />
                  <EditCell
                    label="Rewrite"
                    count={snap.copilotRewrite}
                    total={totalEdits}
                  />
                </div>
              )}
            </div>
            </LearningHint>

            {/* §1.6 close-the-loop — resolutions captured. */}
            <LearningHint
              as="block"
              category="C.A.R.E · Your work"
              title="Resolutions you captured"
              whatItIs="The count of resolutions you added to the company's playbook in this window."
              why="Per §1.1 every captured resolution is a permanent asset — the next agent facing a similar issue gets to read your reasoning. Close-the-loop made concrete (§1.6)."
              how="Read this as your contribution to institutional memory, not a quota. Each capture compounds into what the team knows."
              principle="Every resolution captured is a permanent asset for the whole team."
            >
            <div className="bg-white/[0.02] border border-default rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  Resolutions you captured
                </h2>
              </div>
              <p className="text-3xl font-bold text-primary mb-1">
                {snap.resolutions}
              </p>
              <p className="text-[11px] text-secondary leading-relaxed">
                Each resolution you captured added &quot;what worked&quot;
                to the company&apos;s playbook. The next agent reading a
                similar conversation gets to see your reasoning. Per
                §1.1 every captured resolution is a permanent asset.
              </p>
            </div>
            </LearningHint>
          </>
        )}
      </div>
    </>
  );
}

function SparseNotice({ text }: { text: string }) {
  return <p className="text-[11px] text-muted italic">{text}</p>;
}

/**
 * Render a positive presence as a count. Per §A11 + §A18 the
 * label IS the count — "Acknowledged in 12 of 30 replies" not
 * "Acknowledgment score: 40%". No percentile rank, no team
 * average comparison.
 */
function PresenceCell({
  label,
  count,
  total,
  tone = "emerald",
}: {
  label: string;
  count: number;
  total: number | null;
  tone?: "emerald" | "amber" | "muted";
}) {
  const toneCls =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
      : tone === "amber"
        ? "border-amber-500/30 bg-amber-500/5 text-amber-300"
        : "border-default bg-surface/40 text-secondary";
  return (
    <div className={`rounded-lg border p-3 ${toneCls}`}>
      <p className="text-[10px] uppercase tracking-widest font-bold mb-1">
        {label}
      </p>
      <p className="text-lg font-bold text-primary">
        {count}
        {total !== null && (
          <span className="text-xs font-mono text-muted"> of {total}</span>
        )}
      </p>
    </div>
  );
}

function RiskCell({ label, count }: { label: string; count: number }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <p className="text-[10px] uppercase tracking-widest font-bold text-amber-300 mb-1">
        {label}
      </p>
      <p className="text-lg font-bold text-primary">{count}</p>
      <p className="text-[10px] text-muted font-mono">instances</p>
    </div>
  );
}

function DurabilityCell({
  label,
  icon: Icon,
  count,
  total,
  tone,
}: {
  label: string;
  icon: typeof RotateCcw;
  count: number;
  total: number;
  tone: "emerald" | "amber" | "muted";
}) {
  const toneCls =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
      : tone === "amber"
        ? "border-amber-500/30 bg-amber-500/5 text-amber-300"
        : "border-default bg-surface/40 text-secondary";
  return (
    <div className={`rounded-lg border p-3 ${toneCls}`}>
      <div className="flex items-center gap-1 mb-1">
        <Icon className="w-3 h-3" aria-hidden />
        <p className="text-[10px] uppercase tracking-widest font-bold">
          {label}
        </p>
      </div>
      <p className="text-lg font-bold text-primary">
        {count}
        <span className="text-xs font-mono text-muted"> of {total}</span>
      </p>
    </div>
  );
}

function EditCell({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-default bg-surface/40 p-3">
      <p className="text-[10px] uppercase tracking-widest font-bold text-secondary mb-1">
        {label}
      </p>
      <p className="text-lg font-bold text-primary">{count}</p>
      <p className="text-[10px] text-muted font-mono">{pct}%</p>
    </div>
  );
}

const TIER_STYLE: Record<CareGrade["tier"], { text: string; label: string }> = {
  strong: { text: "text-emerald-300", label: "Strong" },
  solid: { text: "text-brand", label: "Solid" },
  developing: { text: "text-amber-300", label: "Developing" },
  "growth-area": { text: "text-amber-300", label: "Growth area" },
  "not-yet": { text: "text-muted", label: "Not yet" },
};

/**
 * §A10 parity — the coaching grade + 4-week trajectory the leader's Coach Assessment shows about this
 * agent, shown here to the agent themselves. §A11: the letter summarizes the counts below (which are
 * visible in the same view), the agent renders the verdict. §A18: no "F". §3.5: nothing until graded.
 */
function CoachingGradeCard({ snap }: { snap: GrowthSnapshot }) {
  if (snap.coachAggregate.repliesGraded === 0) return null;
  const grade = gradeCareAggregate(snap.coachAggregate);
  if (!grade.letter) return null;
  const tier = TIER_STYLE[grade.tier];
  return (
    <LearningHint
      as="block"
      category="C.A.R.E · Your work"
      title="Your coaching grade"
      whatItIs="A single letter summarizing the reply-pattern counts below, graded against a fixed competent-reply standard, plus the same 4-week trajectory your leader sees about you."
      why="Per §A11 the letter is a summary of the counts you can already see — not a separate verdict; you decide if it's fair. Per §A18 there is no 'F' — the lowest band is a growth area. Graded against a standard, never against other agents."
      how="Watch the trajectory move week over week against your own past. If a week dips, the counts below show which signal to work on."
      principle="Measured against a standard and your own growth, never against each other."
    >
      <div className="bg-white/[0.02] border border-default rounded-xl p-5">
        <div className="flex items-center gap-4">
          <span
            className={`inline-flex items-center justify-center w-14 h-14 rounded-xl border border-default ${tier.text} text-3xl font-extrabold shrink-0`}
            aria-hidden
          >
            {grade.letter}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${tier.text}`}>{tier.label}</p>
            <p className="text-[11px] text-muted leading-snug">
              coaching grade · vs the competent-reply standard · the same grade your leader sees about you
            </p>
          </div>
          <GrowthTrajectory points={snap.trajectory} />
        </div>
      </div>
    </LearningHint>
  );
}

/** 4-week sparkline of the Care Quality score, oldest→newest. Renders only with ≥2 weeks of data. */
function GrowthTrajectory({ points }: { points: Array<number | null> }) {
  const pts = points
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v !== null);
  if (pts.length < 2) {
    return <span className="text-[10px] text-muted shrink-0">trend builds over 2+ weeks</span>;
  }
  const W = 64;
  const H = 24;
  const n = points.length;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const y = (v: number) => H - v * H;
  const d = pts
    .map((p, k) => `${k === 0 ? "M" : "L"} ${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`)
    .join(" ");
  const last = pts[pts.length - 1]!;
  const rising = last.v >= (pts[0]?.v ?? last.v);
  const stroke = rising ? "#34D399" : "#FCD34D";
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-label="Your 4-week coaching-grade trajectory"
      className="shrink-0 overflow-visible"
    >
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(last.i)} cy={y(last.v)} r="2" fill={stroke} />
    </svg>
  );
}
