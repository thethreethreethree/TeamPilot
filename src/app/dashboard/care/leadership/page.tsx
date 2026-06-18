"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Inbox,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import Link from "next/link";

/**
 * Leadership view — team-aggregate growth snapshot.
 *
 * Constitutional sources (ThinkerThinker.md):
 *   - §A6 Pillar 2 — accountability via transparent presence,
 *     viewed at team level. No surveillance, no per-agent
 *     stack-rank.
 *   - §A8 — growth participant voice. The leader is a coach of
 *     the team, not a manager looking for underperformers.
 *   - §A10 — every field rendered here mirrors a field on the
 *     agent self-view (/dashboard/care/growth). The leader sees
 *     aggregate; the agent sees their own individual. There is
 *     no asymmetric read.
 *   - §A11 — counts and patterns, not verdicts. The leader
 *     renders the verdict on whether the team is healthy.
 *   - §A17 — positive counts (durability held, replies with
 *     acknowledgment) surface FIRST. What the team is doing well
 *     is structurally more visible than what the team is
 *     missing.
 *   - §A18 — labels are the counts themselves. There is NO
 *     "Underperforming agents" / "Top performers" panel. There
 *     is NO leaderboard. The aggregate IS the surface; per-agent
 *     reads happen only on the agent's own self-view.
 *   - §3.6 — make learning visible. This surface IS the
 *     discipline.
 *
 * Pre-merge gate honored: per the C.A.R.E asset audit's §A10
 * remediation — "Pre-merge gate on leader endpoint: must ship
 * with agent self-view." The agent self-view at
 * /dashboard/care/growth was shipped in the prior commit; this
 * surface ships only on top of that.
 */

type TeamPresence = {
  totalAgents: number;
  onlineCount: number;
  awayCount: number;
  offlineCount: number;
  atCapacityCount: number;
  totalCurrentLoad: number;
  channelCoverage: Record<string, number>;
};

type TeamSnapshot = {
  companyId: string;
  windowDays: number;
  agentCount: number;
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
};

export default function CareLeadershipPage() {
  const [snap, setSnap] = useState<TeamSnapshot | null>(null);
  const [presence, setPresence] = useState<TeamPresence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/care/leadership/team");
        if (res.status === 403) {
          setError("Leadership view is for CEO / COO / admin.");
          return;
        }
        if (!res.ok) {
          setError("Couldn't load.");
          return;
        }
        const data = await res.json();
        setSnap(data.snapshot ?? null);
        setPresence(data.presence ?? null);
      } catch {
        setError("Couldn't reach the server.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalDurability = snap
    ? snap.durabilityHeld + snap.durabilityReopened + snap.durabilityInconclusive
    : 0;
  const totalEdits = snap
    ? snap.copilotMinor +
      snap.copilotModerate +
      snap.copilotMajor +
      snap.copilotRewrite
    : 0;
  const totalRisks = snap
    ? snap.coachAggregate.risks.unsupportedAbsolutes +
      snap.coachAggregate.risks.fabricatedSpecifics +
      snap.coachAggregate.risks.emptyFiller
    : 0;

  return (
    <>
      <header className="px-8 py-4 border-b border-default bg-base/60 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-primary">Team</h1>
          <p className="text-[11px] text-muted">
            The team&apos;s work · last 30 days · aggregate only · no
            per-agent breakdown by design (§A18)
          </p>
        </div>
        <Link
          href="/dashboard/care/leadership/readouts"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:text-ember-400 border border-ember-400/40 hover:border-ember-400/70 bg-ember-400/5 hover:bg-ember-400/10 px-2.5 py-1 rounded transition-colors"
        >
          §4 readouts
        </Link>
      </header>
      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl w-full mx-auto space-y-5">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        )}
        {error && (
          <div className="bg-red-500/5 border border-red-500/30 rounded-lg p-4">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {snap && (
          <>
            {/* §A10 + §A18 structural preamble */}
            <div className="bg-ember-400/5 border border-ember-400/30 rounded-lg p-3 flex items-start gap-2">
              <ShieldCheck
                className="w-4 h-4 text-brand shrink-0 mt-0.5"
                aria-hidden
              />
              <p className="text-xs text-secondary leading-relaxed">
                This view is team-aggregate by design. There is no
                per-agent breakdown, no leaderboard, no stack-rank.
                Every field here mirrors a field each agent already
                sees on their own work page — nothing is revealed to
                you that the agent doesn&apos;t already see about
                themselves (§A10). The constitutional shape of this
                surface is: the team&apos;s work as a coachable whole.
              </p>
            </div>

            {/* Team size — context for reading the aggregates. */}
            <div className="bg-white/[0.02] border border-default rounded-xl p-4 flex items-center gap-3">
              <Users className="w-4 h-4 text-brand" aria-hidden />
              <p className="text-xs text-secondary">
                <span className="font-bold text-primary text-base">
                  {snap.agentCount}
                </span>{" "}
                {snap.agentCount === 1 ? "agent" : "agents"} on the
                team this window.
              </p>
            </div>

            {/* §A6 + §A18 — team presence right now. Aggregate
                counts only; no per-agent breakdown by design.
                Surfaces coverage ("do we have humans on this
                channel?") not surveillance ("who's idle?"). */}
            {presence && (
              <div className="bg-white/[0.02] border border-default rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-brand" aria-hidden />
                  <h2 className="text-sm font-semibold text-primary">
                    Right now
                  </h2>
                </div>
                <p className="text-[11px] text-secondary leading-relaxed mb-4">
                  Live team presence. The labels are descriptive,
                  never evaluative — per §A18 there&apos;s no
                  &quot;most active&quot; or &quot;idle&quot; framing
                  here. Coverage tells you whether the team can take
                  a conversation right now; per-agent state is each
                  agent&apos;s to control and see.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <PresenceCountCell
                    label="Online"
                    count={presence.onlineCount}
                    total={presence.totalAgents}
                    tone="emerald"
                  />
                  <PresenceCountCell
                    label="Away"
                    count={presence.awayCount}
                    total={presence.totalAgents}
                    tone="amber"
                  />
                  <PresenceCountCell
                    label="Offline"
                    count={presence.offlineCount}
                    total={presence.totalAgents}
                    tone="muted"
                  />
                  <PresenceCountCell
                    label="At capacity"
                    count={presence.atCapacityCount}
                    total={presence.onlineCount}
                    tone={
                      presence.atCapacityCount > 0 &&
                      presence.atCapacityCount >= presence.onlineCount
                        ? "amber"
                        : "muted"
                    }
                  />
                </div>
                <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-2">
                  Channel coverage right now
                </p>
                {Object.keys(presence.channelCoverage).length === 0 ? (
                  <p className="text-[11px] text-muted italic">
                    No online agents covering any channels.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(presence.channelCoverage).map(
                      ([channel, count]) => (
                        <span
                          key={channel}
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-secondary bg-surface/40 border border-default px-2 py-0.5 rounded"
                        >
                          {channel}
                          <span className="font-mono text-primary">
                            {count}
                          </span>
                        </span>
                      )
                    )}
                  </div>
                )}
                <p className="text-[10px] text-muted italic mt-3">
                  Currently carrying {presence.totalCurrentLoad}{" "}
                  conversations across the team. Each agent sets their
                  own status (§A6 Pillar 2). Capacity + channels are
                  org settings; adjust per agent in{" "}
                  Settings &rsaquo; Agents.
                </p>
              </div>
            )}

            {/* §A17 experiential FIRST — what the team's work landed. */}
            <div className="bg-white/[0.02] border border-default rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2
                  className="w-4 h-4 text-emerald-300"
                  aria-hidden
                />
                <h2 className="text-sm font-semibold text-primary">
                  What the team&apos;s work landed durably
                </h2>
              </div>
              <p className="text-[11px] text-secondary leading-relaxed mb-4">
                7-day check after each team resolution: did the
                customer come back with the same issue? &quot;Held&quot;
                is the count that matters most — work that compounded
                into the playbook.
              </p>
              {totalDurability === 0 ? (
                <SparseNotice text="Not enough checked durabilities yet in the window." />
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
                &quot;Reopened&quot; isn&apos;t a grade on any agent —
                often it&apos;s a signal the root cause is upstream of
                where the conversation was closed. Worth investigating
                as a team, not assigning to an individual.
              </p>
            </div>

            {/* §A11 team-aggregate Coach counts. */}
            <div className="bg-white/[0.02] border border-default rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  How the team&apos;s replies have read
                </h2>
              </div>
              <p className="text-[11px] text-secondary leading-relaxed mb-4">
                Counts across {snap.coachAggregate.repliesGraded}{" "}
                graded team{" "}
                {snap.coachAggregate.repliesGraded === 1
                  ? "reply"
                  : "replies"}{" "}
                in the window. Per §A11 these are facts; the verdict
                on whether the pattern is healthy is yours. No per-
                agent comparison here by design (§A18).
              </p>
              {snap.coachAggregate.repliesGraded === 0 ? (
                <SparseNotice text="No team replies graded under Coach v6 yet in the window." />
              ) : (
                <>
                  <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-2">
                    What the team brought
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
                        Worth a team-wide second look
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
                        Risks across the team can point to gaps in
                        product context (not bad agents). Coach the
                        cause, not the symptom.
                      </p>
                    </>
                  )}
                </>
              )}
            </div>

            {/* §A6 — team load. */}
            <div className="bg-white/[0.02] border border-default rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Inbox className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  Team load
                </h2>
              </div>
              <p className="text-[11px] text-secondary leading-relaxed mb-4">
                What the team is carrying and what they covered.
                Per §A6 Pillar 2 this is transparent accountability,
                not surveillance.
              </p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <PresenceCell
                  label="Waiting on the team"
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
                  label="Team replies sent"
                  count={snap.presence.repliesSent}
                  total={null}
                />
              </div>
              {snap.presence.awaitingResponse > 0 && (
                <Link
                  href="/dashboard/care/conversations?view=all_open"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:text-ember-400 border border-ember-400/40 hover:border-ember-400/70 bg-ember-400/5 hover:bg-ember-400/10 px-2.5 py-1 rounded transition-colors"
                >
                  See the {snap.presence.awaitingResponse} open{" "}
                  {snap.presence.awaitingResponse === 1
                    ? "conversation"
                    : "conversations"}
                </Link>
              )}
            </div>

            {/* §A16 — Co-Pilot usage across the team. */}
            <div className="bg-white/[0.02] border border-default rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  Co-Pilot use across the team
                </h2>
              </div>
              <p className="text-[11px] text-secondary leading-relaxed mb-4">
                How much did agents reshape Co-Pilot drafts before
                sending? &quot;Minor&quot; means the drafts were close
                to what got sent; &quot;Rewrite&quot; means agents
                consistently reached for a different angle. Useful
                signal for Co-Pilot voice tuning — not for evaluating
                individual agents.
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

            {/* §1.6 close-the-loop — team resolution count. */}
            <div className="bg-white/[0.02] border border-default rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  Resolutions the team captured
                </h2>
              </div>
              <p className="text-3xl font-bold text-primary mb-1">
                {snap.resolutions}
              </p>
              <p className="text-[11px] text-secondary leading-relaxed">
                Per §1.1 every captured resolution is a permanent
                asset. The team&apos;s playbook compounds — what
                worked for one customer becomes context for the next.
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function SparseNotice({ text }: { text: string }) {
  return <p className="text-[11px] text-muted italic">{text}</p>;
}

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
      <p className="text-[10px] text-muted font-mono">team total</p>
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

/**
 * Render a presence count as "N of total". Same shape as
 * PresenceCell from the agent self-view (§A10 symmetry) — leader
 * reads the same count form the agent reads about themselves.
 */
function PresenceCountCell({
  label,
  count,
  total,
  tone,
}: {
  label: string;
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
      <p className="text-[10px] uppercase tracking-widest font-bold mb-1">
        {label}
      </p>
      <p className="text-lg font-bold text-primary">
        {count}
        {total > 0 && (
          <span className="text-xs font-mono text-muted"> of {total}</span>
        )}
      </p>
    </div>
  );
}
